import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {NextResponse} from 'next/server.js';
import * as permissions from '../src/lib/permissions.ts';
import {createModuleAuthorizer} from '../src/lib/authorization/authorize.ts';
import * as policy from '../src/lib/authorization/policy.ts';
import {resolveCommercialEntitlements} from '../src/lib/entitlements/resolver.ts';
import {taskReadScopeForModules} from '../src/lib/authorization/operation-data.ts';
import {loadHandler,disposableDatabaseUrl} from './helpers/load-disposable-handler.mjs';
let db;const orgs=[];
before(()=>{db=new PrismaClient({datasources:{db:{url:disposableDatabaseUrl()}}});});
after(async()=>{for(const org of orgs)await db.organization.delete({where:{id:org.id}});await db.$disconnect();});
async function fixture(){const org=await db.organization.create({data:{name:'C5 compatibility fixture',slug:'c5-compat-'+randomUUID(),plan:'trial',trialEndsAt:new Date(Date.now()+86400000)}});orgs.push(org);const user=await db.user.create({data:{organizationId:org.id,name:'Fixture',email:randomUUID()+'@example.invalid',passwordHash:'not-a-login',role:'user',permissions:'{}'}});return{org,user,session:{user:{id:user.id,organizationId:org.id,role:'user'}}};}
function adapter(f,mode){
 const auth=loadHandler('src/lib/checkPermission.ts',{'next/server':{NextResponse},'next-auth':{getServerSession:async()=>f.session},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:db},'@/lib/permissions':permissions});
 const authorize=createModuleAuthorizer({session:async()=>f.session,readUser:id=>db.user.findUnique({where:{id},include:{organization:true}})});
 return loadHandler('src/lib/authorization/guards.ts',{'next/server':{NextResponse},'../checkPermission':auth,'./policy':{...policy,modeForOrganization:()=>mode},'./server':{evaluateModuleAccess:async request=>policy.authorizationEffect(await authorize(request),mode)}},{console:{info(){}}});
}
const flags={view:true,create:true,edit:true,delete:true};
test('C5-04: valid partial Atendimento/kanban-only records survive legacy and enforced guards without Sales entitlement fallback',async()=>{
 const fixtures=await Promise.all([fixture(),fixture()]);
 for(const f of fixtures)for(const role of ['owner','admin','user'])for(const [module,permission] of [['atendimento','atendimento'],['vendas','kanban']]){
  await db.organization.update({where:{id:f.org.id},data:{features:JSON.stringify([module])}});
  await db.user.update({where:{id:f.user.id},data:{role,permissions:JSON.stringify({[permission]:flags})}});
  for(const mode of ['observe_only','enforce'])for(const action of ['view','create','edit','delete'])assert.equal((await adapter(f,mode).checkModulePermission({module,permission,action})).allowed,true);
  const missing=module==='vendas'?'atendimento':'vendas',p=missing==='vendas'?'leads':'atendimento';
  assert.equal((await adapter(f,'enforce').checkModulePermission({module:missing,permission:p,action:'view'})).allowed,false);
  assert.equal(policy.modeForOrganization(f.org.id),'observe_only');
 }
});
test('C5-04: explicit partial denials stay denied, corrupt records/unknown roles/foreign sessions never become grants',async()=>{
 const f=await fixture();await db.organization.update({where:{id:f.org.id},data:{features:'["atendimento"]'}});
 await db.user.update({where:{id:f.user.id},data:{permissions:'{"atendimento":{"view":false}}'}});
 for(const mode of ['observe_only','enforce'])assert.equal((await adapter(f,mode).checkModulePermission({module:'atendimento',permission:'atendimento',action:'view'})).allowed,false);
 for(const raw of ['null','{"atendimento":{"view":"true"}}','{"atendimento":true}','{"unknown":{"view":true}}']){
  await db.user.update({where:{id:f.user.id},data:{permissions:raw}});assert.equal((await adapter(f,'enforce').checkModulePermission({module:'atendimento',permission:'atendimento',action:'view'})).allowed,false);
 }
 await db.user.update({where:{id:f.user.id},data:{permissions:JSON.stringify({atendimento:flags}),role:'superadmin'}});assert.equal((await adapter(f,'enforce').checkModulePermission({module:'atendimento',permission:'atendimento',action:'view'})).allowed,false);
 await db.user.update({where:{id:f.user.id},data:{role:'user'}});f.session.user.organizationId=randomUUID();
 for(const mode of ['observe_only','enforce'])assert.equal((await adapter(f,mode).checkModulePermission({module:'atendimento',permission:'atendimento',action:'view'})).allowed,false);
});
test('C5-03: seven contracts filter ordinary tasks/follow-ups and their Lead/Project dependencies in PostgreSQL',async()=>{
 const fixtures=await Promise.all([fixture(),fixture()]);
 for(const f of fixtures){
  const lead=await db.lead.create({data:{organizationId:f.org.id,name:'Own lead'}}),project=await db.marketingProject.create({data:{organizationId:f.org.id,title:'Own project',ownerId:f.user.id}});
  const definitions=[{title:'task',type:'task'},{title:'follow',type:'follow_up'},{title:'taskLead',type:'task',leadId:lead.id},{title:'taskProject',type:'task',projectId:project.id},{title:'followProject',type:'follow_up',projectId:project.id},{title:'followLead',type:'follow_up',leadId:lead.id}];
  await db.task.createMany({data:definitions.map(row=>({...row,organizationId:f.org.id}))});
  const expected={1:[],2:['follow','followLead'],3:['follow','followLead'],4:['task','taskProject'],5:['task','taskProject'],6:definitions.map(d=>d.title),7:definitions.map(d=>d.title)};
  for(let mask=1;mask<8;mask++){
   const modules=['atendimento','vendas','marketing'].filter((_,i)=>mask&(1<<i));const entitlements=resolveCommercialEntitlements({id:f.org.id,plan:'enterprise',features:JSON.stringify(modules)});
   const rows=await db.task.findMany({where:{organizationId:f.org.id,AND:[taskReadScopeForModules(entitlements.modules)]},select:{title:true,organizationId:true}});
   assert.deepEqual(rows.map(r=>r.title).sort(),expected[mask].sort());assert.ok(rows.every(r=>r.organizationId===f.org.id));
  }
 }
});
