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
const perms=Object.fromEntries(['tasks','leads','projects'].map(k=>[k,{view:true,edit:true,create:true,delete:true}]));
async function seed(a,extra={}){return db.comment.create({data:{organizationId:a.org.id,authorId:a.user.id,entityType:'task',entityId:a.task.id,content:'Synthetic comment',...extra}});}
async function attempt(a,id,name,expected,rows,role){
 const before=await db.comment.findMany({where:{id:{in:rows}},orderBy:{id:'asc'}});
 const response=await a.client.request('/api/comments/'+id,{method:'DELETE'});
 const after=await db.comment.findMany({where:{id:{in:rows}},orderBy:{id:'asc'}});
 const unchanged=JSON.stringify(before)===JSON.stringify(after);
 const passed=response.status===expected&&(expected===200?after.length===0:unchanged)&&!response.body.includes('Synthetic comment')&&!response.body.includes('organizationId');
 results.push({case:name,role,status:response.status,expected,rowsBefore:before.length,rowsAfter:after.length,unchanged,passed});
}
try {
 const password=crypto.randomBytes(24).toString('hex'),passwordHash=await bcrypt.hash(password,10),actors=[];
 for(const [i,label] of ['a','b'].entries()){
  const org=await db.organization.create({data:{name:'DELETE comments fixture',slug:'comments-delete-'+crypto.randomUUID(),plan:'trial',trialEndsAt:new Date(Date.now()+86400000)}});orgs.push(org);
  const user=await db.user.create({data:{organizationId:org.id,name:label,email:crypto.randomUUID()+'@example.invalid',passwordHash,role:'owner'}});
  const client=new Client('198.51.100.'+(180+i));await client.login(user,password);
  const task=await db.task.create({data:{organizationId:org.id,title:'Own task',createdById:user.id}});actors.push({org,user,client,task});
 }
 const [a,b]=actors;
 for(const [i,role] of ['owner','admin','user'].entries()){
  const user=await db.user.create({data:{organizationId:a.org.id,name:role,email:crypto.randomUUID()+'@example.invalid',passwordHash,role,permissions:JSON.stringify(perms)}});
  const client=new Client('198.51.100.'+(190+i));await client.login(user,password);const actor={...a,user,client};
  for(const isReply of [false,true]){
   const parent=await seed(b),reply=await seed(b,{parentId:parent.id});
   await attempt(actor,isReply?reply.id:parent.id,isReply?'foreign-reply':'foreign-root',404,[parent.id,reply.id],role);
  }
  const parent=await seed(actor),own=await seed(actor,{parentId:parent.id}),foreign=await seed(b,{parentId:parent.id});
  await attempt(actor,parent.id,'foreign-child-must-not-cascade',409,[parent.id,own.id,foreign.id],role);
  const badAuthor=await seed(actor,{authorId:b.user.id});await attempt(actor,badAuthor.id,'foreign-author',404,[badAuthor.id],role);
  const badEntity=await seed(actor,{entityId:b.task.id});await attempt(actor,badEntity.id,'foreign-entity',404,[badEntity.id],role);
  const foreignParent=await seed(b),badParent=await seed(actor,{parentId:foreignParent.id});await attempt(actor,badParent.id,'foreign-parent',409,[foreignParent.id,badParent.id],role);
  for(const bad of [{entityId:b.task.id},{authorId:b.user.id},{entityType:'goal'}]) {
   const root=await seed(actor),child=await seed(actor,{parentId:root.id,...bad});
   await attempt(actor,root.id,'invalid-child-scope',409,[root.id,child.id],role);
  }
  const nested=await seed(actor),middle=await seed(actor,{parentId:nested.id}),leaf=await seed(actor,{parentId:middle.id});
  await attempt(actor,nested.id,'legitimate-nested-tree',200,[nested.id,middle.id,leaf.id],role);
  const other=await seed(a);
  await attempt(actor,other.id,'same-tenant-other-author',role==='user'?403:200,[other.id],role);
  for(const entityType of ['task','lead','goal','kanban_card']){
   let entityId=actor.task.id;
   if(entityType==='lead')entityId=(await db.lead.create({data:{organizationId:a.org.id,name:'Own lead'}})).id;
   if(entityType==='goal')entityId=(await db.goal.create({data:{organizationId:a.org.id,title:'Own goal'}})).id;
   if(entityType==='kanban_card'){
    const board=await db.kanbanBoard.create({data:{organizationId:a.org.id,title:'Own board',createdById:user.id}});
    const col=await db.kanbanColumn.create({data:{boardId:board.id,title:'Own column',position:0}});
    entityId=(await db.kanbanCard.create({data:{columnId:col.id,title:'Own card',position:0}})).id;
   }
   const root=await seed(actor,{entityType,entityId}),reply=await seed(actor,{entityType,entityId,parentId:root.id});
   await attempt(actor,reply.id,'legitimate-reply-'+entityType,200,[reply.id],role);
   const second=await seed(actor,{entityType,entityId,parentId:root.id});
   await attempt(actor,root.id,'legitimate-root-'+entityType,200,[root.id,second.id],role);
  }
 }
 const anonymous={client:new Client('198.51.100.199')},root=await seed(a);
 await attempt(anonymous,root.id,'anonymous-existing',401,[root.id]);await attempt(anonymous,crypto.randomUUID(),'anonymous-missing',401,[]);
 const denied=await db.user.create({data:{organizationId:a.org.id,name:'Denied',email:crypto.randomUUID()+'@example.invalid',passwordHash,role:'user',permissions:JSON.stringify({...perms,tasks:{view:true,edit:true,create:true,delete:false}})}});
 const client=new Client('198.51.100.198');await client.login(denied,password);const actor={...a,user:denied,client};const own=await seed(actor);
 await attempt(actor,own.id,'delete-permission-denied',403,[own.id]);
 await db.user.update({where:{id:denied.id},data:{deletedAt:new Date()}});await attempt(actor,own.id,'removed-user',401,[own.id]);
 await db.user.update({where:{id:denied.id},data:{deletedAt:null}});await db.organization.update({where:{id:a.org.id},data:{deletedAt:new Date()}});await attempt(a,root.id,'removed-organization',403,[root.id]);
 const sideEffects=await Promise.all([db.notification.count({where:{user:{organizationId:{in:orgs.map(o=>o.id)}}}}),db.activity.count({where:{userId:{in:(await db.user.findMany({where:{organizationId:{in:orgs.map(o=>o.id)}},select:{id:true}})).map(u=>u.id)}}})]);
 const passed=results.every(r=>r.passed)&&sideEffects.every(n=>n===0);console.log(JSON.stringify({kind:'COMMENTS_DELETE_HTTP_ACCEPTANCE',results,sideEffects,passed},null,2));if(!passed)process.exitCode=1;
}catch(error){console.error(JSON.stringify({name:error.name,code:error.code||null}));process.exitCode=1;}
finally{await db.comment.deleteMany({where:{organizationId:{in:orgs.map(o=>o.id)}}});for(const org of orgs)await db.organization.delete({where:{id:org.id}});await db.$disconnect();}
