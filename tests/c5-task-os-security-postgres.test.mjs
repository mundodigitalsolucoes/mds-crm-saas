// Real PostgreSQL + real handlers/authorization/validation, isolated session and local DB only.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server.js';
import * as permissions from '../src/lib/permissions.ts';
import * as validation from '../src/lib/validations/index.ts';
import { disposableDatabaseUrl, loadHandler } from './helpers/load-disposable-handler.mjs';
let db;
const orgs = [], resources = ['leads','tasks','projects','os','agenda','kanban','reports','goals','integrations','settings','users','atendimento'];
const all = Object.fromEntries(resources.map(key => [key, { view:true, create:true, edit:true, delete:true }]));
before(() => { db = new PrismaClient({ datasources: { db: { url:disposableDatabaseUrl() } } }); });
after(async () => {
 if (!db) return;
 const ids=orgs.map(org=>org.id), users=await db.user.findMany({where:{organizationId:{in:ids}},select:{id:true}});
 await db.activity.deleteMany({where:{userId:{in:users.map(user=>user.id)}}});
 await db.comment.deleteMany({where:{organizationId:{in:ids}}});
 await db.attachment.deleteMany({where:{organizationId:{in:ids}}});
 for(const org of orgs)await db.organization.delete({where:{id:org.id}});
 await db.$disconnect();
});
async function fixture() {
 const pair=[];
 for(const label of ['a','b']) {
  const org=await db.organization.create({data:{name:'C5 correction '+label,slug:'c5-fix-'+randomUUID(),plan:'trial',trialEndsAt:new Date(Date.now()+86400000),maxOs:100}});orgs.push(org);
  const user=await db.user.create({data:{organizationId:org.id,email:randomUUID()+'@example.invalid',passwordHash:'not-a-login',name:label==='a'?'Own user':'foreign-user-marker',role:'user',permissions:JSON.stringify(all)}});
  const lead=await db.lead.create({data:{organizationId:org.id,name:label==='a'?'Own lead':'foreign-lead-marker'}});
  const project=await db.marketingProject.create({data:{organizationId:org.id,title:label==='a'?'Own project':'foreign-project-marker',ownerId:user.id}});
  pair.push({org,user,lead,project});
 }
 return pair;
}
function adapter(f, client=db) {
 const infra={'next/server':{NextResponse},'@/lib/prisma':{prisma:client},'@/lib/permissions':permissions};
 const auth=loadHandler('src/lib/checkPermission.ts',{...infra,'next-auth':{getServerSession:async()=>({user:{id:f.user.id,organizationId:f.org.id,role:f.user.role}})},'@/lib/auth':{authOptions:{}}});
 const relations=loadHandler('src/lib/task-os-relations.ts',{...infra,'@/lib/checkPermission':auth});
 const limits=loadHandler('src/lib/checkLimits.ts',infra);
 return {relations,route:(kind,detail=false)=>loadHandler(`src/app/api/${kind}${detail?'/[id]':''}/route.ts`,{...infra,'@/lib/checkPermission':auth,'@/lib/task-os-relations':relations,'@/lib/checkLimits':limits,'@/lib/validations':validation},{console:{error(){}}})};
}
async function request(route, method, data, id) {
 return route[method](new NextRequest('http://localhost/api/test',{method,...(data?{body:JSON.stringify(data),headers:{'content-type':'application/json'}}:{})}),{params:Promise.resolve({id})});
}
async function counts(f) {return Promise.all([db.task.count({where:{organizationId:f.org.id}}),db.serviceOrder.count({where:{organizationId:f.org.id}}),db.notification.count({where:{user:{organizationId:f.org.id}}}),db.activity.count({where:{userId:f.user.id}})]);}

test('C5 fix: foreign writes leave root, activity and notifications unchanged; mixed valid/invalid payload is atomic',async()=>{
 const [a,b]=await fixture(), app=adapter(a);
 for(const kind of ['tasks','os']) {
  const model=kind==='tasks'?'task':'serviceOrder';
  const own=await db[model].create({data:{organizationId:a.org.id,title:'Unchanged',createdById:a.user.id,...(kind==='os'?{code:randomUUID()}:{} )}});
  for(const field of kind==='tasks'?['leadId','projectId','assignedToId']:['projectId','assignedToId'])for(const method of ['POST','PUT']) {
   const initial=await counts(a), before=await db[model].findUnique({where:{id:own.id}});
   const foreign={leadId:b.lead.id,projectId:b.project.id,assignedToId:b.user.id};
   const response=await request(app.route(kind,method==='PUT'),method,{title:'Must never persist',projectId:a.project.id,[field]:foreign[field]},own.id);
   assert.equal(response.status,400);assert.deepEqual(await counts(a),initial);assert.equal(await db.notification.count({where:{userId:b.user.id}}),0);
   assert.deepEqual(await db[model].findUnique({where:{id:own.id}}),before);
  }
 }
 const task=await db.task.create({data:{organizationId:a.org.id,title:'Original',createdById:a.user.id}});
 const response=await request(app.route('tasks',true),'PUT',{title:'Must not partially update',leadId:b.lead.id},task.id);
 assert.equal(response.status,400);assert.equal((await db.task.findUnique({where:{id:task.id}})).title,'Original');
});

test('C5 fix: each corrupt historical relation is hidden independently in list/detail and cannot survive unrelated PUT',async()=>{
 const [a,b]=await fixture(), app=adapter(a);
 for(const kind of ['tasks','os']) {
  const model=kind==='tasks'?'task':'serviceOrder';
  for(const field of kind==='tasks'?['leadId','projectId','assignedToId','createdById']:['projectId','assignedToId','createdById']) {
   const foreign={leadId:b.lead.id,projectId:b.project.id,assignedToId:b.user.id,createdById:b.user.id};
   const row=await db[model].create({data:{organizationId:a.org.id,title:'Bad historical '+randomUUID(),...(kind==='os'?{code:randomUUID()}:{}),[field]:foreign[field]}});
   const detail=await request(app.route(kind,true),'GET',null,row.id);assert.equal(detail.status,404);assert.ok(!(await detail.text()).includes('foreign-'));
   const list=await request(app.route(kind),'GET');assert.equal(list.status,200);assert.ok(!(await list.text()).includes(row.id));
   const edit=await request(app.route(kind,true),'PUT',{title:'Rejected edit'},row.id);assert.equal(edit.status,404);
   assert.equal((await db[model].findUnique({where:{id:row.id}})).title,row.title);
  }
 }
});

test('C5 fix: leads.view enforced on GET, POST, PUT before serialization; unrelated tasks still work',async()=>{
 const [a]=await fixture(), app=adapter(a);
 const linked=await db.task.create({data:{organizationId:a.org.id,title:'Lead-derived sensitive title',leadId:a.lead.id,createdById:a.user.id}});
 await db.user.update({where:{id:a.user.id},data:{permissions:JSON.stringify({...all,leads:{view:false,create:false,edit:false,delete:false}})}});
 assert.equal((await request(app.route('tasks',true),'GET',null,linked.id)).status,404);
 const list=await request(app.route('tasks'),'GET');const text=await list.text();assert.ok(!text.includes(a.lead.id));assert.ok(!text.includes(linked.title));
 assert.equal((await request(app.route('tasks'),'POST',{title:'Denied linked task',leadId:a.lead.id})).status,400);
 assert.equal((await request(app.route('tasks',true),'PUT',{title:'Cannot unlink to reveal',leadId:null},linked.id)).status,404);
 assert.equal((await db.task.findUnique({where:{id:linked.id}})).leadId,a.lead.id);
 assert.equal((await request(app.route('tasks'),'POST',{title:'Unlinked legitimate task'})).status,201);
});

test('C5 fix: same-tenant CRUD, dates, completion, relation clearing and legitimate notifications preserved',async()=>{
 const [a]=await fixture(), app=adapter(a);
 const colleague=await db.user.create({data:{organizationId:a.org.id,email:randomUUID()+'@example.invalid',passwordHash:'not-a-login',name:'Colleague',role:'user',permissions:JSON.stringify(all)}});
 for(const kind of ['tasks','os']) {
  const created=await request(app.route(kind),'POST',{title:'Legitimate',projectId:a.project.id,assignedToId:colleague.id,dueDate:'2026-12-01',...(kind==='tasks'?{leadId:a.lead.id}:{})});
  assert.equal(created.status,201);const body=await created.json();assert.equal(body.project.title,a.project.title);assert.equal(body.assignedTo.id,colleague.id);
  if(kind==='tasks')assert.equal(body.lead.name,a.lead.name);
  assert.ok(await db.notification.count({where:{userId:colleague.id,entityId:body.id}})>0);
  assert.equal((await request(app.route(kind,true),'GET',null,body.id)).status,200);
  const edited=await request(app.route(kind,true),'PUT',{status:kind==='tasks'?'done':'concluida',projectId:null,assignedToId:null,...(kind==='tasks'?{leadId:null}:{})},body.id);
  assert.equal(edited.status,200);const editedBody=await edited.json();assert.ok(editedBody.completedAt);assert.equal(editedBody.projectId,null);assert.equal(editedBody.assignedToId,null);
  assert.equal((await request(app.route(kind,true),'DELETE',null,body.id)).status,200);
 }
});

test('C5 fix: removed assignee rejected; denied recipient receives no task/OS notification or linked Lead title',async()=>{
 const [a]=await fixture(), app=adapter(a);
 const recipient=await db.user.create({data:{organizationId:a.org.id,email:randomUUID()+'@example.invalid',passwordHash:'not-a-login',name:'Restricted recipient',role:'user',permissions:JSON.stringify({...all,leads:{view:false},os:{view:false}})}});
 for(const kind of ['tasks','os']) {
  const response=await request(app.route(kind),'POST',{title:'Sensitive linked title',assignedToId:recipient.id,...(kind==='tasks'?{leadId:a.lead.id,dueDate:'2026-12-01'}:{})});assert.equal(response.status,201);
 }
 assert.equal(await db.notification.count({where:{userId:recipient.id}}),0);
 await db.user.update({where:{id:recipient.id},data:{deletedAt:new Date()}});
 for(const kind of ['tasks','os'])assert.equal((await request(app.route(kind),'POST',{title:'Removed assignee',assignedToId:recipient.id})).status,400);
});

test('C5 fix: task attachments/comments/replies and their counts never cross organization or author boundaries',async()=>{
 const [a,b]=await fixture(), app=adapter(a), task=await db.task.create({data:{organizationId:a.org.id,title:'Safe root',createdById:a.user.id}});
 const parent=await db.comment.create({data:{organizationId:a.org.id,entityType:'task',entityId:task.id,authorId:a.user.id,content:'Own comment'}});
 for(const organizationId of [a.org.id,b.org.id]) {
  await db.comment.create({data:{organizationId,entityType:'task',entityId:task.id,authorId:b.user.id,content:'foreign-comment-marker',parentId:null}});
  await db.comment.create({data:{organizationId,entityType:'task',entityId:task.id,authorId:b.user.id,content:'foreign-reply-marker',parentId:parent.id}});
  await db.attachment.create({data:{organizationId,entityType:'task',entityId:task.id,uploadedById:b.user.id,filename:'foreign-file-marker',originalName:'foreign-file-marker',url:'/foreign-file-marker',mimeType:'text/plain',size:1}});
 }
 const response=await request(app.route('tasks',true),'GET',null,task.id);assert.equal(response.status,200);const text=await response.text();assert.ok(!text.includes('foreign-'));
 const body=JSON.parse(text);assert.equal(body.comments.length,1);assert.equal(body.comments[0].replies.length,0);assert.equal(body._count.comments,1);assert.equal(body._count.attachments,0);
});

test('C5 fix: injected notification failure rolls back real PostgreSQL writes for tasks and OS',async()=>{
 const [a]=await fixture(), recipient=await db.user.create({data:{organizationId:a.org.id,email:randomUUID()+'@example.invalid',passwordHash:'not-a-login',name:'Recipient',role:'owner'}});
 const initial=await counts(a);
 for(const failure of ['notification','activity']) {
  const client=new Proxy(db,{get(target,key){if(key==='$transaction')return callback=>target.$transaction(tx=>callback(new Proxy(tx,{get(t,k){if(k===failure)return {create:async()=>{throw Error('Injected persistence failure');}};return t[k];}})));const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  const app=adapter(a,client);
  for(const kind of failure==='notification'?['tasks','os']:['tasks']) {
   assert.equal((await request(app.route(kind),'POST',{title:'Atomic rollback',assignedToId:recipient.id})).status,500);
   assert.deepEqual(await counts(a),initial);
  }
 }
});

test('C5 fix: PostgreSQL reference SHARE lock prevents concurrent reassignment during commit',async()=>{
 const [a,b]=await fixture(), app=adapter(a);
 let locked;const ready=new Promise(resolve=>{locked=resolve;});let release;const finish=new Promise(resolve=>{release=resolve;});
 const writer=db.$transaction(async tx=>{await app.relations.validateResourceReferences(tx,a.org.id,a.user.id,{leadId:a.lead.id});locked();await finish;await tx.task.create({data:{title:'Validated before commit',organizationId:a.org.id,leadId:a.lead.id,createdById:a.user.id}});});
 await ready;
 // A deterministic PostgreSQL lock timeout proves conflict without relying on timing/sleeps.
 await assert.rejects(db.$transaction(async tx=>{await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '100ms'");await tx.lead.update({where:{id:a.lead.id},data:{organizationId:b.org.id}});}),error=>error.code==='P2010'||error.code==='P2028'||error.message.includes('lock timeout'));
 release();await writer;assert.equal((await db.lead.findUnique({where:{id:a.lead.id}})).organizationId,a.org.id);
});

test('C5 fix: parallel HTTP-shaped PUTs retain valid same-tenant refs and foreign tenant cannot mutate/delete',async()=>{
 const [a,b]=await fixture(), app=adapter(a), foreign=adapter(b);
 for(const kind of ['tasks','os']) {
  const created=await request(app.route(kind),'POST',{title:'Concurrent safe',projectId:a.project.id});assert.equal(created.status,201);const row=await created.json();
  const edits=await Promise.all([request(app.route(kind,true),'PUT',{title:'One'},row.id),request(app.route(kind,true),'PUT',{assignedToId:a.user.id},row.id)]);
  assert.deepEqual(edits.map(result=>result.status),[200,200]);
  assert.equal((await request(foreign.route(kind,true),'PUT',{title:'Foreign'},row.id)).status,404);
  assert.equal((await request(foreign.route(kind,true),'DELETE',null,row.id)).status,404);
  const read=await request(app.route(kind,true),'GET',null,row.id);assert.equal(read.status,200);const body=await read.json();assert.equal(body.title,'One');assert.equal(body.assignedToId,a.user.id);assert.equal(body.projectId,a.project.id);
 }
});
