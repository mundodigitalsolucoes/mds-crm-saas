// Security acceptance probe. Exit 1 means a confirmed cross-tenant vulnerability, never TODO.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '5432'); assert.equal(url.pathname, '/mds_crm_dev');
const db = new PrismaClient(), base = 'http://127.0.0.1:3100', orgs = [], results = [];
class Client {
  cookies = new Map();
  constructor(ip) { this.ip = ip; }
  async request(path, options = {}) {
    const response = await fetch(base + path, { redirect: 'manual', ...options, headers: {
      'x-forwarded-for': this.ip, cookie: [...this.cookies].map(([k, v]) => k + '=' + v).join('; '), ...options.headers,
    } });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], index = pair.indexOf('='); this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return { status: response.status, location: response.headers.get('location'), body: await response.text() };
  }
  json(path, method, data) { return this.request(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }); }
  async login(user, password) {
    const csrfToken = JSON.parse((await this.request('/api/auth/csrf')).body).csrfToken;
    await this.request('/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: user.email, password, csrfToken, callbackUrl: base + '/dashboard', json: 'true' }) });
    assert.equal(JSON.parse((await this.request('/api/auth/session')).body).user?.id, user.id);
  }
}
try {
 const password=crypto.randomBytes(24).toString('hex'), passwordHash=await bcrypt.hash(password,10);
 for(let index=0;index<2;index++)orgs.push(await db.organization.create({data:{name:'Synthetic upload fixture',slug:'upload-p2-'+crypto.randomUUID(),plan:'trial',trialEndsAt:new Date(Date.now()+86400000)}}));
 const lead=await db.lead.create({data:{organizationId:orgs[0].id,name:'Synthetic lead'}});
 const foreign=await db.lead.create({data:{organizationId:orgs[1].id,name:'Foreign synthetic lead'}});
 const clients=[];
 for(const [i,kind] of ['allowed','denied','tasks-only'].entries()){
  const permissions={leads:{view:kind==='allowed',edit:kind==='allowed',delete:kind==='allowed'},tasks:{view:kind==='tasks-only',edit:kind==='tasks-only'},projects:{view:false,edit:false}};
  const user=await db.user.create({data:{organizationId:orgs[0].id,name:kind,email:crypto.randomUUID()+'@example.invalid',passwordHash,role:'user',permissions:JSON.stringify(permissions)}});
  const client=new Client('198.51.100.'+(240+i));await client.login(user,password);clients.push({client,user});
 }
 function form(entityId=lead.id,size=32){const data=new FormData();data.set('entityType','lead');data.set('entityId',entityId);data.set('file',new Blob([new Uint8Array(size)]),'synthetic.txt');return data;}
 async function denied(name,client,options,status){const before=await db.attachment.count({where:{organizationId:orgs[0].id}});const r=await client.request('/api/attachments',{method:'POST',...options});const after=await db.attachment.count({where:{organizationId:orgs[0].id}});assert.equal(r.status,status,name);assert.equal(after,before,name+' no metadata writes');results.push({case:name,status:r.status,metadataWrites:after-before,passed:true});}
 await denied('anonymous-malformed',new Client('198.51.100.249'),{headers:{'content-type':'multipart/form-data; boundary=synthetic'},body:'invalid'},401);
 await denied('no-edit-permission',clients[1].client,{body:form()},403);
 await denied('unrelated-permission',clients[2].client,{body:form()},403);
 await denied('wrong-format',clients[0].client,{headers:{'content-type':'application/json'},body:'{}'},415);
 await denied('malformed-multipart',clients[0].client,{headers:{'content-type':'multipart/form-data; boundary=synthetic'},body:'invalid'},400);
 await denied('foreign-entity',clients[0].client,{body:form(foreign.id)},404);
 await denied('oversize-file',clients[0].client,{body:form(lead.id,10*1024*1024+1)},413);
 for(const size of [32,10*1024*1024]){
  const upload=await clients[0].client.request('/api/attachments',{method:'POST',body:form(lead.id,size)});assert.equal(upload.status,201);const record=JSON.parse(upload.body);
  const download=await clients[0].client.request('/api/attachments/'+record.id);assert.equal(download.status,200);assert.equal(download.body.length,size);
  const removal=await clients[0].client.request('/api/attachments/'+record.id,{method:'DELETE'});assert.equal(removal.status,200);
  results.push({case:'legitimate-upload-download-delete',bytes:size,statuses:[upload.status,download.status,removal.status],passed:true});
 }
 await db.user.update({where:{id:clients[0].user.id},data:{permissions:'{}'}});
 await denied('revoked-permission',clients[0].client,{body:form()},403);
 await db.user.update({where:{id:clients[0].user.id},data:{permissions:JSON.stringify({leads:{view:true,edit:true,delete:true}})}});
 let chunks=0;const stream=new ReadableStream({pull(controller){if(chunks++<12)controller.enqueue(new Uint8Array(1024*1024));else controller.close();}});
 try {await denied('chunked-over-envelope',clients[0].client,{headers:{'content-type':'multipart/form-data; boundary=synthetic'},body:stream,duplex:'half'},413);} catch(error){results.push({case:'chunked-over-envelope',passed:false,expected:413,transportError:error.cause?.code||error.name});}
 const passed=results.every(r=>r.passed);console.log(JSON.stringify({kind:'UPLOAD_P2_REAL_HTTP_POSTGRESQL',results,passed},null,2));if(!passed)process.exitCode=1;
} catch(error){console.error(JSON.stringify({name:error.name,message:error.message,cause:error.cause?.code}));process.exitCode=1;}
finally {for(const org of orgs)await db.organization.delete({where:{id:org.id}});await db.$disconnect();}
