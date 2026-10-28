// Observational probes: PASS reproduces an unresolved residual; it is not security acceptance.
// Real route, authorization, validation and disposable PostgreSQL; session transport isolated.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {NextRequest,NextResponse} from 'next/server.js';
import * as permissions from '../../src/lib/permissions.ts';
import * as validation from '../../src/lib/validations/index.ts';
import {disposableDatabaseUrl,loadHandler} from '../../tests/helpers/load-disposable-handler.mjs';
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

test('independent review: permission revoked before POST transaction is acquired',async()=>{
 const [a]=await fixture();const permit={leads:{view:true,edit:true},tasks:{view:true,edit:true}};
 await db.user.update({where:{id:a.user.id},data:{role:'user',permissions:JSON.stringify(permit)}});
 let changed=false;
 const client=new Proxy(db,{get(target,key){if(key==='$transaction')return async(callback,options)=>{await db.user.update({where:{id:a.user.id},data:{permissions:JSON.stringify({...permit,tasks:{view:true,edit:false}})}});changed=true;return target.$transaction(callback,options);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 const res=await call(route(a,client),'POST',a,payload(a));
 const persisted=await db.comment.count({where:{organizationId:a.org.id,parentId:a.parent.id}});
 console.log(JSON.stringify({case:'permission-revocation-before-post-transaction',revokedBeforeTransaction:changed,status:res.status,persisted}));
 assert.equal(res.status,201);assert.equal(persisted,1);
});
test('independent review: membership transferred before GET transaction starts',async()=>{
 const [a,b]=await fixture();let changed=false;
 const colleague=await db.user.create({data:{organizationId:a.org.id,name:'Local colleague',email:randomUUID()+'@example.invalid',passwordHash:'not-a-login',role:'user'}});
 const local=await db.comment.create({data:{organizationId:a.org.id,authorId:colleague.id,entityType:'task',entityId:a.task.id,content:'LOCAL_ONLY_MARKER'}});
 const client=new Proxy(db,{get(target,key){if(key==='$transaction')return async(callback,options)=>{await db.user.update({where:{id:a.user.id},data:{organizationId:b.org.id}});changed=true;return target.$transaction(callback,options);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 const res=await call(route(a,client),'GET',a);const body=await res.json();
 console.log(JSON.stringify({case:'membership-transfer-before-get-transaction',transferredBeforeTransaction:changed,status:res.status,previousOrganizationDataReturned:body.some(c=>c.id===local.id),currentMembershipMatchesRequestedTenant:(await db.user.findUnique({where:{id:a.user.id}})).organizationId===a.org.id}));
 assert.equal(res.status,200);assert.ok(body.some(c=>c.id===local.id));assert.notEqual((await db.user.findUnique({where:{id:a.user.id}})).organizationId,a.org.id);
});
