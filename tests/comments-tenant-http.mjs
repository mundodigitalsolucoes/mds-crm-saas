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
 const password=crypto.randomBytes(24).toString('hex'), passwordHash=await bcrypt.hash(password,10), actors=[];
 for(const [i,label] of ['a','b'].entries()) {
  const org=await db.organization.create({data:{name:'Comments isolated fixture',slug:'comments-p1-'+crypto.randomUUID(),plan:'trial',trialEndsAt:new Date(Date.now()+86400000)}});orgs.push(org);
  const user=await db.user.create({data:{organizationId:org.id,name:label,email:crypto.randomUUID()+'@example.invalid',passwordHash,role:'owner'}});
  const client=new Client('198.51.100.'+(210+i));await client.login(user,password);
  const task=await db.task.create({data:{organizationId:org.id,title:'Own task',createdById:user.id}});
  actors.push({org,user,client,task});
 }
 const [a,b]=actors;
 const foreignParent=await db.comment.create({data:{organizationId:b.org.id,entityType:'task',entityId:b.task.id,authorId:b.user.id,content:'Foreign root'}});
 const parent=await db.comment.create({data:{organizationId:a.org.id,entityType:'task',entityId:a.task.id,authorId:a.user.id,content:'Legitimate root'}});
 const post=await b.client.json('/api/comments','POST',{entityType:'task',entityId:b.task.id,parentId:parent.id,content:'foreign-reply-marker'});
 const persisted=await db.comment.count({where:{organizationId:b.org.id,parentId:parent.id}});
 results.push({case:'foreign-parent-write',status:post.status,persisted,passed:[400,403,404].includes(post.status)&&persisted===0});
 // Persist a historical corrupt relation even after the fix, to test defensive reads independently.
 if(!persisted)await db.comment.create({data:{organizationId:b.org.id,entityType:'task',entityId:b.task.id,authorId:b.user.id,parentId:parent.id,content:'foreign-reply-marker'}});
 const get=await a.client.request('/api/comments?entityType=task&entityId='+a.task.id);
 results.push({case:'foreign-reply-read',status:get.status,foreignDataReturned:get.body.includes('foreign-reply-marker'),passed:get.status===200&&!get.body.includes('foreign-reply-marker')});
 for(const [i,role] of ['owner','admin','user'].entries()) {
  const permissions=Object.fromEntries(['tasks','leads','projects'].map(k=>[k,{view:true,edit:true,create:true,delete:true}]));
  const user=await db.user.create({data:{organizationId:a.org.id,name:role,email:crypto.randomUUID()+'@example.invalid',passwordHash,role,permissions:JSON.stringify(permissions)}});
  const client=new Client('198.51.100.'+(220+i));await client.login(user,password);
  for(const entityType of ['task','lead','goal','kanban_card']) {
   let entityId;
   if(entityType==='task')entityId=a.task.id;
   if(entityType==='lead')entityId=(await db.lead.create({data:{organizationId:a.org.id,name:'Own lead'}})).id;
   if(entityType==='goal')entityId=(await db.goal.create({data:{organizationId:a.org.id,title:'Own goal',createdById:user.id}})).id;
   if(entityType==='kanban_card') {
    const board=await db.kanbanBoard.create({data:{organizationId:a.org.id,title:'Own board',createdById:user.id}});
    const column=await db.kanbanColumn.create({data:{boardId:board.id,title:'Own column',position:0}});
    entityId=(await db.kanbanCard.create({data:{columnId:column.id,title:'Own card',position:0}})).id;
   }
   const root=await client.json('/api/comments','POST',{entityType,entityId,content:'Legitimate '+role});
   const rootBody=JSON.parse(root.body);
   const reply=await client.json('/api/comments','POST',{entityType,entityId,parentId:rootBody.id,content:'Legitimate reply'});
   const read=await client.request('/api/comments?entityType='+entityType+'&entityId='+entityId);
   const tree=JSON.parse(read.body);
   results.push({case:'same-tenant-root-reply',role,entityType,statuses:[root.status,reply.status,read.status],passed:root.status===201&&reply.status===201&&read.status===200&&Array.isArray(tree)&&tree.some(c=>c.id===rootBody.id&&c.replies.some(r=>r.id===JSON.parse(reply.body).id))});
   for(const [kind,parentId] of [['foreign-parent',foreignParent.id],['wrong-entity',parent.id],['missing-parent',crypto.randomUUID()]]) {
    if(kind==='wrong-entity'&&entityType==='task')continue;
    const before=await db.comment.count({where:{organizationId:a.org.id}});
    const response=await client.json('/api/comments','POST',{entityType,entityId,parentId,content:'Must not persist'});
    const after=await db.comment.count({where:{organizationId:a.org.id}});
    results.push({case:kind,role,entityType,status:response.status,persisted:after-before,passed:[400,403,404].includes(response.status)&&before===after});
   }
  }
  for(const method of ['GET','POST']) {
   const before=await db.comment.count({where:{organizationId:a.org.id}});
   const response=method==='GET'?await client.request('/api/comments?entityType=task&entityId='+b.task.id):await client.json('/api/comments','POST',{entityType:'task',entityId:b.task.id,content:'Must not persist foreign entity'});
   const persisted=(await db.comment.count({where:{organizationId:a.org.id}}))-before;
   results.push({case:'foreign-entity',role,method,status:response.status,persisted,passed:response.status===404&&persisted===0&&!response.body.includes(b.org.id)});
  }
 }
 const notifications=await db.notification.count({where:{user:{organizationId:{in:orgs.map(o=>o.id)}}}});
 const passed=results.every(r=>r.passed)&&notifications===0;
 console.log(JSON.stringify({kind:'COMMENTS_P1_HTTP_SECURITY_ACCEPTANCE',results,notifications,passed},null,2));if(!passed)process.exitCode=1;
} catch(error) {console.error(JSON.stringify({name:error.name,code:error.code||null}));process.exitCode=1;}
finally {
 const ids=orgs.map(o=>o.id);
 await db.comment.deleteMany({where:{organizationId:{in:ids}}});
 for(const org of orgs)await db.organization.delete({where:{id:org.id}});
 await db.$disconnect();
}
