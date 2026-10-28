import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server.js';
import * as permissions from '../src/lib/permissions.ts';
import * as policy from '../src/lib/authorization/policy.ts';
import { createModuleAuthorizer } from '../src/lib/authorization/authorize.ts';
import * as validation from '../src/lib/validations/index.ts';
import { disposableDatabaseUrl, loadHandler } from './helpers/load-disposable-handler.mjs';
let db;
const orgs = [];
before(() => { db = new PrismaClient({ datasources: { db: { url: disposableDatabaseUrl() } } }); });
after(async () => { if (db) { for (const org of orgs) await db.organization.delete({ where: { id: org.id } }); await db.$disconnect(); } });
const resources = ['leads', 'kanban', 'projects', 'tasks', 'os', 'agenda', 'goals', 'reports', 'integrations', 'settings', 'users', 'atendimento'];
const pairs = [['vendas', 'leads'], ['vendas', 'kanban'], ['marketing', 'projects'], ['atendimento', 'atendimento'], ['marketing','tasks'], ['marketing','os'], ['marketing','reports'], ['vendas','tasks']];
async function fixture(label) {
 const org = await db.organization.create({ data: { name: 'C5 guard fixture', slug: 'c5-guard-' + label + randomUUID(), features: '[]', plan: 'trial', trialEndsAt: new Date(Date.now()+86400000) } }); orgs.push(org);
 const user = await db.user.create({ data: { organizationId: org.id, name: 'Fixture', email: randomUUID()+'@example.invalid', passwordHash: 'not-a-login', role: 'user', permissions: JSON.stringify(Object.fromEntries(resources.map(resource=>[resource,{view:true,create:true,edit:true,delete:true}])))} });
 return { org, user, session: { user: { id: user.id, organizationId: org.id, role: 'forged-owner' } } };
}
function adapter(f, mode) {
 const legacy = loadHandler('src/lib/checkPermission.ts', { 'next/server': { NextResponse }, 'next-auth': { getServerSession: async()=>f.session }, '@/lib/auth': { authOptions:{} }, '@/lib/prisma': { prisma:db }, '@/lib/permissions':permissions });
 const authorize = createModuleAuthorizer({ session:async()=>f.session, readUser:id=>db.user.findUnique({where:{id},include:{organization:true}}) });
 const guards=loadHandler('src/lib/authorization/guards.ts', { 'next/server':{NextResponse}, '../checkPermission':legacy, './policy':{...policy,modeForOrganization:()=>mode}, './server':{evaluateModuleAccess:async request=>policy.authorizationEffect(await authorize(request),mode)} },{console:{info(){}}});
 return { ...guards, authorize };
}
test('C5: seven contracts × both brands × three DB roles × two tenants × eight audited resources × four actions',async()=>{
 const fixtures=await Promise.all(['a','b'].map(fixture));let comparisons=0;
 for(let mask=1;mask<8;mask++)for(const whiteLabel of [false,true])for(const role of ['owner','admin','user'])for(const f of fixtures){
  const modules=['atendimento','vendas','marketing'].filter((_,i)=>mask&(1<<i));
  await db.organization.update({where:{id:f.org.id},data:{features:JSON.stringify([...modules,...(whiteLabel?['white_label']:[])])}});
  await db.user.update({where:{id:f.user.id},data:{role}});
  const enforce=adapter(f,'enforce'),observe=adapter(f,'observe_only');
  for(const [module,permission] of pairs)for(const action of ['view','create','edit','delete']){
   const request={module,permission,action};
   assert.equal((await observe.checkModulePermission(request)).allowed,true);
   const result=await enforce.checkModulePermission(request);
   assert.equal(result.allowed,modules.includes(module));
   if(!result.allowed){assert.equal(result.errorResponse.status,403);assert.equal((await result.errorResponse.json()).code,'module_not_contracted');}
   assert.equal(policy.modeForOrganization(f.org.id),'observe_only');comparisons++;
  }
 }
 assert.equal(comparisons,2688);
});
test('C5: real API entry points stop before database/provider access in isolated enforce mode',async()=>{
 const f=await fixture('handlers');const guards=adapter(f,'enforce');let resourceAccess=0;
 const forbidden=new Proxy({}, {get(){resourceAccess++;throw Error('Resource/provider touched');}});
 const imports={ 'next/server':{NextResponse}, '@/lib/authorization/guards':guards, '@/lib/prisma':{prisma:forbidden}, '@/lib/validations':validation,
  '@/lib/rate-limit':{applyRateLimit:()=>null,API_RATE_LIMIT:{}}, '@/lib/checkLimits':{}, '@/lib/notify':{}, '@/lib/leads/tenant-relations':{}, '@/lib/chatwoot':forbidden };
 const cases=[['projects',['GET','POST']],['projects/[id]',['GET','PUT','DELETE']],['leads',['GET','POST']],['leads/[id]',['GET','PUT','DELETE']],['kanban/stages',['GET','POST']],['kanban/stages/[key]',['PUT','DELETE']],['atendimento/equipes',['GET','POST']],['integrations/chatwoot/credentials',['GET']]];
 let count=0;
 for(const [path,methods] of cases){
  const handler=loadHandler(`src/app/api/${path}/route.ts`,imports,{console:{error(){},info(){}},fetch:()=>{resourceAccess++;throw Error('Network touched');}});
  for(const method of methods){const response=await handler[method](new NextRequest('http://localhost/api/test?mode=enforce',{method,...(method!=='GET'?{body:'{}',headers:{'content-type':'application/json'}}:{})}),{params:Promise.resolve({id:randomUUID(),key:'new'})});assert.equal(response.status,403,`${method} ${path}`);count++;}
 }
 assert.equal(resourceAccess,0);assert.equal(count,17);
});
test('C5: identity, permissions and tenant are effective in observe_only, regardless of commercial availability',async()=>{
 for(const state of ['anonymous','removed-user','removed-org','foreign-session','denied-permission']){
  const f=await fixture(state);
  await db.organization.update({where:{id:f.org.id},data:{features:'["atendimento","vendas","marketing"]'}});
  if(state==='anonymous')f.session=null;
  if(state==='removed-user')await db.user.update({where:{id:f.user.id},data:{deletedAt:new Date()}});
  if(state==='removed-org')await db.organization.update({where:{id:f.org.id},data:{deletedAt:new Date()}});
  if(state==='foreign-session')f.session.user.organizationId=randomUUID();
  if(state==='denied-permission')await db.user.update({where:{id:f.user.id},data:{permissions:JSON.stringify(Object.fromEntries(resources.map(resource=>[resource,{view:false,create:false,edit:false,delete:false}])))} });
  for(const [module,permission] of pairs){const result=await adapter(f,'observe_only').checkModulePermission({module,permission,action:'view'});assert.equal(result.allowed,false,state);assert.ok([401,403].includes(result.errorResponse.status));}
 }
});
test('C5 legacy diagnostics: no Plan fallback; valid partial permission records remain compatible',async()=>{
 const f=await fixture('legacy');
 for(const features of ['[]','{invalid','["white_label"]','["financeiro"]']){
  await db.organization.update({where:{id:f.org.id},data:{plan:'enterprise',features}});
  assert.equal((await adapter(f,'observe_only').checkModulePermission({module:'vendas',permission:'leads',action:'view'})).allowed,true);
  const denied=await adapter(f,'enforce').authorize({module:'vendas',permission:'leads',action:'view'});assert.equal(denied.reason,'module_not_contracted');
 }
 await db.organization.update({where:{id:f.org.id},data:{features:'["atendimento"]'}});
 await db.user.update({where:{id:f.user.id},data:{permissions:'{"atendimento":{"view":true,"create":true,"edit":true,"delete":true}}'}});
 assert.equal((await adapter(f,'observe_only').checkModulePermission({module:'atendimento',permission:'atendimento',action:'view'})).allowed,true);
 const decision=await adapter(f,'enforce').authorize({module:'atendimento',permission:'atendimento',action:'view'});
 // C5-04 fixes the documented blocker; a valid Atendimento-only record is legitimate.
 assert.equal(decision.allowed,true);
 for(const action of ['create','edit','delete'])assert.equal((await adapter(f,'enforce').checkModulePermission({module:'atendimento',permission:'atendimento',action})).allowed,true);
});
test('C5: audited task/OS/report pairs work; unaudited pairs and inactive subscriptions remain denied',async()=>{
 const f=await fixture('shared');
 await db.organization.update({where:{id:f.org.id},data:{features:'["marketing","vendas","atendimento"]'}});
 for(const permission of ['tasks','os','reports'])assert.equal((await adapter(f,'enforce').authorize({module:'marketing',permission,action:'view'})).allowed,true);
 for(const [module,permission] of [['vendas','atendimento'],['marketing','integrations'],['atendimento','leads']]){
  const decision=await adapter(f,'enforce').authorize({module,permission,action:'view'});
  assert.equal(decision.reason,'insufficient_permission','Unsupported pairs must not be mistaken for rollout coverage');
 }
 await db.organization.update({where:{id:f.org.id},data:{trialEndsAt:new Date(Date.now()-86400000)}});
 const request={module:'marketing',permission:'projects',action:'view'};
 assert.equal((await adapter(f,'observe_only').checkModulePermission(request)).allowed,true);
 assert.equal((await adapter(f,'enforce').authorize(request)).reason,'inactive_subscription');
});
