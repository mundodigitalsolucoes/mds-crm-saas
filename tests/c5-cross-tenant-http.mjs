// Security acceptance probe. Exit 1 means a confirmed cross-tenant vulnerability, never TODO.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '5432'); assert.equal(url.pathname, '/mds_crm_dev');
const db = new PrismaClient(), base = 'http://127.0.0.1:3100', orgs = [], results = [];
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
 const suffix=crypto.randomUUID(), password=crypto.randomBytes(24).toString('hex'), passwordHash=await bcrypt.hash(password,10);
 for(const label of ['a','b'])orgs.push(await db.organization.create({data:{name:'C5 security fixture',slug:`c5-security-${label}-${suffix}`,plan:'trial',trialEndsAt:new Date(Date.now()+86400000),features:'["atendimento","vendas","marketing"]',maxOs:100}}));
 const b=await db.user.create({data:{name:'foreign-user-marker',organizationId:orgs[1].id,email:`foreign-${suffix}@example.invalid`,passwordHash,role:'owner'}});
 const lead=await db.lead.create({data:{name:'foreign-lead-marker',organizationId:orgs[1].id}});
 const project=await db.marketingProject.create({data:{title:'foreign-project-marker',organizationId:orgs[1].id,ownerId:b.id}});
 for(const [i,role] of ['owner','admin','user'].entries()) {
  const permissions=Object.fromEntries(['leads','tasks','projects','os','agenda','kanban','reports','goals','integrations','settings','users','atendimento'].map(resource=>[resource,{view:true,create:true,edit:true,delete:true}]));
  const a=await db.user.create({data:{name:'Own fixture',organizationId:orgs[0].id,email:`${role}-${suffix}@example.invalid`,passwordHash,role,permissions:JSON.stringify(permissions)}});
  const client=new Client(`198.51.100.${170+i}`);await client.login(a,password);
  const task=await db.task.create({data:{title:'Own task',organizationId:orgs[0].id,createdById:a.id}});
  const os=await db.serviceOrder.create({data:{title:'Own OS',organizationId:orgs[0].id,code:'C5-'+i,createdById:a.id}});
  for(const [route,model,own,fields] of [['tasks','task',task,{leadId:lead.id,projectId:project.id,assignedToId:b.id}],['os','serviceOrder',os,{projectId:project.id,assignedToId:b.id}]]) {
   for(const method of ['POST','PUT'])for(const [field,value] of Object.entries(fields)) {
    await db[model].update({where:{id:own.id},data:{projectId:null,assignedToId:a.id,...(route==='tasks'?{leadId:null}:{})}});
    const response=await client.json('/api/'+route+(method==='PUT'?'/'+own.id:''),method,{title:'Synthetic cross-tenant probe',[field]:value});
    let body;try{body=JSON.parse(response.body)}catch{body={}}
    const row=body.id?await db[model].findUnique({where:{id:body.id}}):null;
    const passed=[400,403,404].includes(response.status)&&(!row||row[field]!==value);
    results.push({role,url:'/api/'+route+(method==='PUT'?'/[id]':''),method,field,status:response.status,foreignRelationStored:row?.[field]===value,foreignMarkerReturned:response.body.includes('foreign-'),secureExpectationPassed:passed});
   }
   // Also model persisted malformed legacy links: fixing writes alone is insufficient.
   await db[model].update({where:{id:own.id},data:{projectId:project.id,assignedToId:b.id,...(route==='tasks'?{leadId:lead.id}:{})}});
   for(const path of ['/api/'+route,'/api/'+route+'/'+own.id]) {
    const response=await client.request(path);
    const exposed=response.body.includes('foreign-');
    results.push({role,url:path.endsWith(own.id)?'/api/'+route+'/[id]':'/api/'+route,method:'GET',field:'persisted-foreign-links',status:response.status,foreignRelationStored:null,foreignMarkerReturned:exposed,secureExpectationPassed:!exposed});
   }
  }
 }
 const foreignNotificationsCreated=await db.notification.count({where:{userId:b.id}});
 const passed=results.every(row=>row.secureExpectationPassed)&&foreignNotificationsCreated===0;
 console.log(JSON.stringify({referenceHead:'5f0f8a9',kind:'SECURITY_ACCEPTANCE_NOT_A_SUCCESS_BASELINE',results,foreignNotificationsCreated,passed},null,2));
 if(!passed)process.exitCode=1;
} catch(error) {console.error(error instanceof assert.AssertionError?error.message:JSON.stringify({name:error.name,code:error.code||null}));process.exitCode=1;}
finally {
 if(orgs.length) {
  const organizationIds=orgs.map(org=>org.id);
  const users=await db.user.findMany({where:{organizationId:{in:organizationIds}},select:{id:true}});
  const tasks=await db.task.findMany({where:{organizationId:{in:organizationIds}},select:{id:true}});
  await db.activity.deleteMany({where:{OR:[{entityId:{in:[...organizationIds,...tasks.map(task=>task.id)]}},{userId:{in:users.map(user=>user.id)}}]}});
 }
 for(const org of orgs)await db.organization.delete({where:{id:org.id}});
 await db.$disconnect();
}
