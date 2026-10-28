// Security acceptance probe. Exit 1 means a confirmed cross-tenant vulnerability, never TODO.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '5432'); assert.equal(url.pathname, '/mds_crm_dev');
const base=process.env.BLOCK2_TEST_HTTP_ORIGIN||'http://127.0.0.1:3100';
assert.equal(new URL(base).hostname,'127.0.0.1');assert.ok(['3100','3101'].includes(new URL(base).port));
const db = new PrismaClient(), orgs = [], results = [];
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
const isolatedBlocking=process.argv.includes('--require-commercial-blocking');
let pilotContractPassed=true;
try {
 const password=crypto.randomBytes(24).toString('hex'),passwordHash=await bcrypt.hash(password,10),fixtures=[];
 const permissions=Object.fromEntries(['leads','tasks','projects','os','agenda','kanban','reports','goals','integrations','settings','users','atendimento'].map(k=>[k,{view:true,create:true,edit:true,delete:true}]));
 for(const [i,kind] of ['mds','pilot'].entries()){
  const brand={logo:'/images/logo-fundo-escuro.png?pilot-fixture=1',favicon:'/images/favicon.png?pilot-fixture=1',primaryColor:'#124578',secondaryColor:'#357924'};
  const org=await db.organization.create({data:{...(isolatedBlocking?{id:kind==='pilot'?'00000000-0000-4000-8000-000000000002':'00000000-0000-4000-8000-000000000001'}:{}),name:'Fictitious '+kind,slug:'pilot-final-'+crypto.randomUUID(),plan:'trial',trialEndsAt:new Date(Date.now()+86400000),features:JSON.stringify(kind==='mds'?['atendimento','vendas','marketing']:['atendimento','vendas','white_label']),...brand}});orgs.push(org);
  const clients=[];
  for(const [j,role] of ['owner','admin','user'].entries()){
   const p=Object.fromEntries(Object.entries(permissions).map(([k,v])=>[k,{...v,...(role==='user'?{create:false,edit:false,delete:false}:{})}]));
   const user=await db.user.create({data:{organizationId:org.id,name:role,email:crypto.randomUUID()+'@example.invalid',passwordHash,role,permissions:JSON.stringify(p)}});
   const client=new Client('198.51.100.'+(110+i*5+j));await client.login(user,password);clients.push({user,client,role});
  }
  const marker='own-'+kind+'-'+crypto.randomUUID();
  await db.leadPipelineStage.create({data:{organizationId:org.id,key:'new',title:marker+'-stage'}});
  const lead=await db.lead.create({data:{organizationId:org.id,name:marker,createdById:clients[0].user.id}});
  const project=await db.marketingProject.create({data:{organizationId:org.id,title:marker+'-project',ownerId:clients[0].user.id}});
  const task=await db.task.create({data:{organizationId:org.id,title:marker+'-task',createdById:clients[0].user.id}});
  const follow=await db.task.create({data:{organizationId:org.id,title:marker+'-follow',type:'follow_up',leadId:lead.id,createdById:clients[0].user.id}});
  fixtures.push({org,brand,clients,marker,lead,project,task,follow,kind});
 }
 for(const f of fixtures){
  const other=fixtures.find(o=>o!==f),before=JSON.stringify(await Promise.all([db.lead.findUnique({where:{id:f.lead.id}}),db.marketingProject.findUnique({where:{id:f.project.id}}),db.task.findUnique({where:{id:f.task.id}})]));
  for(const {user,client,role} of f.clients){
   const dashboard=await client.request('/dashboard');assert.equal(dashboard.status,200);assert.ok(!dashboard.body.includes(other.marker));
   assert.ok(dashboard.body.includes('Total Leads'));assert.equal(dashboard.body.includes('Projetos Ativos'),f.kind==='mds');
   assert.ok(dashboard.body.includes('--color-primary: '+(f.kind==='pilot'?f.brand.primaryColor:'#2f3453')));
   assert.ok(dashboard.body.includes('href="'+(f.kind==='pilot'?f.brand.favicon:'/favicon.ico')+'"'));
   if(f.kind==='mds')assert.ok(!dashboard.body.includes(f.brand.logo));else assert.ok(dashboard.body.includes(f.brand.logo));
   const brandingAsset=await client.request(f.kind==='pilot'?f.brand.favicon:'/favicon.ico');if(f.kind==='pilot')assert.equal(brandingAsset.status,200);
   const operations=[];
   for(const path of ['/leads','/kanban','/atendimento','/api/leads','/api/kanban/stages','/api/atendimento/widget','/projects','/tasks','/os','/reports','/api/projects','/api/tasks','/api/os']){
    const response=await client.request(path);for(const foreign of [other.marker,other.org.id,other.lead.id,other.project.id,other.task.id])assert.ok(!response.body.includes(foreign));
    const marketing=['/projects','/tasks','/os','/reports','/api/projects','/api/tasks','/api/os'].includes(path);
    const contracted=f.kind==='mds'||!marketing,contractSatisfied=contracted||[403,404].includes(response.status);
    if(isolatedBlocking&&!contracted)assert.ok([403,404].includes(response.status),path+' must block uncontracted Marketing');else assert.equal(response.status,200,path);
    if(!contractSatisfied)pilotContractPassed=false;
    operations.push({url:path,status:response.status,contracted,contractSatisfied,ownProjectDataReturned:path==='/api/projects'&&response.body.includes(f.project.title)});
   }
   const follows=await client.request('/api/tasks?type=follow_up');assert.equal(follows.status,200);assert.ok(follows.body.includes(f.follow.title));assert.ok(!follows.body.includes(f.task.title));assert.ok(!follows.body.includes(other.marker));
   for(const [resource,id] of [['leads',other.lead.id],['projects',other.project.id]]){
    const response=await client.request('/api/'+resource+'/'+id);assert.ok([403,404].includes(response.status));for(const foreign of [other.marker,other.org.id,other.lead.id,other.project.id,other.task.id])assert.ok(!response.body.includes(foreign));
    operations.push({url:'/api/'+resource+'/[foreign-id]',status:response.status,crossTenantDenied:true});
   }
   const crossWrite=await client.json('/api/projects/'+other.project.id,'PUT',{title:'Must never persist'});assert.ok([403,404].includes(crossWrite.status));assert.equal((await db.marketingProject.findUnique({where:{id:other.project.id}})).title,other.project.title);
   if(role==='user'){
    const denied=await client.json('/api/projects/'+f.project.id,'PUT',{title:'Must never persist'});assert.equal(denied.status,403);
    await db.user.update({where:{id:user.id},data:{permissions:JSON.stringify({...permissions,leads:{view:false,create:false,edit:false,delete:false}})}});
    assert.equal((await client.request('/api/leads')).status,403);
    const restricted=await client.request('/dashboard');assert.equal(restricted.status,200);assert.ok(!restricted.body.includes(f.lead.name));assert.ok(!restricted.body.includes('Total Leads'));
   }
   results.push({organization:f.kind,role,dashboard:dashboard.status,whiteLabel:f.kind==='pilot',brandingAssetStatus:brandingAsset.status,operationalChecksPassed:true,operations});
  }
  const after=JSON.stringify(await Promise.all([db.lead.findUnique({where:{id:f.lead.id}}),db.marketingProject.findUnique({where:{id:f.project.id}}),db.task.findUnique({where:{id:f.task.id}})]));assert.equal(after,before,'Root data unchanged');
 }
 console.log(JSON.stringify({kind:'PILOT_CONTRACT_ACCEPTANCE',organizations:2,roles:['owner','admin','user'],results,operationalBaselinePassed:true,pilotContractPassed,commercialEnforcementActivated:false,isolatedBlockingExpected:isolatedBlocking},null,2));
 if(!pilotContractPassed)process.exitCode=1;
}catch(error){console.error(error instanceof assert.AssertionError?error.message:JSON.stringify({name:error.name,code:error.code||null}));process.exitCode=1;}
finally{for(const org of orgs)await db.organization.delete({where:{id:org.id}});await db.$disconnect();}
