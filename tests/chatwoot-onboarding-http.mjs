// Explicit opt-in; launches only its own Next process and a synthetic loopback provider.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { closeSync,mkdtempSync,openSync,readdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { syntheticChatwoot } from './helpers/synthetic-chatwoot.mjs';
import { disposableEnvironment } from '../scripts/block2-c6-ci.mjs';
assert.equal(process.env.CI,'true');assert.equal(process.env.BLOCK2_CI_DISPOSABLE,'true');
assert.ok(!readdirSync('.').some(name=>name.startsWith('.env')&&name!=='.env.example'),'No local environment permitted');
const safe=disposableEnvironment(process.env),db=new PrismaClient({datasources:{db:{url:safe.DATABASE_URL}}}),ids=[],plans=[],cases=[];
const directory=mkdtempSync(resolve(process.env.RUNNER_TEMP||'/tmp','block2-chatwoot-http-'));
const log=openSync(resolve(directory,'server-private.log'),'w',0o600);
const mock=await syntheticChatwoot(),base='http://127.0.0.1:3100';let server,admin;
const password=randomBytes(24).toString('hex'),tokensKey=randomBytes(32).toString('base64');
const env={PATH:process.env.PATH,HOME:'/tmp',DATABASE_URL:safe.DATABASE_URL,NEXTAUTH_URL:base,NEXTAUTH_SECRET:randomBytes(48).toString('hex'),ADMIN_JWT_SECRET:randomBytes(48).toString('hex'),TOKENS_SECRET:tokensKey,NEXT_TELEMETRY_DISABLED:'1',CHATWOOT_API_URL:mock.base,CHATWOOT_PLATFORM_TOKEN:mock.platformToken,CHATWOOT_WEBHOOK_SECRET:'synthetic-http-webhook-only',ATENDIMENTO_USER_SSO_ENABLED:'true'};
class Client{
 cookies=new Map();async request(path,options={}){const r=await fetch(base+path,{redirect:'manual',...options,headers:{cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}});for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],at=pair.indexOf('=');this.cookies.set(pair.slice(0,at),pair.slice(at+1));}return {status:r.status,body:await r.text()};}
 json(path,method,data){return this.request(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(data)});}
 async login(user){const csrfToken=JSON.parse((await this.request('/api/auth/csrf')).body).csrfToken;await this.request('/api/auth/callback/credentials',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:user.email,password,csrfToken,json:'true'})});assert.equal(JSON.parse((await this.request('/api/auth/session')).body).user.id,user.id);}
}
const passed=name=>cases.push({name,passed:true});
try{
 const port=createServer();await new Promise((ok,no)=>{port.once('error',no);port.listen(3100,'127.0.0.1',ok);});await new Promise(ok=>port.close(ok));
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],{env,stdio:['ignore',log,log]});
 let ready=false;for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error('LOCAL_SERVER_EXIT');try{ready=(await fetch(base+'/api/auth/csrf')).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,200));}assert.ok(ready);
 const suffix=randomUUID();admin=await db.superAdmin.create({data:{name:'Synthetic onboarding admin',email:'onboarding-'+suffix+'@example.invalid',passwordHash:await bcrypt.hash(password,10)}});
 const client=new Client();assert.equal((await client.json('/api/admin/auth','POST',{email:admin.email,password})).status,200);
 const plan=await db.plan.create({data:{name:'onboarding-'+suffix,displayName:'Synthetic AV WL domain',price:0,maxUsers:5,maxLeads:100,maxProjects:20,features:'["atendimento","vendas","white_label","custom_domain"]'}});plans.push(plan.id);
 const created=[];
 for(const key of ['a','b']){
  if(key==='b')mock.state.failMembershipOnce=true;
  const response=await client.json('/api/admin/organizations','POST',{name:'Synthetic onboarding '+key+' '+suffix,slug:'onboarding-'+key+'-'+suffix,plan:plan.name,owner:{name:'Synthetic owner '+key,email:key+'-'+suffix+'@example.invalid',password}});
  assert.equal(response.status,201);const org=JSON.parse(response.body);ids.push(org.id);created.push(org);
  assert.ok(!response.body.includes(password)&&!response.body.includes(tokensKey)&&!response.body.includes(mock.platformToken)&&!response.body.includes('accessTokenEnc')&&!response.body.includes('ownerPasswordEnc'));
  assert.equal(org._syncedFromPlan,true);assert.equal(org.features,plan.features);assert.equal(org.owner.email,key+'-'+suffix+'@example.invalid');assert.equal(org.onboarding.provisioned,key==='a');
  passed(key==='a'?'Super Admin creates organization, owner and ready Chatwoot without secrets':'Chatwoot failure preserves CRM organization and owner with recovery');
 }
 const [a,b]=created,endpoint=id=>'/api/admin/orgs/'+id+'/provision-chatwoot',before=mock.state.accounts.length;
 assert.equal((await client.json(endpoint(b.id),'POST',{force:false})).status,200);assert.equal(mock.state.accounts.length,before);passed('recovery resumes known account without duplication');
 const binding=await db.connectedAccount.findUniqueOrThrow({where:{provider_organizationId:{provider:'chatwoot',organizationId:a.id}}});
 assert.equal((await client.json(endpoint(a.id),'POST',{force:false})).status,200);assert.equal(mock.state.accounts.length,before);assert.equal(JSON.stringify(await db.connectedAccount.findUniqueOrThrow({where:{id:binding.id}})),JSON.stringify(binding));passed('already provisioned integration is reused without overwrite');
 assert.equal((await client.json(endpoint(a.id),'POST',{force:true})).status,400);passed('force overwrite rejected');
 for(const org of [a,b]){
  const owner=await db.user.findUniqueOrThrow({where:{id:org.owner.id}}),session=new Client();await session.login(owner);
  const credentials=await session.request('/api/integrations/chatwoot/credentials?organizationId='+([a,b].find(x=>x.id!==org.id).id));assert.equal(credentials.status,200);const dto=JSON.parse(credentials.body),saved=await db.organization.findUniqueOrThrow({where:{id:org.id}});
  assert.equal(dto.organizationId,org.id);assert.equal(dto.chatwootAccountId,saved.chatwootAccountId);assert.equal(dto.chatwootUserId,owner.chatwootUserId);assert.equal(dto.ssoMode,'user');assert.equal(new URL(dto.ssoUrl).origin,mock.base);
  const denied=await session.json(endpoint(org.id),'POST',{force:false});assert.ok([401,403,307].includes(denied.status));passed('real NextAuth and protected automatic SSO remain tenant-scoped '+org.slug.slice(11,12));
 }
 const anonymous=new Client();assert.ok([401,403,307].includes((await anonymous.json('/api/admin/organizations','POST',{name:'Denied'})).status));passed('anonymous onboarding has no effects');
 const signup=new Client(),email='signup-'+suffix+'@example.invalid';const signed=await signup.json('/api/auth/signup','POST',{companyName:'Signup fixture '+suffix,name:'Public owner fixture',email,password,consent:true});assert.equal(signed.status,200);const signedOrg=JSON.parse(signed.body).organization;ids.push(signedOrg.id);
 let connected;for(let i=0;i<150;i++){connected=await db.connectedAccount.findUnique({where:{provider_organizationId:{provider:'chatwoot',organizationId:signedOrg.id}}});if(connected?.isActive)break;await new Promise(r=>setTimeout(r,100));}assert.equal(connected?.isActive,true);passed('public signup still calls the same official Platform API provisioner');
 writeFileSync(resolve(directory,'acceptance.json'),JSON.stringify({passed:true,productionAccess:false,scenarios:cases},null,2));console.log(JSON.stringify({passed:true,scenarios:cases,productionAccess:false,provider:'synthetic loopback only'}));
}catch(error){console.error(JSON.stringify({passed:false,error:error instanceof assert.AssertionError?error.message:'HTTP_ACCEPTANCE_FAILED',name:error.name,code:error.code||null,at:(error.stack||'').split('\n').filter(line=>line.includes('chatwoot-onboarding-http.mjs')).map(line=>line.trim()),completed:cases.map(item=>item.name)}));process.exitCode=1;}
finally{
 if(server){server.kill('SIGTERM');await new Promise(ok=>{if(server.exitCode!==null||server.signalCode!==null)return ok();const timeout=setTimeout(()=>server.kill('SIGKILL'),5000);server.once('exit',()=>{clearTimeout(timeout);ok();});});}
 for(const id of ids){await db.activity.deleteMany({where:{entityId:id}});await db.organization.delete({where:{id}});}for(const id of plans)await db.plan.delete({where:{id}});if(admin)await db.superAdmin.delete({where:{id:admin.id}});await db.$disconnect();await mock.close();closeSync(log);
}
