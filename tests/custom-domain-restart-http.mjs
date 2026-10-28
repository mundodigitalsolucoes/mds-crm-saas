// Two real Next server processes share only synthetic persisted fixtures.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { request } from 'node:http';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { createDomainManager } from '../src/lib/domains/manager.ts';
import { disposableDatabaseUrl } from './helpers/load-disposable-handler.mjs';
assert.equal(process.env.BLOCK2_DOMAIN_TEST,'synthetic-local-only');
assert.ok(process.env.CRM_CUSTOM_DOMAIN_PROXY_SECRET?.startsWith('synthetic-domain-proxy-'));
const file=resolve(process.argv[3]||'');assert.equal(dirname(file),resolve(process.env.BLOCK2_DOMAIN_FIXTURE_ROOT||'/tmp/no-fixture'));assert.equal(dirname(file).endsWith('/block2-custom-domain-http'),true);assert.equal(file.endsWith('/restart-private.fixture'),true);
const db=new PrismaClient({datasources:{db:{url:disposableDatabaseUrl()}}});
try{
 if(process.argv[2]==='prepare'){
  const password=randomBytes(32).toString('hex'),slug='restart-'+randomUUID(),host=slug+'.example.com';
  const org=await db.organization.create({data:{name:'Synthetic restart domain',slug,plan:'enterprise',features:'["vendas","white_label","custom_domain"]'}});
  writeFileSync(file,JSON.stringify({id:org.id,host,password}),{mode:0o600});
  const user=await db.user.create({data:{organizationId:org.id,name:'Restart fixture',email:slug+'@example.invalid',passwordHash:await bcrypt.hash(password,10),role:'owner'}});
  const lead=await db.lead.create({data:{organizationId:org.id,name:'Private restart fixture'}});
  const manager=createDomainManager(db,async()=>({ok:true,certificateExpiresAt:new Date(Date.now()+30*86400000).toISOString()}));
  await manager(org.id,'synthetic-restart-admin',{action:'configure',hostname:host});await manager(org.id,'synthetic-restart-admin',{action:'verify'});await manager(org.id,'synthetic-restart-admin',{action:'activate'});
  const settings=JSON.parse((await db.organization.findUniqueOrThrow({where:{id:org.id}})).settings),state=settings.customDomainV1;
  state.checkedAt=state.verifiedAt=new Date(Date.now()-3*86400000).toISOString();state.verifiedUntil=new Date(Date.now()-2*86400000).toISOString();state.activatedAt=state.checkedAt;
  await db.organization.update({where:{id:org.id},data:{settings:JSON.stringify(settings)}});
  writeFileSync(file,JSON.stringify({id:org.id,host,password,email:user.email,lead:lead.id,settings}),{mode:0o600});
  console.log(JSON.stringify({prepared:true}));
 }else{
  const f=JSON.parse(readFileSync(file,'utf8'));
  if(process.argv[2]==='cleanup'){
   await db.activity.deleteMany({where:{entityId:f.id}});await db.organization.delete({where:{id:f.id}});unlinkSync(file);
  }else{
   assert.equal(process.argv[2],'check');const cookies=new Map();
   async function call(path,body){return new Promise((accept,reject)=>{
    const req=request('http://127.0.0.1:3100'+path,{method:body?'POST':'GET',headers:{host:f.host,'x-forwarded-proto':'https','x-crm-proxy-key':process.env.CRM_CUSTOM_DOMAIN_PROXY_SECRET,'content-type':'application/x-www-form-urlencoded',cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}},res=>{
     const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',reject);res.on('end',()=>{for(const c of res.headers['set-cookie']||[]){const pair=c.split(';')[0],at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1));}accept({status:res.statusCode,body:Buffer.concat(chunks).toString()});});
    });req.setTimeout(15000,()=>req.destroy(Error('LOCAL_TIMEOUT')));req.on('error',reject);req.end(body?.toString());
   });}
   assert.equal((await call('/auth/login')).status,200);
   const csrf=JSON.parse((await call('/api/auth/csrf')).body).csrfToken;
   assert.equal((await call('/api/auth/callback/credentials',new URLSearchParams({email:f.email,password:f.password,csrfToken:csrf,json:'true'}))).status,200);
   const leads=await call('/api/leads');assert.equal(leads.status,200);assert.ok(leads.body.includes(f.lead));
   assert.equal((await db.organization.findUniqueOrThrow({where:{id:f.id}})).settings,JSON.stringify(f.settings),'Restart/access must not mutate or renew activation');
   console.log(JSON.stringify({passed:true,olderThan24Hours:true,login:200,authorizedData:200}));
  }
 }
}finally{await db.$disconnect();}
