import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createDomainManager, domainView } from '../../src/lib/domains/manager.ts';
import { domainIsActive, readDomainState } from '../../src/lib/domains/model.ts';
import { resolveRequestDomain, sessionMatchesDomain } from '../../src/lib/domains/request.ts';
import { disposableDatabaseUrl } from './load-disposable-handler.mjs';
const url = disposableDatabaseUrl(), db = new PrismaClient({ datasources: { db: { url } } }), ids = [], actor = randomUUID();
const good = async () => ({ok:true,certificateExpiresAt:new Date(Date.now()+30*86400000).toISOString()});
const manager = createDomainManager(db,good);
after(async()=>{for(const id of ids){await db.activity.deleteMany({where:{entityId:id}});await db.organization.delete({where:{id}});}await db.$disconnect();});
async function fixture(){const org=await db.organization.create({data:{name:'Persistent synthetic domain',slug:'persistent-'+randomUUID(),features:'["vendas","white_label","custom_domain"]',settings:'{"providerSentinel":{"inbox":123}}',plan:'enterprise'}});ids.push(org.id);const host='crm-'+randomUUID()+'.example.com';await manager(org.id,actor,{action:'configure',hostname:host});await manager(org.id,actor,{action:'verify'});await manager(org.id,actor,{action:'activate'});return {org,host};}
async function saved(id){return db.organization.findUniqueOrThrow({where:{id}});}

test('persistent activation survives 24h, legacy metadata and a fresh Prisma process client without writes',async()=>{
 const {org,host}=await fixture(),row=await saved(org.id),state=JSON.parse(row.settings);
 const stamp=readDomainState(row.settings).activatedAt;assert.ok(stamp);assert.equal(readDomainState(row.settings).activationHostname,host);
 state.customDomainV1.checkedAt=new Date(Date.now()-3*86400000).toISOString();state.customDomainV1.verifiedAt=state.customDomainV1.checkedAt;
 state.customDomainV1.verifiedUntil=new Date(Date.now()-2*86400000).toISOString();state.customDomainV1.certificateExpiresAt=new Date(Date.now()-86400000).toISOString();
 delete state.customDomainV1.activatedAt;delete state.customDomainV1.activationRevision;delete state.customDomainV1.activationHostname;
 await db.organization.update({where:{id:org.id},data:{settings:JSON.stringify(state)}});
 const restarted=new PrismaClient({datasources:{db:{url}}});try{
  const reread=await restarted.organization.findUniqueOrThrow({where:{id:org.id}});assert.equal(domainIsActive(reread.settings,Date.now(),host),true);
  assert.equal(domainView(reread).status,'active');assert.equal(domainView(reread).verificationExpired,false);
  assert.equal((await saved(org.id)).settings,JSON.stringify(state),'Legacy compatibility needs no migration/write');
 }finally{await restarted.$disconnect();}
 await manager(org.id,actor,{action:'deactivate'});assert.equal(domainIsActive((await saved(org.id)).settings),false);
 await assert.rejects(manager(org.id,actor,{action:'activate'}),e=>e.status===409);
 await manager(org.id,actor,{action:'verify'});await manager(org.id,actor,{action:'activate'});
 const revoked=await manager(org.id,actor,{action:'grant',enabled:false});assert.equal(revoked.eligible,false);assert.equal(revoked.status,'disabled');
 await manager(org.id,actor,{action:'grant',enabled:true});assert.equal(domainIsActive((await saved(org.id)).settings),false,'Regrant never reactivates');
});

test('monitoring failure is audited without extending proof; confirmed loss can be suspended and requires fresh proof',async()=>{
 const {org,host}=await fixture(),before=readDomainState((await saved(org.id)).settings);
 for(const error of ['dns_unavailable','https_unavailable','ownership_missing','pointing_mismatch','routing_mismatch']){
  const probe=createDomainManager(db,async()=>({ok:false,status:error.includes('https')||error==='routing_mismatch'?'awaiting_https':'awaiting_dns',error}));
  const view=await probe(org.id,actor,{action:'verify'});assert.equal(view.status,'active');assert.equal(view.error,error);
  const state=readDomainState((await saved(org.id)).settings);assert.equal(state.verifiedAt,before.verifiedAt);assert.equal(state.verifiedUntil,before.verifiedUntil);assert.equal(state.certificateExpiresAt,before.certificateExpiresAt);assert.equal(state.activatedAt,before.activatedAt);
  assert.equal(view.securityReviewRequired,['ownership_missing','pointing_mismatch','routing_mismatch'].includes(error));
 }
 const events=await db.activity.findMany({where:{entityId:org.id}});assert.equal(events.filter(e=>JSON.parse(e.metadata).verificationResult).length,6);
 await manager(org.id,actor,{action:'deactivate'});assert.equal(domainIsActive((await saved(org.id)).settings),false,'MDS suspends immediately after confirming an incident');
 await assert.rejects(manager(org.id,actor,{action:'activate'}),e=>e.status===409);
 await manager(org.id,actor,{action:'verify'});await manager(org.id,actor,{action:'activate'});
 assert.deepEqual(JSON.parse((await saved(org.id)).settings).providerSentinel,{inbox:123});
 const replacement='replacement-'+host;await manager(org.id,actor,{action:'configure',hostname:replacement});assert.equal(domainIsActive((await saved(org.id)).settings),false);
 await assert.rejects(manager(org.id,actor,{action:'activate'}),e=>e.status===409);
});

test('expired unactivated proof and arbitrary active records cannot authorize persistent activation',async()=>{
 const {org}=await fixture(),row=await saved(org.id),state=JSON.parse(row.settings);
 state.customDomainV1.status='verified';state.customDomainV1.checkedAt=new Date(Date.now()-3*86400000).toISOString();state.customDomainV1.verifiedAt=state.customDomainV1.checkedAt;state.customDomainV1.verifiedUntil=new Date(Date.now()-2*86400000).toISOString();state.customDomainV1.certificateExpiresAt=new Date(Date.now()+86400000).toISOString();
 await db.organization.update({where:{id:org.id},data:{settings:JSON.stringify(state)}});await assert.rejects(manager(org.id,actor,{action:'activate'}),e=>e.status===409);
 state.customDomainV1.status='active';delete state.customDomainV1.checkedAt;delete state.customDomainV1.verifiedAt;
 await db.organization.update({where:{id:org.id},data:{settings:JSON.stringify(state)}});assert.equal(domainIsActive((await saved(org.id)).settings),false);
 assert.equal(sessionMatchesDomain({organizationId:org.id},{kind:'denied'}),false);
 // Existing request resolution still rejects unknown hosts; it does not infer tenants from state alone.
 assert.equal((await resolveRequestDomain(new Headers({host:'unknown-'+randomUUID()+'.example.com'}))).kind,'denied');
});
