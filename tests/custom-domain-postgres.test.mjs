// Register verification regressions in the same serial file: PostgreSQL SSI scans
// over organizations must not race a second independently scheduled domain suite.
import './helpers/domain-verification-regressions.mjs';
import './helpers/domain-persistent-activation-regressions.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createDomainManager, DomainError } from '../src/lib/domains/manager.ts';
import { resolveRequestDomain, sessionMatchesDomain } from '../src/lib/domains/request.ts';
import { readDomainState } from '../src/lib/domains/model.ts';
import { disposableDatabaseUrl } from './helpers/load-disposable-handler.mjs';
const db = new PrismaClient({ datasources: { db: { url: disposableDatabaseUrl() } } });
const ids = [], actor = randomUUID(), secret = 'synthetic-proxy-only-'.repeat(4);
const certificateExpiresAt = new Date(Date.now()+30*86400000).toISOString();
const good = async () => ({ ok:true, certificateExpiresAt });
const manager = createDomainManager(db, good);
const envKeys=['CRM_CUSTOM_DOMAINS_ENABLED','CRM_CUSTOM_DOMAIN_PROXY_SECRET','NEXTAUTH_URL'];
const previous = Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
before(()=>{process.env.CRM_CUSTOM_DOMAINS_ENABLED='true';process.env.CRM_CUSTOM_DOMAIN_PROXY_SECRET=secret;process.env.NEXTAUTH_URL='http://127.0.0.1:3100';});
after(async()=>{for(const id of ids){await db.activity.deleteMany({where:{entityId:id}});await db.organization.delete({where:{id}});}await db.$disconnect();for(const key of envKeys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}});
async function fixture(features='["atendimento","vendas","white_label","custom_domain"]'){
 const org=await db.organization.create({data:{name:'Synthetic domain fixture',slug:'domain-'+randomUUID(),features,settings:JSON.stringify({providerSentinel:{inbox:123},otherSetting:'preserve'}),plan:'enterprise'}});ids.push(org.id);return org;
}
const hostname=()=> 'crm-'+randomUUID()+'.example.com';
const headers=(host,extra={})=>new Headers({host,'x-crm-proxy-key':secret,'x-forwarded-proto':'https',...extra});
async function active(org,host=hostname()) {await manager(org.id,actor,{action:'configure',hostname:host});await manager(org.id,actor,{action:'verify'});await manager(org.id,actor,{action:'activate'});return host;}
test('grant, configure, verify and activate are separate durable decisions; provider settings preserved',async()=>{
 const org=await fixture('["atendimento","vendas","white_label"]');
 await assert.rejects(manager(org.id,actor,{action:'configure',hostname:hostname()}),e=>e instanceof DomainError&&e.status===403);
 await manager(org.id,actor,{action:'grant',enabled:true});assert.equal((await db.organization.findUnique({where:{id:org.id}})).domain,null);
 const host=hostname();const configured=await manager(org.id,actor,{action:'configure',hostname:host.toUpperCase()});assert.equal(configured.hostname,host);assert.equal(configured.status,'awaiting_dns');
 await assert.rejects(manager(org.id,actor,{action:'activate'}),e=>e.status===409);
 const awaiting=await resolveRequestDomain(headers(host));assert.equal(awaiting.kind,'custom');assert.equal(awaiting.active,false);
 const bad=createDomainManager(db,async()=>({ok:false,status:'awaiting_dns',error:'ownership_missing'}));assert.equal((await bad(org.id,actor,{action:'verify'})).status,'awaiting_dns');
 assert.equal((await manager(org.id,actor,{action:'verify'})).status,'verified');
 assert.equal((await resolveRequestDomain(headers(host))).active,false,'Verification does not activate');
 await manager(org.id,actor,{action:'activate'});assert.equal((await resolveRequestDomain(headers(host))).active,true);
 const final=await db.organization.findUnique({where:{id:org.id}});assert.deepEqual(JSON.parse(final.settings).providerSentinel,{inbox:123});assert.equal(final.plan,org.plan);
 assert.deepEqual(JSON.parse(final.features),['atendimento','vendas','white_label','custom_domain']);
 const audit=await db.activity.findMany({where:{entityId:org.id}});assert.equal(audit.length,5);for(const item of audit){assert.equal(item.userId,null);assert.equal(JSON.parse(item.metadata).actorId,actor);}
});
test('exact host, proxy trust and session provenance reject cross-tenant and forged headers',async()=>{
 const a=await fixture(),b=await fixture(),aHost=await active(a),bHost=await active(b);
 const ca=await resolveRequestDomain(headers(aHost)),cb=await resolveRequestDomain(headers(bHost));
 assert.equal((await resolveRequestDomain(headers(aHost.toUpperCase()+'.',{'x-forwarded-host':aHost+':443'}))).organizationId,a.id);assert.equal(ca.organizationId,a.id);assert.equal(cb.organizationId,b.id);
 assert.equal(sessionMatchesDomain({domainOrigin:ca.origin,organizationId:a.id,domainOrganizationId:a.id},ca),true);
 for(const token of [{domainOrigin:ca.origin,organizationId:a.id,domainOrganizationId:a.id},{domainOrigin:cb.origin,organizationId:a.id,domainOrganizationId:a.id},{organizationId:b.id}])assert.equal(sessionMatchesDomain(token,cb),false);
 const primary=await resolveRequestDomain(new Headers({host:'127.0.0.1:3100','x-forwarded-host':aHost}));assert.equal(primary.kind,'primary');
 assert.equal(sessionMatchesDomain({domainOrigin:ca.origin,organizationId:a.id,domainOrganizationId:a.id},primary),false);
 assert.equal(sessionMatchesDomain({domainOrigin:cb.origin,organizationId:b.id,domainOrganizationId:a.id},cb),false,'Live membership cannot transfer the immutable login organization');
 assert.equal(sessionMatchesDomain({organizationId:a.id},primary),true,'Legacy primary session compatible');
 for(const h of [new Headers({host:aHost}),headers(aHost,{'x-crm-proxy-key':'forged'}),headers(aHost,{'x-forwarded-host':bHost}),headers(aHost,{'x-forwarded-proto':'http'}),headers(aHost+', '+bHost),headers(aHost+':444'),headers('unknown-'+aHost),headers(aHost+'.evil.com')])assert.equal((await resolveRequestDomain(h)).kind,'denied');
});
test('domain uniqueness is case-insensitive and concurrent claims create only one reservation',async()=>{
 const a=await fixture(),b=await fixture(),host=hostname();
 const results=await Promise.allSettled([manager(a.id,actor,{action:'configure',hostname:host}),manager(b.id,actor,{action:'configure',hostname:host.toUpperCase()})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
 assert.equal(await db.organization.count({where:{domain:{equals:host,mode:'insensitive'}}}),1);
 assert.equal(await db.activity.count({where:{entityId:{in:[a.id,b.id]}}}),1);
 const legacy=await fixture();await db.organization.update({where:{id:legacy.id},data:{domain:hostname().toUpperCase()}});
 const legacyDomain=(await db.organization.findUnique({where:{id:legacy.id}})).domain;
 await assert.rejects(manager(a.id,actor,{action:'configure',hostname:legacyDomain.toLowerCase()}),e=>e.status===409);
});
test('audit failure and stale settings do not partially change domain or overwrite provider state',async()=>{
 const org=await fixture(),host=hostname();
 const failing=createDomainManager({organization:db.organization,$transaction:(callback,options)=>db.$transaction(tx=>callback({organization:tx.organization,$queryRaw:tx.$queryRaw.bind(tx),activity:{create:async()=>{throw Error('Synthetic audit failure');}}}),options)},good);
 await assert.rejects(failing(org.id,actor,{action:'configure',hostname:host}),e=>e.status===503);
 assert.equal((await db.organization.findUnique({where:{id:org.id}})).domain,null);assert.equal(await db.activity.count({where:{entityId:org.id}}),0);
 const racing=createDomainManager({organization:db.organization,$transaction:async(callback,options)=>{
   await db.organization.update({where:{id:org.id},data:{settings:'{"providerSentinel":{"inbox":999}}'}});return db.$transaction(callback,options);
 }},good);
 await assert.rejects(racing(org.id,actor,{action:'configure',hostname:host}),e=>e.status===409);
 assert.equal((await db.organization.findUnique({where:{id:org.id}})).settings,'{"providerSentinel":{"inbox":999}}');assert.equal(await db.activity.count({where:{entityId:org.id}}),0);
});
test('revocation, transient monitoring failure, legacy activation, replacement and removal preserve the V1.1 policy',async()=>{
 const a=await fixture(),host=await active(a);
 await manager(a.id,actor,{action:'grant',enabled:false});assert.equal((await resolveRequestDomain(headers(host))).kind,'denied');
 await manager(a.id,actor,{action:'grant',enabled:true});assert.equal((await resolveRequestDomain(headers(host))).active,false);
 await assert.rejects(manager(a.id,actor,{action:'activate'}),e=>e.status===409);
 await manager(a.id,actor,{action:'verify'});await manager(a.id,actor,{action:'activate'});
 const failed=createDomainManager(db,async()=>({ok:false,status:'awaiting_https',error:'https_unavailable'}));await failed(a.id,actor,{action:'verify'});assert.equal((await resolveRequestDomain(headers(host))).active,true,'A transient HTTPS failure does not revoke activation');
 await manager(a.id,actor,{action:'verify'});await manager(a.id,actor,{action:'activate'});
 const row=await db.organization.findUnique({where:{id:a.id}}),settings=JSON.parse(row.settings);settings.customDomainV1.checkedAt=new Date(Date.now()-3*86400000).toISOString();settings.customDomainV1.verifiedAt=settings.customDomainV1.checkedAt;settings.customDomainV1.verifiedUntil=new Date(Date.now()-2*86400000).toISOString();await db.organization.update({where:{id:a.id},data:{settings:JSON.stringify(settings)}});
 assert.equal((await resolveRequestDomain(headers(host))).active,true,'Activated domains do not inherit the old 24h lease');
 assert.equal((await manager(a.id,actor,{action:'verify'})).status,'active','Successful monitoring preserves administrative activation');
 assert.equal((await resolveRequestDomain(headers(host))).active,true);
 const replacement=hostname();await manager(a.id,actor,{action:'configure',hostname:replacement});assert.equal((await resolveRequestDomain(headers(host))).kind,'denied');assert.equal((await resolveRequestDomain(headers(replacement))).active,false);
 assert.notEqual(readDomainState((await db.organization.findUnique({where:{id:a.id}})).settings).challenge,settings.customDomainV1.challenge);
 await manager(a.id,actor,{action:'remove'});assert.equal((await db.organization.findUnique({where:{id:a.id}})).domain,null);
});

test('ambiguous legacy case variants are never resolved to an arbitrary organization',async()=>{
 const a=await fixture(),host=await active(a),b=await fixture();
 const saved=await db.organization.findUnique({where:{id:a.id}});
 await db.organization.update({where:{id:b.id},data:{domain:host.toUpperCase(),settings:saved.settings}});
 assert.equal((await resolveRequestDomain(headers(host))).kind,'denied');
});

test('existing plan sync cannot reactivate a previously active domain by commercial regrant',async()=>{
 const {syncPlanLimits}=await import('../src/lib/checkLimits.ts');
 const org=await fixture(),host=await active(org),name='domain-plan-'+randomUUID();
 const plan=await db.plan.create({data:{name,displayName:'Synthetic domain plan',price:0,maxUsers:5,maxLeads:100,maxProjects:10,maxOs:10,features:'["vendas"]'}});
 try{
  await syncPlanLimits(org.id,name);assert.equal((await resolveRequestDomain(headers(host))).kind,'denied');
  assert.equal(readDomainState((await db.organization.findUnique({where:{id:org.id}})).settings).status,'disabled');
  await db.plan.update({where:{id:plan.id},data:{features:'["vendas","custom_domain"]'}});
  await syncPlanLimits(org.id,name);const context=await resolveRequestDomain(headers(host));assert.equal(context.kind,'custom');assert.equal(context.active,false);
  await assert.rejects(manager(org.id,actor,{action:'activate'}),e=>e.status===409);
  const row=await db.organization.findUnique({where:{id:org.id}});assert.equal(JSON.parse(row.settings).providerSentinel.inbox,123);
 }finally{await db.plan.delete({where:{id:plan.id}});}
});

test('actual recovery handler sends a host-validated link and never rotates another tenant token',async()=>{
 const {loadHandler}=await import('./helpers/load-disposable-handler.mjs');
 const {NextRequest,NextResponse}=await import('next/server.js');
 const validation=await import('../src/lib/validations/index.ts');
 const requests=await import('../src/lib/domains/request.ts');
 const a=await fixture(),b=await fixture(),host=await active(a),sent=[];
 const user=await db.user.create({data:{organizationId:a.id,name:'Recovery fixture',email:randomUUID()+'@example.invalid',passwordHash:'no-login-credential'}});
 const other=await db.user.create({data:{organizationId:b.id,name:'Other recovery fixture',email:randomUUID()+'@example.invalid',passwordHash:'no-login-credential'}});
 try{
  const route=loadHandler('src/app/api/auth/forgot-password/route.ts',{
   'next/server':{NextResponse},'@/lib/prisma':{prisma:db},'@/lib/email':{sendPasswordResetEmail:async payload=>{sent.push(payload);return{success:true};}},'@/lib/validations':validation,'@/lib/domains/request':requests,
  },{process:{env:{CRM_CUSTOM_DOMAINS_ENABLED:'true',NEXTAUTH_URL:'http://127.0.0.1:3100'}}});
  const request=email=>new NextRequest('http://127.0.0.1:3100/api/auth/forgot-password',{method:'POST',headers:{...Object.fromEntries(headers(host)),'content-type':'application/json'},body:JSON.stringify({email})});
  assert.equal((await route.POST(request(user.email))).status,200);assert.equal(sent.length,1);
  const link=new URL(sent[0].resetLink);assert.equal(link.origin,'https://'+host);assert.equal(link.pathname,'/auth/reset-password');
  assert.equal(link.searchParams.get('token'),(await db.passwordResetToken.findFirstOrThrow({where:{email:user.email}})).token);
  assert.equal((await route.POST(request(other.email))).status,200);assert.equal(sent.length,1);assert.equal(await db.passwordResetToken.count({where:{email:other.email}}),0);
 }finally{await db.passwordResetToken.deleteMany({where:{email:{in:[user.email,other.email]}}});}
});

test('custom domain is independent of White-Label and never grants modules or customer branding',async()=>{
 const {getOrgBranding,DEFAULT_BRANDING}=await import('../src/lib/branding.ts');
 const org=await fixture('["vendas","custom_domain"]'),host=await active(org);
 assert.equal((await resolveRequestDomain(headers(host))).active,true);
 assert.deepEqual(JSON.parse((await db.organization.findUnique({where:{id:org.id}})).features),['vendas','custom_domain']);
 assert.deepEqual(await getOrgBranding(org.id),DEFAULT_BRANDING);
});

test('domain grant preserves opaque legacy identifiers, their order and duplicates',async()=>{
 const previous=['vendas','legacy_opaque','legacy_opaque'];const org=await fixture(JSON.stringify(previous));
 await manager(org.id,actor,{action:'grant',enabled:true});
 assert.deepEqual(JSON.parse((await db.organization.findUnique({where:{id:org.id}})).features),[...previous,'custom_domain']);
 await manager(org.id,actor,{action:'grant',enabled:false});
 assert.deepEqual(JSON.parse((await db.organization.findUnique({where:{id:org.id}})).features),previous);
});
