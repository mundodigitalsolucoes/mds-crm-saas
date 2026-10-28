// Real route, authorization, validation and disposable PostgreSQL; session transport isolated.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
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
  const org=await db.organization.create({data:{name:'Comments P1 fixture',slug:'comments-pg-'+randomUUID()}});orgs.push(org);
  const user=await db.user.create({data:{organizationId:org.id,name:label,email:randomUUID()+'@example.invalid',passwordHash:'not-a-login',role:'owner'}});
  const task=await db.task.create({data:{organizationId:org.id,title:'Own task',createdById:user.id}});
  const parent=await db.comment.create({data:{organizationId:org.id,authorId:user.id,entityType:'task',entityId:task.id,content:'Own root'}});
  actors.push({org,user,task,parent});
 }return actors;
}
function route(a,client=db){
 const infra={'next/server':{NextResponse},'@/lib/prisma':{prisma:client},'@/lib/permissions':permissions};
 const auth=loadHandler('src/lib/checkPermission.ts',{...infra,'next-auth':{getServerSession:async()=>({user:{id:a.user.id,organizationId:a.org.id,role:a.user.role}})},'@/lib/auth':{authOptions:{}}});
 return loadHandler('src/app/api/comments/route.ts',{...infra,'@/lib/checkPermission':auth,'@/lib/validations':validation},{console:{error(){}}});
}
function call(app,method,a,data){return app[method](new NextRequest('http://localhost/api/comments?entityType=task&entityId='+a.task.id,{method,...(data?{body:JSON.stringify(data),headers:{'content-type':'application/json'}}:{})}));}
const payload=(a,extra={})=>({entityType:'task',entityId:a.task.id,content:'Own reply',parentId:a.parent.id,...extra});
test('comments: foreign/wrong entity/missing parents are rejected without any write or notification',async()=>{
 const [a,b]=await fixture(),app=route(a);
 const badAuthor=await db.comment.create({data:{organizationId:a.org.id,authorId:b.user.id,entityType:'task',entityId:a.task.id,content:'Invalid historical author'}});
 for(const extra of [{parentId:badAuthor.id},{parentId:b.parent.id},{entityId:b.task.id},{parentId:randomUUID()},{entityId:randomUUID()}]){
  const before=await db.comment.count({where:{organizationId:a.org.id}});const res=await call(app,'POST',a,payload(a,extra));assert.ok([400,404].includes(res.status));assert.equal(await db.comment.count({where:{organizationId:a.org.id}}),before);
  assert.equal(await db.notification.count({where:{userId:{in:[a.user.id,b.user.id]}}}),0);
  assert.equal(await db.activity.count({where:{userId:{in:[a.user.id,b.user.id]}}}),0);
 }
 const other=await db.task.create({data:{organizationId:a.org.id,title:'Other own task'}});
 assert.equal((await call(app,'POST',a,payload(a,{entityId:other.id}))).status,400);
});
test('comments: historical foreign tenant/entity/author roots and replies cannot be serialized',async()=>{
 const [a,b]=await fixture();
 for(const data of [{organizationId:b.org.id,authorId:b.user.id,entityId:a.task.id},{organizationId:a.org.id,authorId:b.user.id,entityId:a.task.id},{organizationId:a.org.id,authorId:a.user.id,entityId:b.task.id}]){
  await db.comment.create({data:{...data,entityType:'task',parentId:a.parent.id,content:'FOREIGN_MARKER'}});
  if(data.entityId===a.task.id)await db.comment.create({data:{...data,entityType:'task',content:'FOREIGN_MARKER'}});
 }
 const res=await call(route(a),'GET',a);assert.equal(res.status,200);const body=await res.json();assert.equal(body.length,1);assert.equal(body[0].replies.length,0);assert.ok(!JSON.stringify(body).includes('FOREIGN_MARKER'));
 assert.equal((await call(route(a),'GET',{task:b.task})).status,404);
});
test('comments: same-tenant concurrent replies remain usable and active-user/organization checks remain effective',async()=>{
 const [a]=await fixture(),app=route(a);
 const replies=await Promise.all([call(app,'POST',a,payload(a)),call(app,'POST',a,payload(a))]);assert.deepEqual(replies.map(r=>r.status),[201,201]);
 const tree=await(await call(app,'GET',a)).json();assert.equal(tree[0].replies.length,2);
 await db.user.update({where:{id:a.user.id},data:{deletedAt:new Date()}});assert.equal((await call(app,'POST',a,payload(a))).status,401);
 await db.user.update({where:{id:a.user.id},data:{deletedAt:null}});await db.organization.update({where:{id:a.org.id},data:{deletedAt:new Date()}});assert.equal((await call(app,'GET',a)).status,403);
});
test('comments: operational permission remains mandatory',async()=>{
 const [a]=await fixture();await db.user.update({where:{id:a.user.id},data:{role:'user',permissions:JSON.stringify({leads:{view:false,edit:false,create:false,delete:false},tasks:{view:false,edit:false,create:false,delete:false}})}});
 assert.equal((await call(route(a),'GET',a)).status,403);assert.equal((await call(route(a),'POST',a,payload(a))).status,403);
});
test('comments: injected failure after INSERT rolls back the PostgreSQL transaction',async()=>{
 const [a]=await fixture();const before=await db.comment.count({where:{organizationId:a.org.id}});
 const client=new Proxy(db,{get(target,key){
  if(key==='$transaction')return(callback,options)=>target.$transaction(tx=>callback(new Proxy(tx,{get(t,k){if(k==='comment')return new Proxy(t.comment,{get(model,op){if(op==='create')return async args=>{await model.create(args);throw Error('Injected after INSERT');};return model[op];}});return t[k];}})),options);
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }});
 assert.equal((await call(route(a,client),'POST',a,payload(a))).status,500);assert.equal(await db.comment.count({where:{organizationId:a.org.id}}),before);
});
test('comments: parent and entity SHARE locks prevent concurrent tenant reassignment before commit',async()=>{
 const [a,b]=await fixture();let signal,release;
 const ready=new Promise(r=>{signal=r;}),finish=new Promise(r=>{release=r;});
 const client=new Proxy(db,{get(target,key){
  if(key==='$transaction')return(callback,options)=>target.$transaction(tx=>callback(new Proxy(tx,{get(t,k){if(k==='comment')return new Proxy(t.comment,{get(model,op){if(op==='create')return async args=>{signal();await finish;return model.create(args);};return model[op];}});return t[k];}})),options);
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }});
 const writing=call(route(a,client),'POST',a,payload(a));
 await Promise.race([ready,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Lock checkpoint not reached')),3000);timer.unref();})]);
 try {
  for(const [model,id] of [['comment',a.parent.id],['task',a.task.id]]) {
   await assert.rejects(db.$transaction(async tx=>{await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '100ms'");await tx[model].update({where:{id},data:{organizationId:b.org.id}});}));
   assert.equal((await db[model].findUnique({where:{id}})).organizationId,a.org.id);
  }
 }finally{release();}
 assert.equal((await writing).status,201);
});
