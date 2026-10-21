// Real route, authorization, validation and disposable PostgreSQL; session transport isolated.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Prisma,PrismaClient} from '@prisma/client';
import {NextRequest,NextResponse} from 'next/server.js';
import * as permissions from '../src/lib/permissions.ts';
import * as validation from '../src/lib/validations/index.ts';
import {disposableDatabaseUrl,loadHandler} from './helpers/load-disposable-handler.mjs';
let db;
const orgs=[];
before(()=>{db=new PrismaClient({datasources:{db:{url:disposableDatabaseUrl()}}});});
after(async()=>{if(!db)return;await db.comment.deleteMany({where:{organizationId:{in:orgs.map(o=>o.id)}}});for(const o of orgs)await db.organization.delete({where:{id:o.id}});await db.$disconnect();});
async function fixture(){
 const actors=[];
 for(const label of ['a','b']){
  const org=await db.organization.create({data:{name:'Comments P1 fixture',slug:'comments-delete-pg-'+randomUUID()}});orgs.push(org);
  const user=await db.user.create({data:{organizationId:org.id,name:label,email:randomUUID()+'@example.invalid',passwordHash:'not-a-login',role:'owner'}});
  const task=await db.task.create({data:{organizationId:org.id,title:'Own task',createdById:user.id}});
  const parent=await db.comment.create({data:{organizationId:org.id,authorId:user.id,entityType:'task',entityId:task.id,content:'Own root'}});
  actors.push({org,user,task,parent});
 }return actors;
}
function route(a,client=db,filename='src/app/api/comments/[id]/route.ts',onError=()=>{}){
 const infra={'next/server':{NextResponse},'@/lib/prisma':{prisma:client},'@/lib/permissions':permissions};
 const auth=loadHandler('src/lib/checkPermission.ts',{...infra,'next-auth':{getServerSession:async()=>a?({user:{id:a.user.id,organizationId:a.org.id,role:a.user.role}}):null},'@/lib/auth':{authOptions:{}}});
 return loadHandler(filename,{...infra,'@/lib/checkPermission':auth,'@/lib/validations':validation},{console:{error(_label,error){onError(error);}}});
}

function remove(app,id){return app.DELETE(new NextRequest('http://localhost/api/comments/'+id,{method:'DELETE'}),{params:Promise.resolve({id})});}
async function seed(a,extra={}){return db.comment.create({data:{organizationId:a.org.id,authorId:a.user.id,entityType:'task',entityId:a.task.id,content:'Synthetic comment',...extra}});}
async function snapshot(actors){return db.comment.findMany({where:{organizationId:{in:actors.map(a=>a.org.id)}},orderBy:{id:'asc'}});}
test('DELETE: owner/admin/user cannot delete foreign roots or replies; no effects or data in errors',async()=>{
 const [a,b]=await fixture();const child=await seed(b,{parentId:b.parent.id});
 for(const role of ['owner','admin','user']){
  await db.user.update({where:{id:a.user.id},data:{role,permissions:JSON.stringify({leads:{view:true,delete:true},tasks:{view:true,delete:true}})}});
  for(const target of [b.parent.id,child.id]){
   const before=await snapshot([a,b]);const res=await remove(route(a),target);assert.equal(res.status,404);assert.deepEqual(await snapshot([a,b]),before);assert.deepEqual(await res.json(),{error:'Comentário não encontrado'});
  }
 }
 assert.equal(await db.notification.count({where:{userId:{in:[a.user.id,b.user.id]}}}),0);
 assert.equal(await db.activity.count({where:{userId:{in:[a.user.id,b.user.id]}}}),0);
});
test('DELETE: corrupt tenant, author, entity and descendant edges reject the whole deletion',async()=>{
 const [a,b]=await fixture(),app=route(a);
 for(const extra of [{organizationId:b.org.id,authorId:b.user.id,entityId:b.task.id},{authorId:b.user.id},{entityId:b.task.id},{entityType:'goal'}]){
  const root=await seed(a);await seed(a,{parentId:root.id,...extra});
  const before=await snapshot([a,b]);assert.equal((await remove(app,root.id)).status,409);assert.deepEqual(await snapshot([a,b]),before);
 }
 const nested=await seed(a),middle=await seed(a,{parentId:nested.id});await seed(b,{parentId:middle.id});
 const before=await snapshot([a,b]);assert.equal((await remove(app,nested.id)).status,409);assert.deepEqual(await snapshot([a,b]),before);
 for(const [extra,status] of [[{authorId:b.user.id},404],[{entityId:b.task.id},404],[{parentId:b.parent.id},409],[{parentId:randomUUID()},409]]){
  const bad=await seed(a,extra),before=await snapshot([a,b]);assert.equal((await remove(app,bad.id)).status,status);assert.deepEqual(await snapshot([a,b]),before);
 }
});
test('DELETE: authentication precedes lookup, removed memberships denied, operational delete required',async()=>{
 const [a]=await fixture();for(const id of [a.parent.id,randomUUID()])assert.equal((await remove(route(null),id)).status,401);
 await db.user.update({where:{id:a.user.id},data:{role:'user',permissions:JSON.stringify({leads:{view:true},tasks:{view:true,delete:false}})}});
 assert.equal((await remove(route(a),a.parent.id)).status,403);
 await db.user.update({where:{id:a.user.id},data:{deletedAt:new Date()}});assert.equal((await remove(route(a),a.parent.id)).status,401);
 await db.user.update({where:{id:a.user.id},data:{deletedAt:null}});await db.organization.update({where:{id:a.org.id},data:{deletedAt:new Date()}});
 assert.equal((await remove(route(a),a.parent.id)).status,403);assert.ok(await db.comment.findUnique({where:{id:a.parent.id}}));
});
test('DELETE: author can delete own subtree; admin needs delete; user cannot delete another author',async()=>{
 const [a]=await fixture();const colleague=await db.user.create({data:{organizationId:a.org.id,name:'Colleague',email:randomUUID()+'@example.invalid',passwordHash:'not-a-login',role:'user'}});
 const foreignAuthor=await seed(a,{authorId:colleague.id});
 for(const role of ['user','admin']){
  await db.user.update({where:{id:a.user.id},data:{role,permissions:JSON.stringify({leads:{view:true},tasks:{view:true,delete:role==='user'}})}});
  assert.equal((await remove(route(a),foreignAuthor.id)).status,403);
 }
 await db.user.update({where:{id:a.user.id},data:{role:'user',permissions:JSON.stringify({leads:{view:true},tasks:{view:true,delete:true}})}});
 const child=await seed(a,{parentId:a.parent.id}),grandchild=await seed(a,{parentId:child.id});
 assert.equal((await remove(route(a),child.id)).status,200);assert.equal(await db.comment.count({where:{id:{in:[child.id,grandchild.id]}}}),0);assert.ok(await db.comment.findUnique({where:{id:a.parent.id}}));
 assert.equal((await remove(route(a),a.parent.id)).status,200);
 await db.user.update({where:{id:a.user.id},data:{role:'admin'}});assert.equal((await remove(route(a),foreignAuthor.id)).status,200);
});
test('DELETE: injected failure after actual PostgreSQL deletion rolls back root and descendants',async()=>{
 const [a]=await fixture();await seed(a,{parentId:a.parent.id});const before=await snapshot([a]);
 const client=new Proxy(db,{get(target,key){if(key==='$transaction')return(callback,options)=>target.$transaction(tx=>callback(new Proxy(tx,{get(t,k){if(k==='comment')return new Proxy(t.comment,{get(model,op){if(op==='deleteMany')return async args=>{await model.deleteMany(args);throw Error('Injected after DELETE');};return model[op];}});return t[k];}})),options);const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 assert.equal((await remove(route(a,client),a.parent.id)).status,500);assert.deepEqual(await snapshot([a]),before);
});
test('DELETE: row/ownership locks prevent concurrent tenant reassignment or role revocation before commit',async()=>{
 const [a,b]=await fixture();const child=await seed(a,{parentId:a.parent.id});let signal,release;
 const ready=new Promise(r=>{signal=r;}),finish=new Promise(r=>{release=r;});
 const client=new Proxy(db,{get(target,key){if(key==='$transaction')return(callback,options)=>target.$transaction(tx=>callback(new Proxy(tx,{get(t,k){if(k==='comment')return new Proxy(t.comment,{get(model,op){if(op==='deleteMany')return async args=>{signal();await finish;return model.deleteMany(args);};return model[op];}});return t[k];}})),options);const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 const writing=remove(route(a,client),a.parent.id);
 await Promise.race([ready,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Lock checkpoint not reached')),3000);t.unref();})]);
 try{
  for(const [model,id,data] of [['comment',a.parent.id,{organizationId:b.org.id}],['comment',child.id,{organizationId:b.org.id}],['task',a.task.id,{organizationId:b.org.id}],['user',a.user.id,{role:'user'}]]){
   await assert.rejects(db.$transaction(async tx=>{await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '100ms'");await tx[model].update({where:{id},data});}));
  }
 }finally{release();}
 assert.equal((await writing).status,200);assert.equal(await db.comment.count({where:{id:{in:[a.parent.id,child.id]}}}),0);assert.equal((await db.user.findUnique({where:{id:a.user.id}})).role,'owner');
});
test('DELETE: two concurrent requests do not partially delete or return an unexpected server error',async()=>{
 const [a]=await fixture();await seed(a,{parentId:a.parent.id});
 const results=await Promise.all([remove(route(a),a.parent.id),remove(route(a),a.parent.id)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,404]);assert.equal(await db.comment.count({where:{organizationId:a.org.id}}),0);
});
test('DELETE versus POST: a concurrent reply cannot be committed after its parent is removed',async()=>{
 const [a]=await fixture();let locked,release,parentRead;const errors=[];
 const checkpoint=async promise=>{let timer;try{await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Concurrency checkpoint timeout')),3000);})]);}finally{clearTimeout(timer);}};
 const ready=new Promise(r=>{locked=r;}),finish=new Promise(r=>{release=r;}),reading=new Promise(r=>{parentRead=r;});
 const wrapped=kind=>new Proxy(db,{get(target,key){
  if(key==='$transaction')return(callback,options)=>target.$transaction(tx=>callback(new Proxy(tx,{get(t,k){
   if(kind==='delete'&&k==='comment')return new Proxy(t.comment,{get(model,op){if(op==='deleteMany')return async args=>{locked();await finish;return model.deleteMany(args);};return model[op];}});
   if(kind==='post'&&k==='$queryRaw')return async query=>{if(query.values?.includes(a.parent.id))parentRead();return t.$queryRaw(query);};return t[k];
  }})),options);const value=target[key];return typeof value==='function'?value.bind(target):value;
 }});
 const deleting=remove(route(a,wrapped('delete')),a.parent.id);await checkpoint(ready);
 const app=route(a,wrapped('post'),'src/app/api/comments/route.ts',error=>errors.push({code:error.code,sqlState:error.meta?.code}));
 const posting=app.POST(new NextRequest('http://localhost/api/comments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entityType:'task',entityId:a.task.id,parentId:a.parent.id,content:'Must not be orphaned'})}));
 try{await checkpoint(reading);}finally{release();}
 assert.equal((await deleting).status,200);
 const rejected=await posting;assert.equal(rejected.status,409);
 assert.deepEqual(await rejected.json(),{error:'Conflito de atualização; tente novamente'});
 assert.deepEqual(errors,[]);assert.equal(await db.comment.count({where:{organizationId:a.org.id}}),0);
});

test('comments conflict mapping: only known serialization/deadlock conflicts return 409; unrelated failures remain 500',async()=>{
 const [a]=await fixture();
 for(const sqlState of ['40001','40P01','23505',undefined,'unexpected']){
  const failure=sqlState==='unexpected'?Error('Synthetic failure details must not be returned'):new Prisma.PrismaClientKnownRequestError('Synthetic failure details must not be returned',{code:'P2010',clientVersion:Prisma.prismaVersion.client,meta:sqlState?{code:sqlState}:{}});
  const client=new Proxy(db,{get(target,key){if(key==='$transaction')return async()=>{throw failure;};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  const expected=['40001','40P01'].includes(sqlState)?409:500;
  for(const method of ['GET','POST']){
   const logged=[],app=route(a,client,'src/app/api/comments/route.ts',error=>logged.push(error));
   const response=await app[method](new NextRequest('http://localhost/api/comments?entityType=task&entityId='+a.task.id,{method,...(method==='POST'?{headers:{'content-type':'application/json'},body:JSON.stringify({entityType:'task',entityId:a.task.id,parentId:a.parent.id,content:'No partial write'})}:{})}));
   assert.equal(response.status,expected);assert.deepEqual(await response.json(),{error:expected===409?'Conflito de atualização; tente novamente':'Erro interno do servidor'});
   assert.equal(logged.length,expected===409?0:1);assert.equal(await db.comment.count({where:{organizationId:a.org.id}}),1);
  }
 }
});
