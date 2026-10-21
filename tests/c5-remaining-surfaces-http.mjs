// Acceptance probe for indirect surfaces. Exit1 means a remaining commercial gap, not PASS.
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
import {randomBytes,randomUUID} from 'node:crypto';
import {readdir,access} from 'node:fs/promises';
import {join} from 'node:path';
const url=new URL(process.env.DATABASE_URL||'http://invalid');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/mds_crm_dev');
const base=process.env.BLOCK2_TEST_HTTP_ORIGIN||'http://127.0.0.1:3101';assert.equal(new URL(base).hostname,'127.0.0.1');assert.equal(new URL(base).port,'3101');
const db=new PrismaClient(),orgId='00000000-0000-4000-8000-000000000002',results=[],downloadResults=[];let org,foreignOrg;
try{
 const password=randomBytes(24).toString('hex'),passwordHash=await bcrypt.hash(password,10);
 org=await db.organization.create({data:{id:orgId,name:'Remaining surface fixture',slug:'c5-open-'+randomUUID(),features:'["atendimento","vendas","white_label"]',plan:'trial',trialEndsAt:new Date(Date.now()+86400000)}});
 foreignOrg=await db.organization.create({data:{name:'Foreign fixture',slug:'c5-indirect-foreign-'+randomUUID()}});
 const foreignTask=await db.task.create({data:{organizationId:foreignOrg.id,title:'Foreign task'}});
 for(const role of ['owner','admin','user']){
  const user=await db.user.create({data:{organizationId:org.id,email:randomUUID()+'@example.invalid',name:role,passwordHash,role,permissions:JSON.stringify(Object.fromEntries(['leads','tasks','projects','settings','atendimento'].map(k=>[k,{view:true,create:true,edit:true,delete:true}])) )}});
  const task=await db.task.create({data:{organizationId:org.id,title:'Own Marketing task',type:'task',createdById:user.id}});
  const seededSubtask=await db.subtask.create({data:{taskId:task.id,title:'UNCONTRACTED_MARKETING_MARKER',position:0}});
  const seededComment=await db.comment.create({data:{organizationId:org.id,entityType:'task',entityId:task.id,authorId:user.id,content:'UNCONTRACTED_MARKETING_MARKER'}});
  const seededAttachment=await db.attachment.create({data:{organizationId:org.id,entityType:'task',entityId:task.id,uploadedById:user.id,filename:'UNCONTRACTED_MARKETING_MARKER',originalName:'fixture.txt',url:'/uploads/'+orgId+'/lot2-known-file.txt',size:1,mimeType:'text/plain'}});
  const cookies=new Map();const request=async(path,options={})=>{const response=await fetch(base+path,{redirect:'manual',...options,headers:{cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}});for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],n=pair.indexOf('=');cookies.set(pair.slice(0,n),pair.slice(n+1));}return{status:response.status,body:await response.text()};};
  const csrf=JSON.parse((await request('/api/auth/csrf')).body).csrfToken;
  await request('/api/auth/callback/credentials',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:user.email,password,csrfToken:csrf,callbackUrl:base+'/dashboard',json:'true'})});
  assert.equal(JSON.parse((await request('/api/auth/session')).body).user?.id,user.id);
  for(const path of ['/api/comments?entityType=task&entityId='+task.id,'/api/attachments?entityType=task&entityId='+task.id,'/api/tasks/'+task.id+'/subtasks']){
   const response=await request(path);const dataReturned=response.body.includes('UNCONTRACTED_MARKETING_MARKER');results.push({role,url:path.split('?')[0].replace(task.id,'[id]'),status:response.status,dataReturned,passed:[403,404].includes(response.status)&&!dataReturned});
  }

  for(const authenticated of [true,false]){
   const path='/uploads/'+orgId+'/lot2-known-file.txt';
   const response=authenticated?await request(path):await fetch(base+path).then(async r=>({status:r.status,body:await r.text()}));
   const dataReturned=response.body.includes('SYNTHETIC_LEGACY_MARKETING_FILE');
   downloadResults.push({role,authenticated,url:'/uploads/[org]/[file]',status:response.status,dataReturned,passed:[403,404].includes(response.status)&&!dataReturned});
  }
  const jsonRequest=(path,method,data)=>request(path,{method,headers:{'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
  const record=(operation,response,expected)=>{const passed=response.status===expected;results.push({role,operation,status:response.status,expected,passed});assert.ok(passed,operation);};
  const upload=(entityType,entityId)=>{const form=new FormData();form.set('entityType',entityType);form.set('entityId',entityId);form.set('file',new Blob(['SYNTHETIC_FILE_BYTES'],{type:'text/plain'}),'fixture.txt');return request('/api/attachments',{method:'POST',body:form});};
  const filesBefore=await readdir(join(process.cwd(),'public','uploads',org.id));
  const beforeShared=await Promise.all([db.comment.findMany({where:{organizationId:org.id},orderBy:{id:'asc'}}),db.attachment.findMany({where:{organizationId:org.id},orderBy:{id:'asc'}})]);
  record('uncontracted-comment-create',await jsonRequest('/api/comments','POST',{entityType:'task',entityId:task.id,content:'Must not persist'}),403);
  record('uncontracted-comment-update',await jsonRequest('/api/comments/'+seededComment.id,'PUT',{content:'Must not persist'}),403);
  record('uncontracted-comment-delete',await jsonRequest('/api/comments/'+seededComment.id,'DELETE'),403);
  record('uncontracted-attachment-create',await upload('task',task.id),403);
  record('uncontracted-comment-attachment-create',await upload('comment',seededComment.id),403);
  record('uncontracted-attachment-delete',await jsonRequest('/api/attachments/'+seededAttachment.id,'DELETE'),403);
  assert.deepEqual(await Promise.all([db.comment.findMany({where:{organizationId:org.id},orderBy:{id:'asc'}}),db.attachment.findMany({where:{organizationId:org.id},orderBy:{id:'asc'}})]),beforeShared);
  assert.deepEqual(await readdir(join(process.cwd(),'public','uploads',org.id)),filesBefore,'Denied uploads must create no files');
  record('foreign-comment-create',await jsonRequest('/api/comments','POST',{entityType:'task',entityId:foreignTask.id,content:'Must not persist'}),404);
  record('foreign-attachment-create',await upload('task',foreignTask.id),404);
  const before=await db.subtask.findMany({where:{taskId:task.id},orderBy:{id:'asc'}});
  record('uncontracted-subtask-create',await jsonRequest('/api/tasks/'+task.id+'/subtasks','POST',{title:'Must not persist'}),403);
  record('uncontracted-subtask-update',await jsonRequest('/api/tasks/'+task.id+'/subtasks/'+seededSubtask.id,'PUT',{title:'Must not persist'}),403);
  record('uncontracted-subtask-delete',await jsonRequest('/api/tasks/'+task.id+'/subtasks/'+seededSubtask.id,'DELETE'),403);
  assert.deepEqual(await db.subtask.findMany({where:{taskId:task.id},orderBy:{id:'asc'}}),before);
  const lead=await db.lead.create({data:{organizationId:org.id,name:'Own Sales lead'}});
  const follow=await db.task.create({data:{organizationId:org.id,type:'follow_up',title:'Own Sales follow-up',leadId:lead.id,createdById:user.id}});
  const created=await jsonRequest('/api/tasks/'+follow.id+'/subtasks','POST',{title:'Legitimate Sales subtask'});record('contracted-subtask-create',created,201);const child=JSON.parse(created.body);
  const read=await request('/api/tasks/'+follow.id+'/subtasks');record('contracted-subtask-read',read,200);assert.ok(read.body.includes(child.id));
  const updated=await jsonRequest('/api/tasks/'+follow.id+'/subtasks/'+child.id,'PUT',{title:'Updated Sales subtask',completed:true});record('contracted-subtask-update',updated,200);assert.equal((await db.subtask.findUnique({where:{id:child.id}})).title,'Updated Sales subtask');
  for(const [method,path,data] of [['GET','/api/tasks/'+foreignTask.id+'/subtasks'],['POST','/api/tasks/'+foreignTask.id+'/subtasks',{title:'Must not persist'}],['PUT','/api/tasks/'+foreignTask.id+'/subtasks/'+child.id,{title:'Must not persist'}],['DELETE','/api/tasks/'+foreignTask.id+'/subtasks/'+child.id]])record('foreign-parent-'+method,await jsonRequest(path,method,data),404);
  assert.equal(await db.subtask.count({where:{taskId:foreignTask.id}}),0);assert.ok(await db.subtask.findUnique({where:{id:child.id}}));
  record('contracted-subtask-delete',await jsonRequest('/api/tasks/'+follow.id+'/subtasks/'+child.id,'DELETE'),200);assert.equal(await db.subtask.count({where:{id:child.id}}),0);
  const goal=await db.goal.create({data:{organizationId:org.id,title:'Sales goal',createdById:user.id}});
  for(const [entityType,entityId]of[['task',follow.id],['lead',lead.id],['goal',goal.id]]){
   const root=await jsonRequest('/api/comments','POST',{entityType,entityId,content:'Legitimate Sales comment'});record('sales-'+entityType+'-comment-create',root,201);const comment=JSON.parse(root.body);
   record('sales-'+entityType+'-reply-create',await jsonRequest('/api/comments','POST',{entityType,entityId,parentId:comment.id,content:'Legitimate Sales reply'}),201);
   const read=await request('/api/comments?entityType='+entityType+'&entityId='+entityId);record('sales-'+entityType+'-comment-read',read,200);assert.ok(read.body.includes(comment.id));
   record('sales-'+entityType+'-comment-update',await jsonRequest('/api/comments/'+comment.id,'PUT',{content:'Updated Sales comment'}),200);
   for(const [kind,id]of[[entityType,entityId],['comment',comment.id]]){const uploaded=await upload(kind,id);record('sales-'+kind+'-upload',uploaded,201);const attachment=JSON.parse(uploaded.body);await access(join(process.cwd(),'public',attachment.url));const read=await request('/api/attachments?entityType='+kind+'&entityId='+id);record('sales-'+kind+'-attachment-read',read,200);assert.ok(read.body.includes(attachment.id));record('sales-'+kind+'-attachment-delete',await jsonRequest('/api/attachments/'+attachment.id,'DELETE'),200);assert.equal(await db.attachment.count({where:{id:attachment.id}}),0);await assert.rejects(access(join(process.cwd(),'public',attachment.url)));}
   record('sales-'+entityType+'-comment-delete',await jsonRequest('/api/comments/'+comment.id,'DELETE'),200);assert.equal(await db.comment.count({where:{OR:[{id:comment.id},{parentId:comment.id}]}}),0);
  }
  for(let mask=1;mask<8;mask++)for(const whiteLabel of [false,true]){
   const modules=['atendimento','vendas','marketing'].filter((_,i)=>mask&(1<<i));
   await db.organization.update({where:{id:org.id},data:{features:JSON.stringify([...modules,...(whiteLabel?['white_label']:[])])}});
   for(const type of ['task','follow_up']){
    const parent=await db.task.create({data:{organizationId:org.id,title:'Matrix '+type,type,createdById:user.id}});
    const seed=await db.subtask.create({data:{taskId:parent.id,title:'Matrix seeded child',position:0}});
    const contracted=modules.includes(type==='follow_up'?'vendas':'marketing'),prefix='matrix-'+mask+'-'+whiteLabel+'-'+type+'-';
    const path='/api/tasks/'+parent.id+'/subtasks';
    record(prefix+'read',await request(path),contracted?200:403);
    const create=await jsonRequest(path,'POST',{title:'Matrix new child'});record(prefix+'create',create,contracted?201:403);
    record(prefix+'update',await jsonRequest(path+'/'+seed.id,'PUT',{title:'Matrix updated child'}),contracted?200:403);
    record(prefix+'delete',await jsonRequest(path+'/'+seed.id,'DELETE'),contracted?200:403);
    const seedComment=await db.comment.create({data:{organizationId:org.id,entityType:'task',entityId:parent.id,authorId:user.id,content:'Matrix comment'}});
    const seedAttachment=await db.attachment.create({data:{organizationId:org.id,entityType:'task',entityId:parent.id,uploadedById:user.id,filename:'fixture.txt',originalName:'fixture.txt',url:'/uploads/nonexistent-test-fixture',size:1,mimeType:'text/plain'}});
    record(prefix+'comment-read',await request('/api/comments?entityType=task&entityId='+parent.id),contracted?200:403);
    record(prefix+'comment-create',await jsonRequest('/api/comments','POST',{entityType:'task',entityId:parent.id,content:'Matrix created comment'}),contracted?201:403);
    record(prefix+'comment-update',await jsonRequest('/api/comments/'+seedComment.id,'PUT',{content:'Matrix updated comment'}),contracted?200:403);
    record(prefix+'comment-delete',await jsonRequest('/api/comments/'+seedComment.id,'DELETE'),contracted?200:403);
    record(prefix+'attachment-read',await request('/api/attachments?entityType=task&entityId='+parent.id),contracted?200:403);
    const file=await upload('task',parent.id);record(prefix+'attachment-create',file,contracted?201:403);
    const attachmentId=contracted?JSON.parse(file.body).id:seedAttachment.id;
    record(prefix+'attachment-delete',await jsonRequest('/api/attachments/'+attachmentId,'DELETE'),contracted?200:403);
    if(!contracted){assert.equal((await db.comment.findUnique({where:{id:seedComment.id}})).content,'Matrix comment');assert.equal(await db.comment.count({where:{organizationId:org.id,entityId:parent.id}}),1);assert.equal(await db.attachment.count({where:{organizationId:org.id,entityId:parent.id}}),1);}
    if(contracted){assert.equal(await db.subtask.count({where:{id:seed.id}}),0);assert.equal(await db.subtask.count({where:{taskId:parent.id}}),1);}else{assert.equal(await db.subtask.count({where:{taskId:parent.id}}),1);assert.equal((await db.subtask.findUnique({where:{id:seed.id}})).title,'Matrix seeded child');}
   }
  }
  await db.organization.update({where:{id:org.id},data:{features:'["atendimento","vendas","white_label"]'}});

 }
 const passed=results.every(r=>r.passed)&&downloadResults.every(r=>r.passed);console.log(JSON.stringify({kind:'INDIRECT_COMMERCIAL_ACCEPTANCE',results,downloadResults,passed},null,2));if(!passed)process.exitCode=1;
}catch(error){console.error(JSON.stringify({name:error.name,code:error.code||null}));process.exitCode=1;}
finally{if(org){await db.comment.deleteMany({where:{organizationId:org.id}});await db.attachment.deleteMany({where:{organizationId:org.id}});await db.organization.delete({where:{id:org.id}});}if(foreignOrg)await db.organization.delete({where:{id:foreignOrg.id}});await db.$disconnect();}
