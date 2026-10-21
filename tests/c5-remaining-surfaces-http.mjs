// Acceptance probe for indirect surfaces. Exit1 means a remaining commercial gap, not PASS.
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
import {randomBytes,randomUUID} from 'node:crypto';
const url=new URL(process.env.DATABASE_URL||'http://invalid');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/mds_crm_dev');
const base=process.env.BLOCK2_TEST_HTTP_ORIGIN||'http://127.0.0.1:3101';assert.equal(new URL(base).hostname,'127.0.0.1');assert.equal(new URL(base).port,'3101');
const db=new PrismaClient(),orgId='00000000-0000-4000-8000-000000000002',results=[];let org;
try{
 const password=randomBytes(24).toString('hex'),passwordHash=await bcrypt.hash(password,10);
 org=await db.organization.create({data:{id:orgId,name:'Remaining surface fixture',slug:'c5-open-'+randomUUID(),features:'["atendimento","vendas","white_label"]',plan:'trial',trialEndsAt:new Date(Date.now()+86400000)}});
 for(const role of ['owner','admin','user']){
  const user=await db.user.create({data:{organizationId:org.id,email:randomUUID()+'@example.invalid',name:role,passwordHash,role,permissions:JSON.stringify(Object.fromEntries(['leads','tasks','projects','settings','atendimento'].map(k=>[k,{view:true,create:true,edit:true,delete:true}])) )}});
  const task=await db.task.create({data:{organizationId:org.id,title:'Own Marketing task',type:'task',createdById:user.id}});
  await db.subtask.create({data:{taskId:task.id,title:'UNCONTRACTED_MARKETING_MARKER',position:0}});
  await db.comment.create({data:{organizationId:org.id,entityType:'task',entityId:task.id,authorId:user.id,content:'UNCONTRACTED_MARKETING_MARKER'}});
  await db.attachment.create({data:{organizationId:org.id,entityType:'task',entityId:task.id,uploadedById:user.id,filename:'UNCONTRACTED_MARKETING_MARKER',originalName:'fixture.txt',url:'/uploads/nonexistent-test-fixture',size:1,mimeType:'text/plain'}});
  const cookies=new Map();const request=async(path,options={})=>{const response=await fetch(base+path,{redirect:'manual',...options,headers:{cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}});for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],n=pair.indexOf('=');cookies.set(pair.slice(0,n),pair.slice(n+1));}return{status:response.status,body:await response.text()};};
  const csrf=JSON.parse((await request('/api/auth/csrf')).body).csrfToken;
  await request('/api/auth/callback/credentials',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:user.email,password,csrfToken:csrf,callbackUrl:base+'/dashboard',json:'true'})});
  assert.equal(JSON.parse((await request('/api/auth/session')).body).user?.id,user.id);
  for(const path of ['/api/comments?entityType=task&entityId='+task.id,'/api/attachments?entityType=task&entityId='+task.id,'/api/tasks/'+task.id+'/subtasks']){
   const response=await request(path);const dataReturned=response.body.includes('UNCONTRACTED_MARKETING_MARKER');results.push({role,url:path.split('?')[0].replace(task.id,'[id]'),status:response.status,dataReturned,passed:[403,404].includes(response.status)&&!dataReturned});
  }
 }
 const passed=results.every(r=>r.passed);console.log(JSON.stringify({kind:'INDIRECT_COMMERCIAL_ACCEPTANCE',results,passed},null,2));if(!passed)process.exitCode=1;
}catch(error){console.error(JSON.stringify({name:error.name,code:error.code||null}));process.exitCode=1;}
finally{if(org){await db.comment.deleteMany({where:{organizationId:org.id}});await db.attachment.deleteMany({where:{organizationId:org.id}});await db.organization.delete({where:{id:org.id}});}await db.$disconnect();}
