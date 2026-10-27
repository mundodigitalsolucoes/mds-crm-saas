import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { domainIsActive } from '../src/lib/domains/model.ts';
import { encryptToken,decryptToken } from '../src/lib/integrations/crypto.ts';
import { disposableDatabaseUrl,loadHandler } from './helpers/load-disposable-handler.mjs';
import { syntheticChatwoot } from './helpers/synthetic-chatwoot.mjs';
const db=new PrismaClient({datasources:{db:{url:disposableDatabaseUrl()}}}),ids=[],actor=randomUUID();
let remote,service,dropResponse=false;
const previous=process.env.TOKENS_SECRET, providerLogs=[];
before(async()=>{
 process.env.TOKENS_SECRET=randomBytes(32).toString('base64');remote=await syntheticChatwoot();
 const env={CHATWOOT_API_URL:remote.base,CHATWOOT_PLATFORM_TOKEN:remote.platformToken,CHATWOOT_WEBHOOK_SECRET:'synthetic-webhook-only',NEXTAUTH_URL:'http://127.0.0.1:3100'};
 service=loadHandler('src/lib/integrations/chatwoot-provision.ts',{'@/lib/prisma':{prisma:db},'@/lib/integrations/crypto':{encryptToken,decryptToken}},{process:{env},console:{info(...v){providerLogs.push(v.join(' '));},warn(...v){providerLogs.push(v.join(' '));},error(...v){providerLogs.push(v.join(' '));}},fetch:async(url,options)=>{const response=await remote.fetch(url,options);if(dropResponse&&new URL(url).pathname==='/platform/api/v1/accounts'&&options?.method==='POST'){dropResponse=false;await response.text();throw Error('synthetic_response_lost');}return response;}});
});
after(async()=>{for(const id of ids){await db.activity.deleteMany({where:{entityId:id}});await db.organization.delete({where:{id}});}await db.$disconnect();if(remote)await remote.close();if(previous===undefined)delete process.env.TOKENS_SECRET;else process.env.TOKENS_SECRET=previous;});
async function fixture(){const suffix=randomUUID();const org=await db.organization.create({data:{name:'Synthetic Chatwoot '+suffix,slug:'cw-'+suffix,plan:'enterprise',features:'["atendimento","vendas","white_label","custom_domain"]',domain:'cw-'+suffix+'.example.com',settings:JSON.stringify({providerSentinel:{inbox:777},customDomainV1:{status:'active',challenge:'c'.repeat(64),revision:randomUUID(),checkedAt:new Date(Date.now()-3*86400000).toISOString(),verifiedUntil:new Date(Date.now()-2*86400000).toISOString(),certificateExpiresAt:new Date(Date.now()+86400000).toISOString()}})}});ids.push(org.id);const owner=await db.user.create({data:{organizationId:org.id,name:'Synthetic owner',email:suffix+'@example.invalid',passwordHash:await bcrypt.hash('synthetic-crm-password-only',4),role:'owner'}});return {org,owner,input:{organizationId:org.id,orgName:org.name,orgSlug:org.slug,ownerUserId:owner.id,ownerName:owner.name,ownerEmail:owner.email,allowCreate:true,actorId:actor}};}
const binding=f=>db.connectedAccount.findUnique({where:{provider_organizationId:{provider:'chatwoot',organizationId:f.org.id}}});
const creations=()=>remote.state.calls.filter(x=>x.method==='POST'&&x.path==='/platform/api/v1/accounts').length;

test('official provisioner creates one account, owner membership and webhook; status never reveals credentials',async()=>{
 const f=await fixture(),snapshot=f.org.settings;
 const evolution=await db.connectedAccount.create({data:{provider:'evolution',organizationId:f.org.id,accessTokenEnc:encryptToken('synthetic-evolution-only'),isActive:true,data:'{"instance":"preserve"}'}});
 const instance=await db.whatsappInstance.create({data:{organizationId:f.org.id,instanceName:'preserve-'+randomUUID(),metadata:'{"provider":"evolution"}',status:'connected'}});
 const result=await service.provisionChatwootForOrg(f.input);assert.equal(result.success,true,result.error);
 const account=await binding(f),org=await db.organization.findUniqueOrThrow({where:{id:f.org.id}}),owner=await db.user.findUniqueOrThrow({where:{id:f.owner.id}});
 assert.equal(account.isActive,true);assert.equal(org.chatwootAccountId,JSON.parse(account.data).chatwootAccountId);assert.equal(owner.chatwootUserId,JSON.parse(account.data).chatwootUserId);assert.equal(owner.isChatwootAgent,true);assert.equal(org.settings,snapshot);assert.equal(domainIsActive(org.settings,Date.now(),org.domain),true,'Persistent custom domain preserved');assert.equal(org.features,f.org.features);assert.equal(JSON.stringify(await db.connectedAccount.findUniqueOrThrow({where:{id:evolution.id}})),JSON.stringify(evolution));assert.equal(JSON.stringify(await db.whatsappInstance.findUniqueOrThrow({where:{id:instance.id}})),JSON.stringify(instance));
 const dto=await service.getChatwootProvisionStatus(f.org.id);assert.equal(dto.provisioned,true);assert.ok(!JSON.stringify(dto).includes('Token'));assert.ok(!JSON.stringify(dto).includes('Password'));
 const before=creations(),saved=JSON.stringify(account);assert.equal((await service.provisionChatwootForOrg({...f.input,allowCreate:false})).success,true);assert.equal(creations(),before);assert.equal(JSON.stringify(await binding(f)),saved,'Never overwrite an active integration');
});

test('failed account POST preserves organization and owner, and cannot be replayed without remote evidence',async()=>{
 const f=await fixture(),before=creations();remote.state.failAccountOnce=true;
 assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);assert.equal(creations(),before+1);assert.ok(await db.user.findUnique({where:{id:f.owner.id}}));assert.equal((await binding(f)).isActive,false);
 assert.equal((await service.provisionChatwootForOrg({...f.input,allowCreate:false})).error,'account_requires_review');assert.equal(creations(),before+1);
});

test('lost account response is reconciled by exact durable operation marker, without another account POST',async()=>{
 const f=await fixture();dropResponse=true;const before=creations();assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);assert.equal(creations(),before+1);
 assert.equal((await service.provisionChatwootForOrg({...f.input,allowCreate:false})).success,true);assert.equal(creations(),before+1);
});

for(const failure of ['failMembershipOnce','failWebhookOnce'])test('resume '+failure+' without duplicate account/user and without replacing provider data',async()=>{
 const f=await fixture(),before=creations(),users=remote.state.users.length,webhookPosts=remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length;remote.state[failure]=true;
 assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);const partial=await binding(f);assert.equal(partial.isActive,false);
 const resumed=await service.provisionChatwootForOrg({...f.input,allowCreate:false});assert.equal(resumed.success,failure!=='failWebhookOnce');if(failure==='failWebhookOnce'){assert.equal(resumed.error,'webhook_requires_review');assert.equal(remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length,webhookPosts+1,'An unknown creation is never replayed');}assert.equal(creations(),before+1);assert.equal(remote.state.users.length,users+1);assert.ok(providerLogs.every(line=>!remote.state.users.some(user=>line.includes(user.access_token))),'Upstream token echoes never enter logs');assert.equal((await db.organization.findUniqueOrThrow({where:{id:f.org.id}})).settings,f.org.settings);
});

test('concurrent requests reserve one operation and never create a second account',async()=>{
 const f=await fixture();let release,entered;const waiting=new Promise(r=>{entered=r;});remote.state.holdAccount=async()=>{entered();await new Promise(r=>{release=r;});};
 const first=service.provisionChatwootForOrg(f.input);await waiting;
 try{const second=await service.provisionChatwootForOrg(f.input);assert.equal(second.error,'provisioning_in_progress');}finally{remote.state.holdAccount=null;release();}
 assert.equal((await first).success,true);assert.equal(remote.state.accounts.filter(a=>a.custom_attributes.crmOrganizationId===f.org.id).length,1);
});

test('ambiguous remote account is stopped before resource creation and no force path exists',async()=>{
 const f=await fixture();dropResponse=true;assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);const remoteAccount=remote.state.accounts.find(a=>a.custom_attributes.crmOrganizationId===f.org.id);remoteAccount.custom_attributes={};const before=creations();
 const result=await service.provisionChatwootForOrg(f.input);assert.equal(result.error,'account_requires_review');assert.equal(creations(),before);assert.equal((await binding(f)).isActive,false);
 const known=await fixture();remote.state.failMembershipOnce=true;assert.equal((await service.provisionChatwootForOrg(known.input)).success,false);const existing=remote.state.accounts.find(a=>a.custom_attributes.crmOrganizationId===known.org.id);remote.state.accounts.push({...existing,id:remote.state.nextAccount++,members:[]});const writes=remote.state.calls.filter(c=>c.method==='POST').length;assert.equal((await service.provisionChatwootForOrg(known.input)).error,'account_requires_review');assert.equal(remote.state.calls.filter(c=>c.method==='POST').length,writes,'Duplicate durable markers require review before any more writes');
});

test('preexisting foreign identity is never attached, updated or accepted merely by email',async()=>{
 const f=await fixture(),u={id:remote.state.nextUser++,name:'Foreign fixture',email:f.owner.email,confirmed:true,custom_attributes:{organizationId:randomUUID()},access_token:'synthetic-foreign-token'};remote.state.users.push(u);const snapshot=JSON.stringify(u);
 const result=await service.provisionChatwootForOrg(f.input);assert.equal(result.error,'identity_requires_review');assert.equal(JSON.stringify(u),snapshot);assert.equal((await binding(f)).isActive,false);assert.equal(remote.state.accounts.find(a=>a.custom_attributes.crmOrganizationId===f.org.id).members.length,0);
 const before=creations();assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);assert.equal(creations(),before);
});

test('inactive legacy bindings, foreign owner and deleted organization produce no external writes',async()=>{
 const f=await fixture(),g=await fixture();await db.connectedAccount.create({data:{provider:'chatwoot',organizationId:f.org.id,accessTokenEnc:encryptToken('legacy-synthetic'),data:'{}',isActive:false}});const before=remote.state.calls.length;
 assert.equal((await service.provisionChatwootForOrg(f.input)).error,'binding_requires_review');assert.equal((await service.provisionChatwootForOrg({...g.input,ownerUserId:f.owner.id})).error,'owner_requires_review');await db.user.update({where:{id:g.owner.id},data:{chatwootUserId:777}});assert.equal((await service.provisionChatwootForOrg(g.input)).error,'binding_requires_review');
 await db.organization.update({where:{id:g.org.id},data:{deletedAt:new Date()}});assert.equal((await service.provisionChatwootForOrg(g.input)).error,'organization_inactive');assert.equal(remote.state.calls.length,before);
 const h=await fixture();remote.state.failMembershipOnce=true;assert.equal((await service.provisionChatwootForOrg(h.input)).success,false);await db.organization.update({where:{id:h.org.id},data:{chatwootAccountId:999999}});const beforeConflict=remote.state.calls.length;assert.equal((await service.provisionChatwootForOrg(h.input)).error,'binding_requires_review');assert.equal(remote.state.calls.length,beforeConflict,'Known ID conflicts are stopped before external inspection/creation');
});

test('configuration absence returns a safe failure before any external request',async()=>{
 const f=await fixture(),before=remote.state.calls.length;
 for(const env of [{},{CHATWOOT_API_URL:remote.base},{CHATWOOT_API_URL:remote.base,CHATWOOT_PLATFORM_TOKEN:remote.platformToken}]){
  const missing=loadHandler('src/lib/integrations/chatwoot-provision.ts',{'@/lib/prisma':{prisma:db},'@/lib/integrations/crypto':{encryptToken,decryptToken}},{process:{env},fetch:()=>{throw Error('External call forbidden');}});
  assert.equal((await missing.provisionChatwootForOrg(f.input)).success,false);
 }
 assert.equal(remote.state.calls.length,before);assert.equal(await binding(f),null);
});

test('manual recovery requires shared Super Admin auth and rejects force before provider calls',async()=>{
 const f=await fixture();const route=loadHandler('src/app/api/admin/orgs/[orgId]/provision-chatwoot/route.ts',{'next/server':{NextResponse},'@/lib/admin-auth':{verifyAdminToken:async()=>({id:actor})},'@/lib/prisma':{prisma:db},'@/lib/integrations/chatwoot-provision':service});
 const req=body=>new Request('http://127.0.0.1/api/test',{method:'POST',body:JSON.stringify(body)}),params={params:Promise.resolve({orgId:f.org.id})};
 const before=remote.state.calls.length;assert.equal((await route.POST(req({force:true}),params)).status,400);assert.equal((await route.POST(req({force:false}),params)).status,409);assert.equal(remote.state.calls.length,before);
 assert.equal((await route.POST(req({force:false,inspectionAcknowledged:true}),params)).status,200);
 const prior=await binding(f),data=JSON.parse(prior.data),other={id:remote.state.nextAccount++,name:'Foreign membership fixture',custom_attributes:{},members:[data.chatwootUserId]};remote.state.accounts.push(other);const writes=remote.state.calls.filter(c=>c.method==='POST').length;const rejected=await route.POST(req({force:false}),params);assert.equal(rejected.status,409);assert.equal((await rejected.json()).onboarding.provisioned,false,'Failed remote validation cannot echo a ready local status');const warned=await binding(f);assert.equal(warned.data,prior.data);assert.equal(warned.accessTokenEnc,prior.accessTokenEnc);assert.equal(warned.isActive,true);assert.equal(warned.lastError,'binding_requires_review');assert.equal((await (await route.GET(null,params)).json()).provisioned,false,'A later GET retains remote failure');assert.equal(remote.state.calls.filter(c=>c.method==='POST').length,writes);
});

test('failed final CRM commit leaves durable checkpoints and retries without another external creation',async()=>{
 const f=await fixture();let fail=true;
 const proxy=new Proxy(db,{get(target,key){if(key==='$transaction')return(callback,options)=>db.$transaction(tx=>callback(new Proxy(tx,{get(inner,field){if(field==='activity'&&fail)return {...inner.activity,create:()=>{fail=false;throw Error('synthetic_final_audit_failure');}};return Reflect.get(inner,field);}})),options);return Reflect.get(target,key);}});
 const env={CHATWOOT_API_URL:remote.base,CHATWOOT_PLATFORM_TOKEN:remote.platformToken,CHATWOOT_WEBHOOK_SECRET:'synthetic-webhook-only',NEXTAUTH_URL:'http://127.0.0.1:3100'};
 const fault=loadHandler('src/lib/integrations/chatwoot-provision.ts',{'@/lib/prisma':{prisma:proxy},'@/lib/integrations/crypto':{encryptToken,decryptToken}},{process:{env},console:{info(){},warn(){},error(){}},fetch:remote.fetch});
 const before=creations();assert.equal((await fault.provisionChatwootForOrg(f.input)).success,false);assert.equal((await binding(f)).isActive,false);assert.equal((await db.organization.findUniqueOrThrow({where:{id:f.org.id}})).chatwootAccountId,null);assert.equal((await db.user.findUniqueOrThrow({where:{id:f.owner.id}})).chatwootUserId,null);
 assert.equal((await fault.provisionChatwootForOrg({...f.input,allowCreate:false})).success,true);assert.equal(creations(),before+1);
});

test('organization removed while account is being created never gains an active integration or remote user',async()=>{
 const f=await fixture(),beforeUsers=remote.state.users.length;let release,entered;const gate=new Promise(r=>{entered=r;});remote.state.holdAccount=async()=>{entered();await new Promise(r=>{release=r;});};
 const pending=service.provisionChatwootForOrg(f.input);await gate;
 try{await db.organization.update({where:{id:f.org.id},data:{deletedAt:new Date()}});}finally{remote.state.holdAccount=null;release();}
 assert.equal((await pending).success,false);assert.equal((await binding(f)).isActive,false);assert.equal(remote.state.users.length,beforeUsers);const calls=remote.state.calls.length;assert.equal((await service.provisionChatwootForOrg(f.input)).error,'organization_inactive');assert.equal(remote.state.calls.length,calls);
});

test('two explicitly identified organizations may share a display name without sharing accounts or sessions',async()=>{
 const a=await fixture(),b=await fixture();assert.equal((await service.provisionChatwootForOrg(a.input)).success,true);
 await db.organization.update({where:{id:b.org.id},data:{name:a.org.name}});assert.equal((await service.provisionChatwootForOrg(b.input)).success,true);
 const left=JSON.parse((await binding(a)).data),right=JSON.parse((await binding(b)).data);assert.notEqual(left.chatwootAccountId,right.chatwootAccountId);assert.notEqual(left.chatwootUserId,right.chatwootUserId);assert.notEqual((await binding(a)).accessTokenEnc,(await binding(b)).accessTokenEnc);
});


test('P1 owner: a concurrent Chatwoot identity assignment is preserved and blocks success',async(t)=>{
 const f=await fixture(),other=await fixture();const untouched=await db.user.findUniqueOrThrow({where:{id:other.owner.id}});
 remote.state.holdWebhook=async()=>{await db.user.update({where:{id:f.owner.id},data:{chatwootUserId:999}});};t.after(()=>{remote.state.holdWebhook=null;});
 const result=await service.provisionChatwootForOrg(f.input);assert.equal(result.success,false,'Concurrent owner binding must prevent ready');
 assert.equal((await db.user.findUniqueOrThrow({where:{id:f.owner.id}})).chatwootUserId,999);assert.equal((await binding(f)).isActive,false);
 assert.equal(JSON.stringify(await db.user.findUniqueOrThrow({where:{id:other.owner.id}})),JSON.stringify(untouched));
});

test('P1 webhook: lost POST response followed by GET 405 never creates a second webhook',async(t)=>{
 const f=await fixture();remote.state.dropWebhookResponseOnce=true;t.after(()=>{remote.state.webhookListStatus=200;remote.state.hideWebhooks=false;});
 assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);const id=JSON.parse((await binding(f)).data).chatwootAccountId;
 assert.equal(remote.state.webhooks.filter(w=>w.accountId===id).length,1);remote.state.webhookListStatus=405;
 assert.equal((await service.provisionChatwootForOrg(f.input)).success,false,'Inconclusive lookup cannot authorize another creation');assert.equal(remote.state.webhooks.filter(w=>w.accountId===id).length,1);
});

test('P2 ready: negative validation persists across GET and a new positive validation recovers it',async()=>{
 const f=await fixture();assert.equal((await service.provisionChatwootForOrg(f.input)).success,true);const before=await binding(f),data=JSON.parse(before.data);
 const foreign={id:remote.state.nextAccount++,name:'Foreign validation fixture',custom_attributes:{},members:[data.chatwootUserId]};remote.state.accounts.push(foreign);
 assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);assert.equal((await service.getChatwootProvisionStatus(f.org.id)).provisioned,false,'GET must retain the failed validation');
 const failed=await binding(f);assert.equal(failed.data,before.data);assert.equal(failed.accessTokenEnc,before.accessTokenEnc);assert.equal(failed.isActive,true);
 remote.state.accounts.splice(remote.state.accounts.indexOf(foreign),1);
 assert.equal((await service.provisionChatwootForOrg(f.input)).success,true);assert.equal((await service.getChatwootProvisionStatus(f.org.id)).provisioned,true);
});

test('P1 owner: final transaction CAS independently rejects a changed owner identity',async()=>{
 const f=await fixture();let changed=false;
 const proxy=new Proxy(db,{get(target,key){if(key==='$transaction')return(callback,options)=>db.$transaction(tx=>callback(new Proxy(tx,{get(inner,field){if(field==='$queryRaw')return async(...args)=>{const result=await inner.$queryRaw(...args);if(!changed){changed=true;await db.user.update({where:{id:f.owner.id},data:{chatwootUserId:998}});}return result;};return Reflect.get(inner,field);}})),options);return Reflect.get(target,key);}});
 const env={CHATWOOT_API_URL:remote.base,CHATWOOT_PLATFORM_TOKEN:remote.platformToken,CHATWOOT_WEBHOOK_SECRET:'synthetic-webhook-only',NEXTAUTH_URL:'http://127.0.0.1:3100'};
 const guarded=loadHandler('src/lib/integrations/chatwoot-provision.ts',{'@/lib/prisma':{prisma:proxy},'@/lib/integrations/crypto':{encryptToken,decryptToken}},{process:{env},fetch:remote.fetch});
 const result=await guarded.provisionChatwootForOrg(f.input);assert.equal(result.error,'owner_binding_requires_review');assert.equal(changed,true);assert.equal((await db.user.findUniqueOrThrow({where:{id:f.owner.id}})).chatwootUserId,998);
 assert.equal((await binding(f)).isActive,false);assert.equal((await binding(f)).lastError,'owner_binding_requires_review');assert.equal((await db.organization.findUniqueOrThrow({where:{id:f.org.id}})).chatwootAccountId,null);assert.equal(await db.activity.count({where:{entityId:f.org.id}}),0);
});

test('P1 webhook: unknown POST outcome is fenced through unavailable and inconclusive lists, then reconciled by remote evidence',async(t)=>{
 const f=await fixture();remote.state.dropWebhookResponseOnce=true;t.after(()=>{remote.state.webhookListStatus=200;remote.state.webhookListBody=undefined;remote.state.hideWebhooks=false;});
 assert.equal((await service.provisionChatwootForOrg(f.input)).error,'webhook_requires_review');const pending=await binding(f),data=JSON.parse(pending.data),postCount=remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length;
 assert.equal(data.provisioning.webhook.attempted,true);assert.equal(remote.state.webhooks.filter(w=>w.accountId===data.chatwootAccountId).length,1);
 for(const status of [404,405,500]){remote.state.webhookListStatus=status;assert.equal((await service.provisionChatwootForOrg(f.input)).error,'webhook_requires_review');}
 remote.state.webhookListStatus=200;
 for(const body of [{unexpected:[]},null,[{}]]){remote.state.webhookListBody=body;assert.equal((await service.provisionChatwootForOrg(f.input)).error,'webhook_requires_review');}
 remote.state.webhookListBody=undefined;remote.state.hideWebhooks=true;assert.equal((await service.provisionChatwootForOrg(f.input)).error,'webhook_requires_review','Even a later empty list cannot replay an unknown POST');
 remote.state.hideWebhooks=false;assert.equal((await service.provisionChatwootForOrg(f.input)).success,true);assert.equal(remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length,postCount);assert.equal((await binding(f)).isActive,true);assert.equal(JSON.parse((await binding(f)).data).provisioning.webhook.id,remote.state.webhooks.find(w=>w.accountId===data.chatwootAccountId).id);
});

for(const kind of ['405','timeout','invalid-json'])test('P1 webhook: fresh '+kind+' lookup never permits creation',async()=>{
 const f=await fixture(),env={CHATWOOT_API_URL:remote.base,CHATWOOT_PLATFORM_TOKEN:remote.platformToken,CHATWOOT_WEBHOOK_SECRET:'synthetic-webhook-only',NEXTAUTH_URL:'http://127.0.0.1:3100'};
 const guarded=loadHandler('src/lib/integrations/chatwoot-provision.ts',{'@/lib/prisma':{prisma:db},'@/lib/integrations/crypto':{encryptToken,decryptToken}},{process:{env},fetch:async(url,options)=>{if(options?.method==='GET'&&new URL(url).pathname.endsWith('/webhooks')){if(kind==='timeout')throw new DOMException('Synthetic timeout','TimeoutError');return new Response(kind==='invalid-json'?'invalid':'{}',{status:kind==='405'?405:200});}return remote.fetch(url,options);}});
 const posts=remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length;assert.equal((await guarded.provisionChatwootForOrg(f.input)).error,'webhook_requires_review');assert.equal(remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length,posts);assert.equal((await binding(f)).isActive,false);
 assert.equal((await service.provisionChatwootForOrg(f.input)).success,true,'A failed lookup before any POST can recover after a conclusive list');
});

test('P1 webhook: durable intent fences concurrent retries and an expired lease while the first POST is still running',async(t)=>{
 const f=await fixture();let release,entered;const gate=new Promise(r=>{entered=r;});remote.state.holdWebhook=async()=>{const data=JSON.parse((await binding(f)).data);assert.equal(data.provisioning.webhook.attempted,true,'Intent must commit before POST effect');entered();await new Promise(r=>{release=r;});};t.after(()=>{remote.state.holdWebhook=null;release?.();});
 const pending=service.provisionChatwootForOrg(f.input);await gate;
 assert.equal((await service.provisionChatwootForOrg(f.input)).error,'provisioning_in_progress');
 const stored=await binding(f),data=JSON.parse(stored.data);data.provisioning.leaseUntil=new Date(0).toISOString();await db.connectedAccount.update({where:{id:stored.id},data:{data:JSON.stringify(data)}});
 assert.equal((await service.provisionChatwootForOrg(f.input)).error,'webhook_requires_review','A takeover cannot replay an in-flight POST even when its list is empty');
 remote.state.holdWebhook=null;release();assert.equal((await pending).success,false,'Stale runner cannot commit ready');
 const accountId=JSON.parse((await binding(f)).data).chatwootAccountId;assert.equal(remote.state.webhooks.filter(w=>w.accountId===accountId).length,1);
 assert.equal((await service.provisionChatwootForOrg(f.input)).success,true);assert.equal(remote.state.webhooks.filter(w=>w.accountId===accountId).length,1);
});

test('P1 webhook: legacy phase without mutation intent is ambiguous and never replayed',async(t)=>{
 const f=await fixture();remote.state.dropWebhookResponseOnce=true;assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);const prior=await binding(f),data=JSON.parse(prior.data);delete data.provisioning.webhook;await db.connectedAccount.update({where:{id:prior.id},data:{data:JSON.stringify(data)}});remote.state.hideWebhooks=true;t.after(()=>{remote.state.hideWebhooks=false;});const posts=remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length;
 assert.equal((await service.provisionChatwootForOrg(f.input)).error,'webhook_requires_review');assert.equal(remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length,posts);
 remote.state.hideWebhooks=false;assert.equal((await service.provisionChatwootForOrg(f.input)).success,true);
});


test('P2 ready: retries never reclassify or clear an unrelated active integration error',async()=>{
 const f=await fixture();assert.equal((await service.provisionChatwootForOrg(f.input)).success,true);
 await db.connectedAccount.update({where:{id:(await binding(f)).id},data:{lastError:'webhook_delivery_failed'}});const snapshot=JSON.stringify(await binding(f)),calls=remote.state.calls.length;
 for(let i=0;i<2;i++){assert.equal((await service.provisionChatwootForOrg(f.input)).error,'binding_requires_review');assert.equal(JSON.stringify(await binding(f)),snapshot);assert.equal((await service.getChatwootProvisionStatus(f.org.id)).provisioned,false);}
 assert.equal(remote.state.calls.length,calls);
});


test('P1 webhook: legacy attempt evidence survives membership recovery before webhook reconciliation',async(t)=>{
 const f=await fixture();remote.state.dropWebhookResponseOnce=true;assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);const prior=await binding(f),data=JSON.parse(prior.data);delete data.provisioning.webhook;await db.connectedAccount.update({where:{id:prior.id},data:{data:JSON.stringify(data)}});
 const account=remote.state.accounts.find(a=>a.id===data.chatwootAccountId);account.members=[];remote.state.hideWebhooks=true;t.after(()=>{remote.state.hideWebhooks=false;});const posts=remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length;
 assert.equal((await service.provisionChatwootForOrg(f.input)).error,'webhook_requires_review');assert.equal(remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length,posts);assert.equal(JSON.parse((await binding(f)).data).provisioning.webhook.attempted,true);assert.equal((await binding(f)).isActive,false);
 remote.state.hideWebhooks=false;assert.equal((await service.provisionChatwootForOrg(f.input)).success,true);assert.equal(remote.state.webhooks.filter(w=>w.accountId===data.chatwootAccountId).length,1);
});


test('4.17 compatibility: new account uses direct POST even when global GET returns 500',async(t)=>{
 const f=await fixture();remote.state.accountListStatus=500;t.after(()=>{remote.state.accountListStatus=200;});const begin=remote.state.calls.length;
 const result=await service.provisionChatwootForOrg(f.input);assert.equal(result.success,true,result.error);const calls=remote.state.calls.slice(begin);assert.equal(calls.some(c=>c.method==='GET'&&c.path==='/platform/api/v1/accounts'),false);assert.equal(calls.filter(c=>c.method==='POST'&&c.path==='/platform/api/v1/accounts').length,1);assert.equal((await service.getChatwootProvisionStatus(f.org.id)).provisioned,true);
});

test('4.17 compatibility: known account resumes through scoped proof when global GET is broken',async(t)=>{
 const f=await fixture();remote.state.failMembershipOnce=true;assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);const created=creations();remote.state.accountListStatus=500;t.after(()=>{remote.state.accountListStatus=200;});
 assert.equal((await service.provisionChatwootForOrg(f.input)).success,true);assert.equal(creations(),created);
});

test('4.17 compatibility: unknown account POST outcome never replays while global GET is unavailable',async(t)=>{
 const f=await fixture();dropResponse=true;assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);const created=creations();remote.state.accountListStatus=500;t.after(()=>{remote.state.accountListStatus=200;});
 for(let i=0;i<2;i++){assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);assert.equal(creations(),created);assert.equal((await service.getChatwootProvisionStatus(f.org.id)).provisioned,false);}
 remote.state.accountListStatus=200;assert.equal((await service.provisionChatwootForOrg(f.input)).success,true);assert.equal(creations(),created);
});


test('4.17 compatibility: global list outage never bypasses scoped tenant ownership proof',async(t)=>{
 const f=await fixture();remote.state.failMembershipOnce=true;assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);const account=remote.state.accounts.find(a=>a.custom_attributes.crmOrganizationId===f.org.id);account.custom_attributes={...account.custom_attributes,crmOrganizationId:randomUUID()};remote.state.accountListStatus=500;t.after(()=>{remote.state.accountListStatus=200;});const writes=remote.state.calls.filter(c=>c.method==='POST').length;
 assert.equal((await service.provisionChatwootForOrg(f.input)).error,'account_requires_review');assert.equal(remote.state.calls.filter(c=>c.method==='POST').length,writes);assert.equal((await binding(f)).isActive,false);assert.equal((await db.user.findUniqueOrThrow({where:{id:f.owner.id}})).chatwootUserId,null);assert.equal((await service.getChatwootProvisionStatus(f.org.id)).provisioned,false);
});


test('4.17 webhook templates: payload.webhook POST and payload.webhooks GET persist one remote ID without leaking secret',async()=>{
 const f=await fixture(),begin=remote.state.calls.length;const result=await service.provisionChatwootForOrg(f.input);assert.equal(result.success,true,result.error);
 const stored=await binding(f),data=JSON.parse(stored.data),webhooks=remote.state.webhooks.filter(w=>w.accountId===data.chatwootAccountId);assert.equal(webhooks.length,1);assert.equal(data.provisioning.webhook.id,webhooks[0].id);assert.equal(data.provisioning.webhook.attempted,true);assert.equal(stored.isActive,true);
 const calls=remote.state.calls.slice(begin);assert.equal(calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length,1);
 assert.equal((await service.provisionChatwootForOrg(f.input)).success,true);assert.equal(remote.state.calls.slice(begin).filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length,1);
 assert.ok(providerLogs.every(line=>!line.includes('synthetic-response-secret-only')));assert.ok(!stored.data.includes('synthetic-response-secret-only'));assert.ok(!JSON.stringify(await service.getChatwootProvisionStatus(f.org.id)).includes('synthetic-response-secret-only'));
});


test('4.17 webhook templates: lost response reconciles payload.webhooks without another POST',async()=>{
 const f=await fixture();remote.state.dropWebhookResponseOnce=true;assert.equal((await service.provisionChatwootForOrg(f.input)).error,'webhook_requires_review');const data=JSON.parse((await binding(f)).data),posts=remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length;
 assert.equal(data.provisioning.webhook.attempted,true);assert.equal((await service.provisionChatwootForOrg(f.input)).success,true);assert.equal(remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length,posts);assert.equal(remote.state.webhooks.filter(w=>w.accountId===data.chatwootAccountId).length,1);
});

for(const kind of ['zero-id','negative-id','invalid-id','wrong-url','missing-webhook','missing-payload','root-lookalike'])test('4.17 webhook templates: '+kind+' never activates or replays POST',async()=>{
 const f=await fixture(),logs=[],env={CHATWOOT_API_URL:remote.base,CHATWOOT_PLATFORM_TOKEN:remote.platformToken,CHATWOOT_WEBHOOK_SECRET:'synthetic-webhook-only',NEXTAUTH_URL:'http://127.0.0.1:3100'};
 const guarded=loadHandler('src/lib/integrations/chatwoot-provision.ts',{'@/lib/prisma':{prisma:db},'@/lib/integrations/crypto':{encryptToken,decryptToken}},{process:{env},console:{info(...v){logs.push(v.join(' '));},warn(...v){logs.push(v.join(' '));},error(...v){logs.push(v.join(' '));}},fetch:async(url,options)=>{
  const response=await remote.fetch(url,options);if(options?.method!=='POST'||!new URL(url).pathname.endsWith('/webhooks')||!response.ok)return response;
  let body=await response.json();assert.deepEqual(Object.keys(body.payload.webhook).sort(),['id','name','url','account_id','subscriptions','secret'].sort());
  if(kind==='zero-id')body.payload.webhook.id=0;if(kind==='negative-id')body.payload.webhook.id=-1;if(kind==='invalid-id')body.payload.webhook.id='invalid';if(kind==='wrong-url')body.payload.webhook.url='https://wrong.example.invalid/api/webhooks/chatwoot';if(kind==='missing-webhook')body.payload={};if(kind==='missing-payload')body={};if(kind==='root-lookalike')body=body.payload.webhook;
  return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
 }});
 assert.equal((await guarded.provisionChatwootForOrg(f.input)).error,'webhook_requires_review');const data=JSON.parse((await binding(f)).data),posts=remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length;
 assert.equal((await binding(f)).isActive,false);assert.equal(data.provisioning.webhook.attempted,true);assert.equal((await service.getChatwootProvisionStatus(f.org.id)).provisioned,false);assert.equal(remote.state.webhooks.filter(w=>w.accountId===data.chatwootAccountId).length,1);
 remote.state.hideWebhooks=true;try{assert.equal((await guarded.provisionChatwootForOrg(f.input)).error,'webhook_requires_review');}finally{remote.state.hideWebhooks=false;}
 assert.equal(remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length,posts);assert.ok(logs.every(line=>!line.includes('synthetic-response-secret-only')));assert.ok(!(await binding(f)).data.includes('synthetic-response-secret-only'));
 assert.equal((await service.provisionChatwootForOrg(f.input)).success,true,'A later conclusive GET can reconcile the existing webhook');assert.equal(remote.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/webhooks')).length,posts);
});
