// Rollback/kill-switch acceptance: new custom-origin sessions never become canonical legacy sessions.
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createConnection} from 'node:net';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { encode } from 'next-auth/jwt';
const url=new URL(process.env.DATABASE_URL||'http://invalid');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/mds_crm_dev');assert.notEqual(process.env.CRM_CUSTOM_DOMAINS_ENABLED,'true');
const db=new PrismaClient();let org;
try{
 org=await db.organization.create({data:{name:'Disabled domain fixture',slug:'domain-disabled-'+randomUUID(),plan:'trial',trialEndsAt:new Date(Date.now()+86400000)}});
 const user=await db.user.create({data:{organizationId:org.id,name:'Disabled domain fixture',email:randomUUID()+'@example.invalid',passwordHash:'not-a-login-credential',role:'owner'}});
 const lead=await db.lead.create({data:{organizationId:org.id,name:'Private disabled-domain fixture'}});
 const base='http://127.0.0.1:3100',tokenBase={id:user.id,organizationId:org.id,plan:'trial',planStatus:'active',trialEndsAt:new Date(Date.now()+86400000).toISOString()};
 const custom=await encode({secret:process.env.NEXTAUTH_SECRET,token:{...tokenBase,domainOrigin:'https://crm.customer.example.com',domainOrganizationId:org.id},maxAge:3600});
 const denied=await fetch(base+'/api/leads',{headers:{cookie:'next-auth.session-token='+custom}});assert.equal(denied.status,401);assert.ok(!(await denied.text()).includes(lead.id));
 const legacy=await encode({secret:process.env.NEXTAUTH_SECRET,token:tokenBase,maxAge:3600});
 const allowed=await fetch(base+'/api/leads',{headers:{cookie:'next-auth.session-token='+legacy}});assert.equal(allowed.status,200);assert.ok((await allowed.text()).includes(lead.id));
 const unknown=await new Promise((accept,reject)=>{const req=httpRequest(base+'/auth/login',{headers:{host:'unknown.customer.example.com'}},res=>{res.resume();res.on('end',()=>accept(res.statusCode));});req.on('error',reject);req.end();});assert.equal(unknown,421);
 const missingHost=await new Promise((accept,reject)=>{let response='';const socket=createConnection({host:'127.0.0.1',port:3100},()=>socket.end('GET /auth/login HTTP/1.0\r\n\r\n'));socket.setTimeout(5000,()=>socket.destroy(Error('LOCAL_TIMEOUT')));socket.on('data',chunk=>{response+=chunk;});socket.on('error',reject);socket.on('end',()=>accept(response));});assert.match(missingHost,/^HTTP\/1\.[01] (400|421) /);
 console.log(JSON.stringify({passed:true,missingHostDenied:true,customSessionRemainsDeniedAfterFeatureDisabled:true,legacyCanonicalSessionPreserved:true,unverifiedHostnameDeniedWithFeatureDisabled:true,productionAccess:false},null,2));
}finally{if(org)await db.organization.delete({where:{id:org.id}});await db.$disconnect();}
