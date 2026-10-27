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

test('unavailable Chatwoot preserves organization, owner and recoverable checkpoint',async()=>{
 const f=await fixture(),before=creations();remote.state.failListOnce=true;
 assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);assert.equal(creations(),before);assert.ok(await db.user.findUnique({where:{id:f.owner.id}}));assert.equal((await binding(f)).isActive,false);
 assert.equal((await service.provisionChatwootForOrg({...f.input,allowCreate:false})).success,true);
});

test('lost account response is reconciled by exact durable operation marker, without another account POST',async()=>{
 const f=await fixture();dropResponse=true;const before=creations();assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);assert.equal(creations(),before+1);
 assert.equal((await service.provisionChatwootForOrg({...f.input,allowCreate:false})).success,true);assert.equal(creations(),before+1);
});

for(const failure of ['failMembershipOnce','failWebhookOnce'])test('resume '+failure+' without duplicate account/user and without replacing provider data',async()=>{
 const f=await fixture(),before=creations(),users=remote.state.users.length;remote.state[failure]=true;
 assert.equal((await service.provisionChatwootForOrg(f.input)).success,false);const partial=await binding(f);assert.equal(partial.isActive,false);
 assert.equal((await service.provisionChatwootForOrg({...f.input,allowCreate:false})).success,true);assert.equal(creations(),before+1);assert.equal(remote.state.users.length,users+1);assert.ok(providerLogs.every(line=>!remote.state.users.some(user=>line.includes(user.access_token))),'Upstream token echoes never enter logs');assert.equal((await db.organization.findUniqueOrThrow({where:{id:f.org.id}})).settings,f.org.settings);
});

test('concurrent requests reserve one operation and never create a second account',async()=>{
 const f=await fixture();let release,entered;const waiting=new Promise(r=>{entered=r;});remote.state.holdAccount=async()=>{entered();await new Promise(r=>{release=r;});};
 const first=service.provisionChatwootForOrg(f.input);await waiting;
 try{const second=await service.provisionChatwootForOrg(f.input);assert.equal(second.error,'provisioning_in_progress');}finally{remote.state.holdAccount=null;release();}
 assert.equal((await first).success,true);assert.equal(remote.state.accounts.filter(a=>a.custom_attributes.crmOrganizationId===f.org.id).length,1);
});

test('ambiguous remote account is stopped before resource creation and no force path exists',async()=>{
 const f=await fixture();remote.state.accounts.push({id:remote.state.nextAccount++,name:f.org.name,custom_attributes:{},members:[]});const before=creations();
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
 const prior=JSON.stringify(await binding(f)),data=JSON.parse((await binding(f)).data),other={id:remote.state.nextAccount++,name:'Foreign membership fixture',custom_attributes:{},members:[data.chatwootUserId]};remote.state.accounts.push(other);const writes=remote.state.calls.filter(c=>c.method==='POST').length;const rejected=await route.POST(req({force:false}),params);assert.equal(rejected.status,409);assert.equal((await rejected.json()).onboarding.provisioned,false,'Failed remote validation cannot echo a ready local status');assert.equal(JSON.stringify(await binding(f)),prior,'An active integration is never overwritten on ambiguity');assert.equal(remote.state.calls.filter(c=>c.method==='POST').length,writes);
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
