import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {NextResponse} from 'next/server.js';
import * as engine from '../src/lib/authorization/authorize.ts';
import * as policy from '../src/lib/authorization/policy.ts';
import * as data from '../src/lib/authorization/operation-data.ts';
import * as permissions from '../src/lib/permissions.ts';
const {ALL_MODULES}=permissions;
import {loadHandler,disposableDatabaseUrl} from './helpers/load-disposable-handler.mjs';
let db;const orgs=[];const flags={view:true,create:true,edit:true,delete:true};
const pairs=[['vendas','projects'],['vendas','goals'],['vendas','agenda'],['atendimento','integrations']];
before(()=>{const u=new URL(disposableDatabaseUrl());u.searchParams.set('connection_limit','1');db=new PrismaClient({datasources:{db:{url:u.toString()}}});});
after(async()=>{for(const id of orgs){await db.comment.deleteMany({where:{organizationId:id}});await db.organization.delete({where:{id}});}await db.$disconnect();});
async function fixture(){const org=await db.organization.create({data:{name:'Lot2 helper fixture',slug:'c5-lot2-'+randomUUID(),features:'["atendimento","vendas","marketing"]',plan:'trial',trialEndsAt:new Date(Date.now()+86400000)}});orgs.push(org.id);const user=await db.user.create({data:{organizationId:org.id,name:'Fixture',email:randomUUID()+'@example.invalid',passwordHash:'not-a-login',role:'user',permissions:JSON.stringify(Object.fromEntries(ALL_MODULES.map(k=>[k,flags])))}});return{org,user,session:{user:{id:user.id,organizationId:org.id}}};}
const cachedAdapters=new Map();
function adapters(mode='enforce'){
 if(cachedAdapters.has(mode))return cachedAdapters.get(mode);
 const forbidden=()=>{throw Error('Global connection/session must not be used inside transaction');};
 const server=loadHandler('src/lib/authorization/server.ts',{'next-auth':{getServerSession:forbidden},'../auth':{authOptions:{}},'../prisma':{prisma:new Proxy({},{get:forbidden})},'./authorize':engine,'../admin-auth':{verifyAdminToken:forbidden},'./policy':{...policy,modeForOrganization:()=>mode}});
 const guards=loadHandler('src/lib/authorization/guards.ts',{'next/server':{NextResponse},'../checkPermission':{checkPermission:forbidden},'./server':server,'./policy':{...policy,modeForOrganization:()=>mode},'./operation-data':data,'../permissions':permissions},{console:{info(){}}});
 const result={...server,...guards};cachedAdapters.set(mode,result);return result;
}
test('Lot2 helpers: 12 legitimate refusals fixed; seven contracts, both brands, three roles, two tenants, four actions remain exact',async()=>{
 const fs=await Promise.all([fixture(),fixture()]);let checks=0,originalPositive=0;
 for(let mask=1;mask<8;mask++)for(const brand of [false,true])for(const role of ['owner','admin','user'])for(const f of fs){
  const modules=['atendimento','vendas','marketing'].filter((_,i)=>mask&(1<<i));
  await db.organization.update({where:{id:f.org.id},data:{features:JSON.stringify([...modules,...(brand?['white_label']:[])])}});await db.user.update({where:{id:f.user.id},data:{role}});
  await db.$transaction(async tx=>{for(const [module,permission]of pairs)for(const action of ['view','create','edit','delete']){const r=await adapters().evaluateModuleAccess({module,permission,action},{client:tx,session:f.session});assert.equal(r.decision.allowed,modules.includes(module));if(!r.decision.allowed)assert.equal(r.decision.reason,'module_not_contracted');checks++;if(mask===7&&!brand&&f===fs[0]&&action==='view'){assert.equal(r.decision.allowed,true);originalPositive++;}}},{timeout:15000});
 }
 assert.equal(checks,1344);assert.equal(originalPositive,12);assert.equal(policy.modeForOrganization(fs[0].org.id),'observe_only');
});
test('Lot2 helpers: permission, subscription, identity and unknown pairs cannot become grants',async()=>{
 const f=await fixture();const evaluate=(request)=>db.$transaction(tx=>adapters().evaluateModuleAccess(request,{client:tx,session:f.session}));
 const request={module:'vendas',permission:'projects',action:'view'};
 for(const role of ['owner','admin','user'])for(const [module,permission]of pairs){await db.user.update({where:{id:f.user.id},data:{role,permissions:JSON.stringify({[permission]:{view:false}})}});assert.equal((await evaluate({module,permission,action:'view'})).decision.allowed,false);}
 await db.user.update({where:{id:f.user.id},data:{permissions:JSON.stringify(Object.fromEntries(ALL_MODULES.map(k=>[k,flags])))}});
 await db.organization.update({where:{id:f.org.id},data:{planStatus:'past_due'}});assert.equal((await evaluate(request)).decision.reason,'inactive_subscription');
 await db.organization.update({where:{id:f.org.id},data:{planStatus:'active'}});f.session.user.organizationId=randomUUID();assert.equal((await evaluate(request)).decision.reason,'invalid_organization');f.session.user.organizationId=f.org.id;
 assert.equal((await evaluate({module:'atendimento',permission:'leads',action:'view'})).decision.reason,'insufficient_permission');
 await db.user.update({where:{id:f.user.id},data:{deletedAt:new Date()}});assert.equal((await evaluate(request)).decision.reason,'inactive_membership');
});
test('Lot2 resource inheritance: canonical task/comment bindings, foreign resources and pool1 use the same transaction',async()=>{
 const a=await fixture(),b=await fixture();await db.organization.update({where:{id:a.org.id},data:{features:'["atendimento","vendas"]'}});
 const task=await db.task.create({data:{organizationId:a.org.id,title:'Marketing task'}}),follow=await db.task.create({data:{organizationId:a.org.id,title:'Sales follow',type:'follow_up'}}),foreign=await db.task.create({data:{organizationId:b.org.id,title:'Foreign task'}});
 const comment=await db.comment.create({data:{organizationId:a.org.id,entityType:'task',entityId:task.id,authorId:a.user.id,content:'Own marker'}});
 for(const role of ['owner','admin','user']){await db.user.update({where:{id:a.user.id},data:{role}});await db.$transaction(async tx=>{
  assert.equal((await adapters().commercialEntityDenial(tx,a.session,'task',task.id,'view')).status,403);
  assert.equal((await adapters().commercialEntityDenial(tx,a.session,'comment',comment.id,'edit')).status,403);
  assert.equal(await adapters().commercialEntityDenial(tx,a.session,'task',follow.id,'edit'),null);
  assert.equal((await adapters().commercialEntityDenial(tx,a.session,'task',foreign.id,'view')).status,404);
  assert.equal(await data.entityModuleRequirements(tx,a.org.id,'comment',comment.id,'view') instanceof Array,true);
  assert.equal(await adapters('observe_only').commercialEntityDenial(tx,a.session,'task',task.id,'view'),null);
  assert.equal((await adapters('observe_only').commercialEntityDenial(tx,a.session,'task',foreign.id,'view')).status,404);
 },{timeout:5000});}
});
test('Lot2 transactional adapter preserves project quota using only the pool1 transaction',async()=>{
 const f=await fixture();await db.organization.update({where:{id:f.org.id},data:{maxProjects:1}});
 await db.$transaction(async tx=>{
  const request={module:'marketing',permission:'projects',action:'create'};
  assert.equal((await adapters().evaluateModuleAccess(request,{client:tx,session:f.session})).decision.allowed,true);
  await tx.marketingProject.create({data:{organizationId:f.org.id,title:'Quota fixture',ownerId:f.user.id}});
  assert.equal((await adapters().evaluateModuleAccess(request,{client:tx,session:f.session})).decision.reason,'additional_rule_denied');
 },{timeout:5000});
});
