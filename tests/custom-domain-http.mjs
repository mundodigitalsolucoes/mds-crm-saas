// Real NextAuth + real handlers + disposable PostgreSQL. Only the DNS/TLS fixture boundary is injected.
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';
import { createDomainManager } from '../src/lib/domains/manager.ts';
import { routingProof } from '../src/lib/domains/network.ts';
const dburl=new URL(process.env.DATABASE_URL||'http://invalid');assert.equal(dburl.hostname,'127.0.0.1');assert.equal(dburl.port,'5432');assert.equal(dburl.pathname,'/mds_crm_dev');
assert.equal(process.env.CRM_CUSTOM_DOMAINS_ENABLED,'true');assert.equal(process.env.BLOCK2_DOMAIN_TEST,'synthetic-local-only');
const base='http://127.0.0.1:3100',primary='127.0.0.1:3100',secret=process.env.CRM_CUSTOM_DOMAIN_PROXY_SECRET;
assert.ok(secret?.startsWith('synthetic-domain-proxy-'));assert.ok(!process.env.CRM_CUSTOM_DOMAIN_INGRESS_IPS,'No external DNS/TLS during HTTP fixtures');
const db=new PrismaClient(),fixtures=[],plans=[],results=[];let admin,ipIndex=20;
const password=randomBytes(32).toString('hex');
class Client{
 cookies=new Map(); constructor(host=primary,trusted=true){this.host=host;this.trusted=trusted;this.ip='198.51.100.'+(ipIndex++);}
 async request(path,options={}){
  // Fetch normalizes Host to the connection URL; use actual HTTP authority on the wire.
  const response=await new Promise((accept,reject)=>{
   const req=httpRequest(base+path,{method:options.method||'GET',headers:{host:this.host,'x-forwarded-for':this.ip,...(this.trusted?{'x-crm-proxy-key':secret,'x-forwarded-proto':'https'}:{}),cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);res.on('end',()=>accept({status:res.statusCode,body:Buffer.concat(chunks).toString(),location:res.headers.location||null,setCookies:res.headers['set-cookie']||[]}));
   });req.setTimeout(15000,()=>req.destroy(Error('LOCAL_HTTP_TIMEOUT')));req.on('error',reject);req.end(options.body?.toString());
  });
  assert.ok(!response.body.includes(secret),'Ingress secret must never appear in an HTTP response');
  for(const cookie of response.setCookies){const pair=cookie.split(';')[0],index=pair.indexOf('=');this.cookies.set(pair.slice(0,index),pair.slice(index+1));}
  return response;
 }
 json(path,method,data){return this.request(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(data)});}
 async login(user,pwd=password){const csrf=await this.request('/api/auth/csrf');assert.equal(csrf.status,200);const csrfToken=JSON.parse(csrf.body).csrfToken;
  return this.request('/api/auth/callback/credentials',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:user.email,password:pwd,csrfToken,callbackUrl:'https://evil.example.com/stolen',json:'true'})});}
}
function passed(name,details={}){results.push({name,passed:true,...details});}
async function deny(name,client,path,status,options){const r=await client.request(path,options);assert.equal(r.status,status,name);assert.ok(!fixtures.some(f=>r.body.includes(f.user.email)),name+' no foreign identity');passed(name,{status});return r;}
try{
 const hash=await bcrypt.hash(password,10),suffix=randomUUID();
 for(const key of ['a','b','c']){
  const org=await db.organization.create({data:{name:'Domain brand '+key.toUpperCase()+' — FICTITIOUS',slug:'domain-http-'+key+'-'+suffix,features:JSON.stringify(['atendimento','vendas',...(key!=='c'?['white_label','custom_domain']:[])]),logo:'/images/logo-mds.svg?tenant='+key,favicon:'/images/favicon.png?tenant='+key,primaryColor:key==='a'?'#ff8800':'#123456',plan:'trial',trialEndsAt:new Date(Date.now()+86400000)}});
  const user=await db.user.create({data:{organizationId:org.id,name:'Domain HTTP fixture',email:key+'-'+suffix+'@example.invalid',passwordHash:hash,role:'owner'}});
  const lead=await db.lead.create({data:{organizationId:org.id,name:'Private lead '+key}});
  fixtures.push({key,org,user,lead,host:'crm-'+key+'-'+suffix+'.example.com'});
 }
 const [a,b,c]=fixtures;
 admin=await db.superAdmin.create({data:{name:'Domain fixture administrator',email:'domain-admin-'+suffix+'@example.invalid',passwordHash:hash}});
 const mds=new Client();assert.equal((await mds.json('/api/admin/auth','POST',{email:admin.email,password})).status,200);
 const endpoint=f=>'/api/admin/organizations/'+f.org.id+'/domain';
 for(const f of [a,b]){
  assert.equal((await mds.json(endpoint(f),'PATCH',{action:'configure',hostname:f.host})).status,200);
  await deny('pending domain '+f.key,new Client(f.host),'/auth/login',421);
  const nonce='a'.repeat(64),state=JSON.parse((await db.organization.findUnique({where:{id:f.org.id}})).settings).customDomainV1;
  const proof=await new Client(f.host).request('/.well-known/mds-crm-domain-check?nonce='+nonce);assert.equal(proof.status,200);assert.equal(JSON.parse(proof.body).proof,routingProof(secret,f.host,state.challenge,nonce));passed('pending routing attestation '+f.key);
  assert.equal((await mds.json(endpoint(f),'PATCH',{action:'activate'})).status,409);
  const unavailable=await mds.json(endpoint(f),'PATCH',{action:'verify'});assert.equal(unavailable.status,200);assert.equal(JSON.parse(unavailable.body).error,'configuration_missing');passed('incomplete proxy configuration fails verification '+f.key);
  await createDomainManager(db,async()=>({ok:true,certificateExpiresAt:new Date(Date.now()+86400000*30).toISOString()}))(f.org.id,admin.id,{action:'verify'});
  assert.equal((await mds.json(endpoint(f),'PATCH',{action:'activate'})).status,200);
 }
 for(const f of [a,b]){
  const anonymous=new Client(f.host),login=await anonymous.request('/auth/login');assert.equal(login.status,200);assert.ok(login.body.includes(f.org.name));assert.ok(!login.body.includes('Cadastre-se grátis'),'Customer login does not offer another tenant signup');assert.ok(login.body.includes(f.org.logo.replace('&','&amp;')));
  const other=f===a?b:a;assert.ok(!login.body.includes(other.org.logo)&&!login.body.includes(other.org.name));passed('anonymous branded login '+f.key);
 }
 await deny('untrusted direct Host',new Client(a.host,false),'/auth/login',421);
 await deny('unknown hostname',new Client('unknown-'+a.host),'/auth/login',421);
 await deny('forged forwarded host',new Client(a.host),'/auth/login',421,{headers:{'x-forwarded-host':b.host}});
 await deny('forged ingress key',new Client(a.host),'/auth/login',421,{headers:{'x-crm-proxy-key':'forged'}});
 await deny('insecure forwarded scheme',new Client(a.host),'/auth/login',421,{headers:{'x-forwarded-proto':'http'}});
 await deny('custom administrative endpoint',new Client(a.host),endpoint(a),403);
 await deny('encoded administrative path denied',new Client(a.host),'/%61pi/admin/organizations/'+a.org.id+'/domain',403);
 await deny('case-variant administrative path denied',new Client(a.host),'/API/ADMIN/organizations/'+a.org.id+'/domain',403);
 await deny('custom signup page is not offered',new Client(a.host),'/auth/signup',403);
 await deny('custom signup',new Client(a.host),'/api/auth/signup',403,{method:'POST',body:'{}'});
 await deny('public tenant-by-slug resources remain canonical',new Client(a.host),'/api/public/widget/'+b.org.slug,403);
 await deny('legacy static files are not exposed on customer hosts',new Client(a.host),'/uploads/synthetic-foreign.txt',403);
 await deny('image optimizer cannot bypass legacy file restriction',new Client(a.host),'/_next/image?url=%2Fuploads%2Fsynthetic-foreign.png&w=640&q=75',403);
 await deny('provider webhooks remain canonical',new Client(a.host),'/api/webhooks/chatwoot',403,{method:'POST',body:'{}'});
 const ca=new Client(a.host),cb=new Client(b.host),mc=new Client();
 const loginA=await ca.login(a.user);assert.equal(loginA.status,200);assert.equal(new URL(JSON.parse(loginA.body).url).origin,'https://'+a.host,'External callback cannot redirect');
 assert.ok(loginA.setCookies.some(cookie=>cookie.startsWith('__Secure-next-auth.session-token=')&&/; Secure/i.test(cookie)&&/HttpOnly/i.test(cookie)&&!/; Domain=/i.test(cookie)));passed('host-only Secure cookie and same-domain callback');
 assert.equal(JSON.parse((await ca.request('/api/auth/session')).body).user.id,a.user.id);
 await cb.login(b.user);await mc.login(c.user);
 for(const [client,f] of [[ca,a],[cb,b],[mc,c]]){const r=await client.request('/api/leads');assert.equal(r.status,200);assert.ok(r.body.includes(f.lead.id));for(const other of fixtures.filter(x=>x!==f))assert.ok(!r.body.includes(other.lead.id));passed('authorized tenant data '+f.key);}
 // V1.1: persisted active legacy records keep backend access after their old 24h lease.
 for(const f of [a,b]){
  const row=await db.organization.findUniqueOrThrow({where:{id:f.org.id}}),settings=JSON.parse(row.settings),state=settings.customDomainV1;
  state.checkedAt=state.verifiedAt=new Date(Date.now()-3*86400000).toISOString();state.verifiedUntil=new Date(Date.now()-2*86400000).toISOString();
  delete state.activatedAt;delete state.activationRevision;delete state.activationHostname;
  await db.organization.update({where:{id:f.org.id},data:{settings:JSON.stringify(settings)}});
 }
 assert.equal((await ca.request('/api/leads')).status,200);assert.equal((await cb.request('/api/leads')).status,200);passed('legacy active domains remain authorized after 24 hours');
 const monitored=await mds.json(endpoint(a),'PATCH',{action:'verify'});assert.equal(monitored.status,200);assert.equal(JSON.parse(monitored.body).status,'active');assert.equal(JSON.parse(monitored.body).error,'configuration_missing');assert.equal((await ca.request('/api/leads')).status,200);passed('failed monitoring does not revoke a persistent activation');
 const copied=new Client(b.host);copied.cookies=new Map(ca.cookies);await deny('copied session cannot read another host',copied,'/api/leads',401);
 const session=await copied.request('/api/auth/session');assert.ok(!JSON.parse(session.body).user?.id);passed('session endpoint suppresses foreign user');
 const wrongLogin=new Client(a.host);await wrongLogin.login(b.user);assert.ok(!JSON.parse((await wrongLogin.request('/api/auth/session')).body).user?.id);passed('foreign user credentials cannot sign into tenant A');
 const primaryA=new Client();await primaryA.login(a.user);const deniedAdministration=await primaryA.json(endpoint(b),'PATCH',{action:'remove'});assert.equal(deniedAdministration.status,307);assert.equal((await db.organization.findUnique({where:{id:b.org.id}})).domain,b.host);passed('tenant session has no canonical Super Admin authority');const copiedPrimary=new Client(a.host);copiedPrimary.cookies=new Map(primaryA.cookies);await deny('canonical session not transferred to custom host',copiedPrimary,'/api/leads',401);
 const copiedCustom=new Client();copiedCustom.cookies=new Map(ca.cookies);await deny('custom session not transferred to canonical host',copiedCustom,'/api/leads',401);
 const legacy=await encode({secret:process.env.NEXTAUTH_SECRET,token:{id:c.user.id,organizationId:c.org.id,role:'owner',plan:'trial',planStatus:'active',trialEndsAt:new Date(Date.now()+86400000).toISOString()},maxAge:3600});
 const legacyMain=new Client();legacyMain.cookies.set('__Secure-next-auth.session-token',legacy);assert.equal((await legacyMain.request('/api/leads')).status,200);passed('legacy primary session preserved');
 const legacyForeign=new Client(a.host);legacyForeign.cookies.set('__Secure-next-auth.session-token',legacy);await deny('legacy cookie denied on custom domain',legacyForeign,'/api/leads',401);
 for(const role of ['admin','user']){
  const permissions=JSON.stringify({leads:{view:role==='admin'},settings:{view:true,edit:true}});
  const user=await db.user.create({data:{organizationId:a.org.id,name:'Role fixture '+role,email:role+'-'+suffix+'@example.invalid',passwordHash:hash,role,permissions}});
  const client=new Client(a.host);await client.login(user);assert.equal((await client.request('/api/leads')).status,role==='admin'?200:403);await deny('customer '+role+' cannot administer domain',client,endpoint(a),403);passed('operational permissions preserved '+role);
 }
 const commercialPlan=await mds.json('/api/admin/plans','POST',{name:'d-'+randomUUID(),displayName:'Synthetic domain propagation',features:'["atendimento","vendas","white_label","custom_domain"]'});assert.equal(commercialPlan.status,201);const plan=JSON.parse(commercialPlan.body);plans.push(plan.id);
 await db.organization.update({where:{id:b.org.id},data:{plan:plan.name}});
 for(const features of ['["atendimento","vendas","white_label"]','["atendimento","vendas","white_label","custom_domain"]'])assert.equal((await mds.json('/api/admin/plans/'+plan.id,'PUT',{features,propagateToOrgs:true})).status,200);
 await deny('plan regrant does not automatically reactivate domain',new Client(b.host),'/auth/login',421);
 await createDomainManager(db,async()=>({ok:true,certificateExpiresAt:new Date(Date.now()+86400000*30).toISOString()}))(b.org.id,admin.id,{action:'verify'});assert.equal((await mds.json(endpoint(b),'PATCH',{action:'activate'})).status,200);passed('plan propagation preserves explicit activation requirement');
 const transferred=await db.user.create({data:{organizationId:a.org.id,name:'Transfer fixture',email:'transfer-'+suffix+'@example.invalid',passwordHash:hash,role:'owner'}});
 const movedClient=new Client(a.host);await movedClient.login(transferred);await db.user.update({where:{id:transferred.id},data:{organizationId:b.org.id}});
 await deny('membership transfer cannot transfer origin-bound session',movedClient,'/api/leads',401);passed('immutable login organization survives live membership refresh');
 const resetClient=new Client(a.host);assert.equal((await resetClient.json('/api/auth/forgot-password','POST',{email:b.user.email})).status,200);assert.equal(await db.passwordResetToken.count({where:{email:b.user.email}}),0);passed('foreign recovery creates no token');
 assert.equal((await resetClient.json('/api/auth/forgot-password','POST',{email:a.user.email})).status,200);const token=await db.passwordResetToken.findFirstOrThrow({where:{email:a.user.email,used:false}});
 const updatedPassword=randomBytes(32).toString('hex');const foreignReset=await new Client(b.host).json('/api/auth/reset-password','POST',{token:token.token,password:updatedPassword});assert.equal(foreignReset.status,400);assert.equal((await db.passwordResetToken.findUnique({where:{id:token.id}})).used,false);passed('reset token cannot cross tenant domains');
 assert.equal((await resetClient.json('/api/auth/reset-password','POST',{token:token.token,password:updatedPassword})).status,200);assert.equal((await db.passwordResetToken.findUnique({where:{id:token.id}})).used,true);assert.equal(await bcrypt.compare(updatedPassword,(await db.user.findUnique({where:{id:a.user.id}})).passwordHash),true);passed('legitimate domain recovery preserved');
 const csrfToken=JSON.parse((await cb.request('/api/auth/csrf')).body).csrfToken;const logout=await cb.request('/api/auth/signout',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken,callbackUrl:'/auth/login',json:'true'})});assert.equal(logout.status,200);assert.equal(new URL(JSON.parse(logout.body).url).origin,'https://'+b.host);assert.ok(!JSON.parse((await cb.request('/api/auth/session')).body).user?.id);passed('logout remains in same custom origin');
 assert.equal((await mds.json(endpoint(b),'PATCH',{action:'deactivate'})).status,200);await deny('deactivated host denied',new Client(b.host),'/auth/login',421);
 assert.equal((await mds.json(endpoint(a),'PATCH',{action:'configure',hostname:'replacement-'+a.host})).status,200);await deny('old domain invalidated on replacement',ca,'/api/leads',421);await deny('replacement requires new verification',new Client('replacement-'+a.host),'/auth/login',421);
 passed('canonical fallback remains available',{status:(await primaryA.request('/api/leads')).status});assert.equal((await primaryA.request('/api/leads')).status,200);
 console.log(JSON.stringify({passed:true,scenarios:results,networkBoundary:'DNS and TLS success injected only through the actual manager factory; no external DNS/HTTPS or provider calls',productionAccess:false},null,2));
}catch(error){console.error(error instanceof assert.AssertionError?error.message:JSON.stringify({name:error.name,code:error.code||null}));process.exitCode=1;}
finally{
 for(const f of fixtures){await db.passwordResetToken.deleteMany({where:{email:f.user.email}});await db.activity.deleteMany({where:{entityId:f.org.id}});await db.organization.delete({where:{id:f.org.id}});}for(const id of plans)await db.plan.delete({where:{id}});if(admin)await db.superAdmin.delete({where:{id:admin.id}});await db.$disconnect();
}
