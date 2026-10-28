// Security acceptance: real PostgreSQL and deterministic barriers, no production.
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
  const org=await db.organization.create({data:{name:'Comments P1 fixture',slug:'comments-revocation-'+randomUUID()}});orgs.push(org);
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

test('independent review: permission revoked before POST transaction is acquired',async()=>{
 const [a]=await fixture();const permit={leads:{view:true,edit:true},tasks:{view:true,edit:true}};
 await db.user.update({where:{id:a.user.id},data:{role:'user',permissions:JSON.stringify(permit)}});
 let changed=false;
 const client=new Proxy(db,{get(target,key){if(key==='$transaction')return async(callback,options)=>{await db.user.update({where:{id:a.user.id},data:{permissions:JSON.stringify({...permit,tasks:{view:true,edit:false}})}});changed=true;return target.$transaction(callback,options);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 const res=await call(route(a,client),'POST',a,payload(a));
 const persisted=await db.comment.count({where:{organizationId:a.org.id,parentId:a.parent.id}});
 console.log(JSON.stringify({case:'permission-revocation-before-post-transaction',revokedBeforeTransaction:changed,status:res.status,persisted}));
 assert.equal(res.status,403);assert.equal(persisted,0);assert.ok(!(await res.text()).includes('Own reply'));
});
test('independent review: membership transferred before GET transaction starts',async()=>{
 const [a,b]=await fixture();let changed=false;
 const colleague=await db.user.create({data:{organizationId:a.org.id,name:'Local colleague',email:randomUUID()+'@example.invalid',passwordHash:'not-a-login',role:'user'}});
 const local=await db.comment.create({data:{organizationId:a.org.id,authorId:colleague.id,entityType:'task',entityId:a.task.id,content:'LOCAL_ONLY_MARKER'}});
 const client=new Proxy(db,{get(target,key){if(key==='$transaction')return async(callback,options)=>{await db.user.update({where:{id:a.user.id},data:{organizationId:b.org.id}});changed=true;return target.$transaction(callback,options);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 const res=await call(route(a,client),'GET',a);const body=await res.json();
 console.log(JSON.stringify({case:'membership-transfer-before-get-transaction',transferredBeforeTransaction:changed,status:res.status,previousOrganizationDataReturned:Array.isArray(body)&&body.some(c=>c.id===local.id),currentMembershipMatchesRequestedTenant:(await db.user.findUnique({where:{id:a.user.id}})).organizationId===a.org.id}));
 assert.equal(res.status,403);assert.ok(!JSON.stringify(body).includes(local.id));assert.ok(!JSON.stringify(body).includes('LOCAL_ONLY_MARKER'));assert.notEqual((await db.user.findUnique({where:{id:a.user.id}})).organizationId,a.org.id);
});

test('revocation committed before a transaction denies GET and POST before sensitive comment queries',async()=>{
 for(const method of ['GET','POST'])for(const change of ['permission','user','organization','transfer']){
  const [a,b]=await fixture();const allowed={leads:{view:true,edit:true},tasks:{view:true,edit:true}};
  await db.user.update({where:{id:a.user.id},data:{role:'user',permissions:JSON.stringify(allowed)}});
  let sensitiveCalls=0;
  const client=new Proxy(db,{get(target,key){if(key==='$transaction')return async(callback,options)=>{
   if(change==='permission')await db.user.update({where:{id:a.user.id},data:{permissions:JSON.stringify({...allowed,tasks:{view:false,edit:false}})}});
   if(change==='user')await db.user.update({where:{id:a.user.id},data:{deletedAt:new Date()}});
   if(change==='organization')await db.organization.update({where:{id:a.org.id},data:{deletedAt:new Date()}});
   if(change==='transfer')await db.user.update({where:{id:a.user.id},data:{organizationId:b.org.id}});
   return target.$transaction(tx=>callback(new Proxy(tx,{get(t,k){if(k==='comment')return new Proxy(t.comment,{get(model,op){if(['findMany','create'].includes(op))return async args=>{sensitiveCalls++;return model[op](args);};return model[op];}});return t[k];}})),options);
  };const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  const response=await call(route(a,client),method,a,method==='POST'?payload(a):undefined);
  assert.equal(response.status,403,method+'/'+change);assert.equal(sensitiveCalls,0);assert.equal(await db.comment.count({where:{organizationId:a.org.id,parentId:a.parent.id}}),0);
  assert.ok(!(await response.text()).includes('Own root'));
 }
});

test('authorization lock makes later permission/transfer/deletion wait; next request sees committed revocation',async()=>{
 for(const method of ['GET','POST']){
  const [a,b]=await fixture();await db.user.update({where:{id:a.user.id},data:{role:'user',permissions:JSON.stringify({leads:{view:true,edit:true},tasks:{view:true,edit:true}})}});
  let locked,release;const ready=new Promise(r=>{locked=r;}),finish=new Promise(r=>{release=r;});
  const client=new Proxy(db,{get(target,key){if(key==='$transaction')return(callback,options)=>target.$transaction(tx=>callback(new Proxy(tx,{get(t,k){if(k==='comment')return new Proxy(t.comment,{get(model,op){if(op===(method==='GET'?'findMany':'create'))return async args=>{locked();await finish;return model[op](args);};return model[op];}});return t[k];}})),options);const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  const request=call(route(a,client),method,a,method==='POST'?payload(a):undefined);
  let timer;await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Authorization checkpoint timeout')),3000);timer.unref();})]);clearTimeout(timer);
  try{
   for(const [model,id,data] of [['user',a.user.id,{permissions:'{}'}],['user',a.user.id,{organizationId:b.org.id}],['user',a.user.id,{deletedAt:new Date()}],['organization',a.org.id,{deletedAt:new Date()}]]){
    await assert.rejects(db.$transaction(async tx=>{await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '100ms'");await tx[model].update({where:{id},data});}));
   }
  }finally{release();}
  assert.equal((await request).status,method==='GET'?200:201);
  await db.user.update({where:{id:a.user.id},data:{permissions:JSON.stringify({leads:{view:true},tasks:{view:false,edit:false}})}});
  assert.equal((await call(route(a),method,a,method==='POST'?payload(a):undefined)).status,403);
 }
});

test('GET/POST authorization revalidation works with a single database connection',async()=>{
 const [a]=await fixture(),url=new URL(disposableDatabaseUrl());url.searchParams.set('connection_limit','1');url.searchParams.set('pool_timeout','2');
 const single=new PrismaClient({datasources:{db:{url:url.toString()}}});
 try{
  const app=route(a,single);assert.equal((await call(app,'GET',a)).status,200);assert.equal((await call(app,'POST',a,payload(a))).status,201);
  assert.equal(await db.comment.count({where:{organizationId:a.org.id,parentId:a.parent.id}}),1);
 }finally{await single.$disconnect();}
});
