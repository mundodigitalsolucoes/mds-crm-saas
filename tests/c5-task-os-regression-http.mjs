// Real NextAuth + HTTP + disposable PostgreSQL positive and negative regressions.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
const url=new URL(process.env.DATABASE_URL||'http://invalid');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'5432');assert.equal(url.pathname,'/mds_crm_dev');
const db=new PrismaClient(),base='http://127.0.0.1:3100',orgs=[],results=[];
class Client {
  cookies = new Map();
  constructor(ip) { this.ip = ip; }
  async request(path, options = {}) {
    const response = await fetch(base + path, { redirect: 'manual', ...options, headers: {
      'x-forwarded-for': this.ip, cookie: [...this.cookies].map(([k, v]) => k + '=' + v).join('; '), ...options.headers,
    } });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], index = pair.indexOf('='); this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return { status: response.status, location: response.headers.get('location'), body: await response.text() };
  }
  json(path, method, data) { return this.request(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }); }
  async login(user, password) {
    const csrfToken = JSON.parse((await this.request('/api/auth/csrf')).body).csrfToken;
    await this.request('/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: user.email, password, csrfToken, callbackUrl: base + '/dashboard', json: 'true' }) });
    assert.equal(JSON.parse((await this.request('/api/auth/session')).body).user?.id, user.id);
  }
}
try {
 const password=crypto.randomBytes(24).toString('hex'),passwordHash=await bcrypt.hash(password,10);
 const all=Object.fromEntries(['leads','tasks','projects','os','agenda','kanban','reports','goals','integrations','settings','users','atendimento'].map(key=>[key,{view:true,create:true,edit:true,delete:true}]));
 for(const tenant of ['a','b']) {
  const org=await db.organization.create({data:{name:'C5 HTTP positive',slug:'c5-positive-'+crypto.randomUUID(),plan:'trial',trialEndsAt:new Date(Date.now()+86400000),maxOs:100,features:'["atendimento","vendas","marketing"]'}});orgs.push(org);
  for(const [index,role] of ['owner','admin','user'].entries()) {
   const user=await db.user.create({data:{organizationId:org.id,name:'Positive user',email:crypto.randomUUID()+'@example.invalid',passwordHash,role,permissions:JSON.stringify(all)}});
   const client=new Client(`198.51.100.${200+(tenant==='a'?0:3)+index}`);await client.login(user,password);
   const lead=await db.lead.create({data:{organizationId:org.id,name:'Own authorized lead'}});
   const project=await db.marketingProject.create({data:{organizationId:org.id,title:'Own authorized project',ownerId:user.id}});
   for(const kind of ['tasks','os']) {
    const create=await client.json('/api/'+kind,'POST',{title:'Legitimate same-tenant '+kind,projectId:project.id,assignedToId:user.id,...(kind==='tasks'?{leadId:lead.id,dueDate:'2026-12-01'}:{})});
    assert.equal(create.status,201);const row=JSON.parse(create.body);assert.equal(row.project.id,project.id);assert.equal(row.assignedTo.id,user.id);if(kind==='tasks')assert.equal(row.lead.id,lead.id);
    const read=await client.request('/api/'+kind+'/'+row.id);assert.equal(read.status,200);assert.equal(JSON.parse(read.body).organizationId,org.id);
    const edit=await client.json('/api/'+kind+'/'+row.id,'PUT',{title:'Updated legitimate '+kind,status:kind==='tasks'?'done':'concluida',projectId:null,assignedToId:null,...(kind==='tasks'?{leadId:null}:{})});assert.equal(edit.status,200);assert.ok(JSON.parse(edit.body).completedAt);
    const remove=await client.request('/api/'+kind+'/'+row.id,{method:'DELETE'});assert.equal(remove.status,200);
    results.push({tenant,role,kind,create:create.status,read:read.status,update:edit.status,delete:remove.status,sameTenant:true});
   }
   if(role==='user') {
    const task=await db.task.create({data:{organizationId:org.id,title:'Secret linked task',leadId:lead.id,createdById:user.id}});
    await db.user.update({where:{id:user.id},data:{permissions:JSON.stringify({...all,leads:{view:false,create:false,edit:false,delete:false}})}});
    const detail=await client.request('/api/tasks/'+task.id),unlink=await client.json('/api/tasks/'+task.id,'PUT',{leadId:null});
    assert.equal(detail.status,404);assert.equal(unlink.status,404);assert.ok(!detail.body.includes(lead.name));assert.equal((await db.task.findUnique({where:{id:task.id}})).leadId,lead.id);
    results.push({tenant,role,kind:'leads-permission',detail:detail.status,unlink:unlink.status,noExposure:true});
   }
  }
 }
 console.log(JSON.stringify({cases:results.length,results,passed:true},null,2));
} catch(error) {console.error(error instanceof assert.AssertionError?error.message:JSON.stringify({name:error.name,code:error.code||null}));process.exitCode=1;}
finally {
 const ids=orgs.map(org=>org.id),users=await db.user.findMany({where:{organizationId:{in:ids}},select:{id:true}});
 await db.activity.deleteMany({where:{userId:{in:users.map(user=>user.id)}}});
 for(const org of orgs)await db.organization.delete({where:{id:org.id}});
 await db.$disconnect();
}
