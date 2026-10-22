// Synthetic-only local cutover simulation. No production execution mode or configurable paths.
import assert from 'node:assert/strict';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {readFile, writeFile, mkdir, mkdtemp, copyFile, rename, readdir, access, rm, realpath} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {PrismaClient, Prisma} from '@prisma/client';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const root=await realpath(fileURLToPath(new URL('..',import.meta.url)));
const results=[], checksums=new Map();let temp,server,db,admin,schema,serverLog,exitFailure=false;
const check=(name,ok,details={})=>{results.push({name,passed:Boolean(ok),...details});assert.ok(ok,name);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
const forbiddenEnv=Object.keys(process.env).filter(key=> /^(DATABASE_URL|BLOCK2_TEST_DATABASE_URL|NEXTAUTH_|ADMIN_JWT_|TOKENS_SECRET|CHATWOOT_|EVOLUTION_|META_|INSTAGRAM_|RESEND_|SMTP_|AWS_|CRM_ATTACHMENTS_|NODE_OPTIONS|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY)/i.test(key));
let baselinePolicy,baselineFiles,work,privateRoot,quarantine,env,base,port;
function run(args,timeout=180000){return new Promise((ok,no)=>{const child=spawn(process.execPath,args,{cwd:work,env,stdio:['ignore','pipe','pipe']});let size=0;const chunks=[];const timer=setTimeout(()=>child.kill('SIGKILL'),timeout);const collect=b=>{size+=b.length;if(size<4*1024*1024)chunks.push(b);};child.stdout.on('data',collect);child.stderr.on('data',collect);child.once('error',no);child.once('exit',code=>{clearTimeout(timer);if(code===0)ok();else{serverLog=Buffer.concat(chunks).toString();no(Error('Isolated subprocess failed'));}});});}
async function stop(){if(server){const current=server;server=undefined;if(current.exitCode!==null)return;current.kill('SIGTERM');await new Promise(r=>current.once('exit',r));}}
async function start(){server=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:work,env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',()=>{});server.stderr.on('data',()=>{});for(let n=0;n<150;n++){try{if((await fetch(base+'/api/auth/csrf')).ok)return;}catch{}if(server.exitCode!==null)throw Error('Isolated HTTP server exited');await new Promise(r=>setTimeout(r,200));}throw Error('Isolated HTTP readiness failed');}
try{
 check('explicit-opt-in',process.env.BLOCK2_CUTOVER_SIMULATION==='synthetic-local-only');
 check('no-real-environment-inherited',forbiddenEnv.length===0);
 check('no-arguments-or-external-directory-input',process.argv.length===2);
 const input=new URL(process.env.BLOCK2_CUTOVER_DATABASE_URL||'http://invalid');
 check('disposable-database-only',['postgres:','postgresql:'].includes(input.protocol)&&input.hostname==='127.0.0.1'&&input.port==='5432'&&input.pathname==='/mds_crm_dev'&&input.username==='mds_dev'&&!input.search&&!input.hash);
 check('repository-cwd',await realpath(process.cwd())===root);
 baselinePolicy=await readFile(join(root,'src/lib/authorization/policy.ts'),'utf8');
 check('candidate-manifest-empty',/APPROVED_ENFORCEMENTS[^=]*=\s*\[\s*\]/.test(baselinePolicy));
 baselineFiles=execFileSync('git',['status','--porcelain=v1'],{cwd:root,encoding:'utf8'});
 temp=await mkdtemp(join(dirname(root),'.mds-cutover-synthetic-'));work=join(temp,'checkout');privateRoot=join(temp,'durable-private');quarantine=join(temp,'private-quarantine');
 await mkdir(work,{mode:0o700});await mkdir(privateRoot,{mode:0o700});await mkdir(quarantine,{mode:0o700});
 const paths=execFileSync('git',['ls-files','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
 for(const path of paths){if(path.startsWith('.env')&&path!=='.env.example')throw Error('Forbidden checkout input');const target=join(work,path);await mkdir(dirname(target),{recursive:true});await copyFile(join(root,path),target);}
 const {symlink}=await import('node:fs/promises');await symlink(join(root,'node_modules'),join(work,'node_modules'),'dir');
 // Only this disposable copy selects strict commercial mode for the synthetic pilot UUID.
 const pilotId='00000000-0000-4000-8000-000000000002';
 const changed=baselinePolicy.replace('export function modeForOrganization(organizationId: string | undefined): AuthorizationMode {',`export function modeForOrganization(organizationId: string | undefined): AuthorizationMode {\n if(organizationId === '${pilotId}') return 'enforce';`);
 check('isolated-selector-applied',changed!==baselinePolicy);await writeFile(join(work,'src/lib/authorization/policy.ts'),changed);
 const config=await readFile(join(work,'next.config.js'),'utf8');await writeFile(join(work,'next.config.js'),config.replace('const nextConfig = {','const nextConfig = {\n turbopack: { root: '+JSON.stringify(dirname(root))+' },'));
 // Deny external JS sockets/DNS/HTTP/fetch in this harness and every Node child/worker.
 const guard=join(temp,'loopback-only.cjs');
 await writeFile(guard,`const net=require('node:net'),tls=require('node:tls'),dns=require('node:dns'),http=require('node:http'),https=require('node:https');
 const allowed=h=>h==='127.0.0.1'||h==='localhost'||h==='::1'||h==='[::1]';
 const verify=h=>{if(!allowed(h))throw Error('External network denied by synthetic harness');};
 const original=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...a){const p=Array.isArray(a[0])?a[0][0]:a[0];if(typeof p==='object'){if(p.path)throw Error('Unix socket denied');verify(p.host||'localhost');}else{if(typeof p!=='number')throw Error('Non-TCP socket denied');verify(typeof a[1]==='string'?a[1]:'localhost');}return original.apply(this,a);};
 for(const k of Object.keys(dns).filter(k=>k.startsWith('resolve')||k==='reverse'))dns[k]=function(){throw Error('DNS resolution denied');};for(const k of Object.keys(dns.promises).filter(k=>k.startsWith('resolve')||k==='reverse'))dns.promises[k]=async function(){throw Error('DNS resolution denied');};require('node:dgram').createSocket=function(){throw Error('UDP denied');};
 const lookup=dns.lookup;dns.lookup=function(h,...a){verify(h);return lookup.call(this,h,...a);};
 for(const mod of[http,https])for(const key of['request','get']){const original=mod[key];mod[key]=function(u,...a){verify(typeof u==='string'||u instanceof URL?new URL(u).hostname:u.hostname||u.host||'localhost');return original.call(this,u,...a);};}
 const connect=tls.connect;tls.connect=function(...a){const o=typeof a[0]==='object'?a[0]:typeof a[1]==='object'?a[1]:{host:typeof a[1]==='string'?a[1]:'localhost'};verify(o.host||'localhost');return connect.apply(this,a);};
 const fetch=globalThis.fetch;if(fetch)globalThis.fetch=function(u,...a){verify(new URL(typeof u==='string'||u instanceof URL?u:u.url).hostname);return fetch.call(this,u,...a);};
 require('node:module').syncBuiltinESMExports();
 `);
 schema='block2_cutover_'+randomBytes(8).toString('hex');
 admin=new pg.Client({connectionString:input.toString(),connectionTimeoutMillis:5000});await admin.connect();
 // Namespace is generated, never accepted from caller. All ORM writes/DDL stay inside this schema.
 const local=new URL(input);local.searchParams.set('schema',schema);local.searchParams.set('connection_limit','5');
 const fontMock=join(temp,'synthetic-font-response.cjs');await writeFile(fontMock,"module.exports={\"https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap\":\"@font-face {font-family: 'Inter';src:local('Arial');font-weight:100 900;font-style:normal;}\"};");
 const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));port=listener.address().port;await new Promise(r=>listener.close(r));base='http://127.0.0.1:'+port;
 env={NEXT_FONT_GOOGLE_MOCKED_RESPONSES:fontMock,PATH:process.env.PATH,HOME:temp,NODE_ENV:'production',DATABASE_URL:local.toString(),NEXTAUTH_URL:base,NEXTAUTH_SECRET:randomBytes(48).toString('hex'),ADMIN_JWT_SECRET:randomBytes(48).toString('hex'),TOKENS_SECRET:randomBytes(32).toString('hex'),CRM_ATTACHMENTS_PRIVATE_ROOT:privateRoot,NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--require='+guard};
 await run([join(root,'node_modules/prisma/build/index.js'),'db','push','--skip-generate']);
 db=new PrismaClient({datasources:{db:{url:local.toString()}}});
 const identity=await db.$queryRaw`SELECT current_schema() AS schema`;
 check('isolated-postgres-namespace',identity[0].schema===schema);
 // Applying the same guard to the harness also prevents an accidental non-local test fetch.
 await import('node:module').then(({createRequire})=>createRequire(import.meta.url)(guard));
 let denied=false;try{await fetch('https://example.invalid/must-not-leave');}catch{denied=true;}check('external-fetch-denied-before-send',denied);
 let socketDenied=false;try{(await import('node:net')).connect({host:'192.0.2.1',port:443});}catch{socketDenied=true;}check('external-socket-denied-before-send',socketDenied);
 const password=randomBytes(24).toString('hex'),passwordHash=await bcrypt.hash(password,10);
 const permissions=JSON.stringify(Object.fromEntries(['tasks','leads','projects','atendimento','settings'].map(p=>[p,{view:true,create:true,edit:true,delete:true}])));
 const pilot=await db.organization.create({data:{id:pilotId,name:'Synthetic pilot',slug:'synthetic-pilot',features:'["atendimento","vendas","white_label"]',plan:'trial',trialEndsAt:new Date(Date.now()+86400000)}});
 const other=await db.organization.create({data:{name:'Synthetic MDS',slug:'synthetic-mds',features:'["atendimento","vendas","marketing"]',plan:'trial',trialEndsAt:new Date(Date.now()+86400000)}});
 const users=[];for(const role of ['owner','admin','user'])users.push(await db.user.create({data:{organizationId:pilot.id,name:role,email:role+'@example.invalid',passwordHash,role,permissions}}));
 const foreign=await db.user.create({data:{organizationId:other.id,name:'Foreign',email:'foreign@example.invalid',passwordHash,role:'owner',permissions}});
 const lead=await db.lead.create({data:{organizationId:pilot.id,name:'Synthetic sales lead'}});
 const marketing=await db.task.create({data:{organizationId:pilot.id,title:'Synthetic uncontracted Marketing',type:'task'}});
 const publicDir=join(work,'public','uploads',pilot.id);await mkdir(publicDir,{recursive:true});
 const brandingName='synthetic-brand.png',brandingUrl='/uploads/'+pilot.id+'/'+brandingName;
 const brandingBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jcV0AAAAASUVORK5CYII=','base64');await writeFile(join(publicDir,brandingName),brandingBytes);
 await db.organization.update({where:{id:pilot.id},data:{logo:brandingUrl,favicon:brandingUrl}});
 const fixtures=[];
 async function legacy(name,entityType='lead',entityId=lead.id,physical=true,override){const bytes=override||Buffer.from('SYNTHETIC_ONLY_'+name+'_'+randomUUID());const file=await db.attachment.create({data:{organizationId:pilot.id,entityType,entityId,uploadedById:users[0].id,filename:name,originalName:name,url:'/uploads/'+pilot.id+'/'+name,size:bytes.length,mimeType:'text/plain'}});if(physical)await writeFile(join(publicDir,name),bytes);checksums.set(file.id,hash(bytes));const item={...file,bytes};fixtures.push(item);return item;}
 const sales=await legacy('sales.txt'),mkt=await legacy('marketing.txt','task',marketing.id),conflict=await legacy('changed.txt'),deleted=await legacy('deleted.txt'),failed=await legacy('failed.txt'),collision=await legacy('collision.txt');
 const ambiguous=await legacy(brandingName,'lead',lead.id,true,brandingBytes);await db.organization.update({where:{id:pilot.id},data:{logo:ambiguous.url,favicon:ambiguous.url}});
 const missing=await legacy('missing.txt','lead',lead.id,false);await writeFile(join(publicDir,'orphan.txt'),'SYNTHETIC_ORPHAN_PRESERVED');
 // Selective-cleanup fixtures are explicit IDs, never a production classification heuristic.
 const cleanLead=await db.lead.create({data:{organizationId:pilot.id,name:'Synthetic classified disposable lead'}});
 const retainedLead=await db.lead.create({data:{organizationId:pilot.id,name:'Synthetic unclassified retained lead',chatwootContactId:7001}});
 const cleanTask=await db.task.create({data:{organizationId:pilot.id,title:'Synthetic classified disposable task',type:'follow_up',leadId:cleanLead.id}});
 await db.task.create({data:{organizationId:pilot.id,title:'Synthetic retained task',leadId:retainedLead.id}});
 const cleanChild=await db.subtask.create({data:{taskId:cleanTask.id,title:'Synthetic disposable subtask'}});
 const cleanComment=await db.comment.create({data:{organizationId:pilot.id,entityType:'task',entityId:cleanTask.id,authorId:users[0].id,content:'Synthetic classified comment'}});
 const cleanReply=await db.comment.create({data:{organizationId:pilot.id,entityType:'task',entityId:cleanTask.id,parentId:cleanComment.id,authorId:users[0].id,content:'Synthetic classified reply'}});
 const cleanFile=await legacy('discard-classified.txt','comment',cleanComment.id);
 const cleanActivity=await db.activity.create({data:{entityType:'lead',entityId:cleanLead.id,leadId:cleanLead.id,action:'synthetic',userId:users[0].id}});
 const cleanNotification=await db.notification.create({data:{userId:users[0].id,type:'synthetic',title:'Synthetic disposable notification',entityType:'task',entityId:cleanTask.id}});
 // Synthetic protected channel/credential/remote bindings, receipts, OAuth and configuration.
 const connection=await db.connectedAccount.create({data:{organizationId:pilot.id,provider:'chatwoot',connectedById:users[0].id,accessTokenEnc:'SYNTHETIC_NOT_A_REAL_TOKEN',data:'{"chatwootInboxId":7001}'}});
 await db.whatsappInstance.create({data:{organizationId:pilot.id,instanceName:'synthetic-protected-instance',chatwootInboxId:7001,metadata:'{"provider":"evolution","synthetic":true}'}});
 await db.chatwootConversation.create({data:{organizationId:pilot.id,chatwootId:7001,chatwootAccountId:7001,chatwootInboxId:7001,chatwootContactId:7001,status:'open',leadId:retainedLead.id}});
 await db.instagramOAuthState.create({data:{nonceHash:randomBytes(32).toString('hex'),organizationId:pilot.id,userId:users[0].id,expiresAt:new Date(Date.now()+600000)}});
 await db.instagramWebhookReceipt.create({data:{organizationId:pilot.id,eventHash:randomBytes(32).toString('hex'),chatwootAccountId:7001,chatwootInboxId:7001,status:'pending'}});
 await db.widgetInboxOperation.create({data:{organizationId:pilot.id,connectedAccountId:connection.id,accountId:7001,baseUrl:'https://example.invalid',status:'remote_unknown'}});

 async function inventory(){const rows=await db.attachment.findMany({where:{organizationId:pilot.id}});const org=await db.organization.findUnique({where:{id:pilot.id}});return Promise.all(rows.map(async row=>({id:row.id,classification:[org.logo,org.favicon].includes(row.url)?'ambiguous-public-branding':!await exists(join(publicDir,row.filename))?'missing':'internal-private-required'})));}
 const classified=await inventory();const referencedNames=new Set(fixtures.map(f=>f.filename));const orphans=(await readdir(publicDir)).filter(name=>!referencedNames.has(name));check('filesystem-orphan-classification',orphans.length===1&&orphans[0]==='orphan.txt');check('inventory-classifies-branding-and-missing',classified.find(x=>x.id===ambiguous.id).classification==='ambiguous-public-branding'&&classified.find(x=>x.id===missing.id).classification==='missing',{internal:classified.filter(x=>x.classification==='internal-private-required').length,ambiguous:1,missing:1,orphan:orphans.length});
 // Load the real adapter; no production module is changed or mocked.
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);require('tsx/cjs');const storage=require(join(root,'src/lib/attachments/storage.ts'));
 const previousPrivate=process.env.CRM_ATTACHMENTS_PRIVATE_ROOT;process.env.CRM_ATTACHMENTS_PRIVATE_ROOT=privateRoot;
 const staged=new Map(),committed=new Set();
 async function stage(item){const current=classified.find(x=>x.id===item.id);assert.equal(current.classification,'internal-private-required');const bytes=await readFile(join(publicDir,item.filename));assert.equal(hash(bytes),checksums.get(item.id));const target={id:item.id,organizationId:item.organizationId,filename:item.id+'.bin',url:storage.attachmentDownloadUrl(item.id)};await storage.writePrivateAttachment(target,bytes);assert.equal(hash(await storage.readAttachment(target)),checksums.get(item.id));staged.set(item.id,target);return target;}
 async function commit(item,{fail=false}={}){const target=staged.get(item.id);assert.ok(target);await db.$transaction(async tx=>{const locked=await tx.$queryRaw(Prisma.sql`SELECT id FROM attachments WHERE id=${item.id} AND organization_id=${pilot.id} FOR UPDATE`);assert.equal(locked.length,1);const update=await tx.attachment.updateMany({where:{id:item.id,organizationId:pilot.id,filename:item.filename,url:item.url,size:item.size},data:{filename:target.filename,url:target.url}});assert.equal(update.count,1);if(fail)throw Error('Synthetic injected transaction abort');});committed.add(item.id);}
 // Build/start with public fixtures BEFORE startup to reproduce the real static exposure.
 await run([join(root,'node_modules/next/dist/bin/next'),'build']);await start();
 const request=async(path,{jar,method='GET',body,headers={}}={})=>{assert.ok(path.startsWith('/')&&!path.startsWith('//'));const r=await fetch(base+path,{redirect:'manual',method,body,headers:{...headers,...(jar?{cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')}:{})}});if(jar)for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],at=pair.indexOf('=');jar.set(pair.slice(0,at),pair.slice(at+1));}return{status:r.status,bytes:Buffer.from(await r.arrayBuffer()),headers:r.headers};};
 const jars=[];for(const [i,user]of [...users,foreign].entries()){const jar=new Map();const h={'x-forwarded-for':'10.77.0.'+(i+1)};const csrf=JSON.parse((await request('/api/auth/csrf',{jar,headers:h})).bytes).csrfToken;await request('/api/auth/callback/credentials',{jar,method:'POST',headers:{...h,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:user.email,password,csrfToken:csrf,callbackUrl:base+'/dashboard',json:'true'})});assert.equal(JSON.parse((await request('/api/auth/session',{jar})).bytes).user?.id,user.id);jars.push(jar);}
 const before=await request(sales.url);check('pre-cutover-static-exposure-reproduced',before.status===200&&hash(before.bytes)===checksums.get(sales.id),{status:before.status});
 await stage(sales);await stage(mkt);await stage(conflict);await stage(deleted);await stage(failed);
 check('copy-hash-integrity-before-pointer-update',hash(await readFile(join(privateRoot,pilot.id,sales.id+'.bin')))===checksums.get(sales.id));
 // Existing different destination is never overwritten, and its source/metadata stay intact.
 await writeFile(join(privateRoot,pilot.id,collision.id+'.bin'),'SYNTHETIC_COLLISION',{mode:0o600});await assert.rejects(stage(collision));check('destination-collision-preserves-source-and-pointer',(await db.attachment.findUnique({where:{id:collision.id}})).url===collision.url&&hash(await readFile(join(publicDir,collision.filename)))===checksums.get(collision.id)&&(await readFile(join(privateRoot,pilot.id,collision.id+'.bin'),'utf8'))==='SYNTHETIC_COLLISION');
 await assert.rejects(commit(failed,{fail:true}));check('transaction-abort-restores-complete-pointer',(await db.attachment.findUnique({where:{id:failed.id}})).url===failed.url&&(await db.attachment.findUnique({where:{id:failed.id}})).filename===failed.filename);
 // Deterministic concurrent operations happen after copy but before migration CAS under lock.
 await db.attachment.update({where:{id:conflict.id},data:{url:conflict.url+'?synthetic-change'}});await assert.rejects(commit(conflict));check('concurrent-pointer-change-not-overwritten',(await db.attachment.findUnique({where:{id:conflict.id}})).url===conflict.url+'?synthetic-change');
 await db.attachment.delete({where:{id:deleted.id}});await assert.rejects(commit(deleted));check('concurrent-delete-not-resurrected',await db.attachment.count({where:{id:deleted.id}})===0&&await exists(join(privateRoot,pilot.id,deleted.id+'.bin')));
 // Repair only the synthetic collision/change fixtures, then reconcile before cutover.
 await db.attachment.update({where:{id:conflict.id},data:{url:conflict.url}});await rm(join(privateRoot,pilot.id,collision.id+'.bin'));await stage(collision);
 const form=new FormData();form.set('entityType','lead');form.set('entityId',lead.id);form.set('file',new Blob(['SYNTHETIC_CONCURRENT_UPLOAD']),'concurrent.txt');
 const [upload]=await Promise.all([request('/api/attachments',{jar:jars[0],method:'POST',body:form}),commit(sales),commit(mkt),commit(failed),commit(conflict),commit(collision)]);
 check('concurrent-upload-and-migration',upload.status===201,{status:upload.status});const fresh=JSON.parse(upload.bytes);checksums.set(fresh.id,hash(Buffer.from('SYNTHETIC_CONCURRENT_UPLOAD')));
 check('concurrent-upload-never-public',!await exists(join(publicDir,fresh.filename))&&(await request(fresh.url,{jar:jars[0]})).status===200);
 const committedRow=await db.attachment.findUnique({where:{id:sales.id}});check('pointer-update-preserves-identity-and-metadata',committedRow.entityId===sales.entityId&&committedRow.uploadedById===sales.uploadedById&&committedRow.originalName===sales.originalName&&committedRow.size===sales.size&&committedRow.filename===sales.id+'.bin'&&committedRow.url==='/api/attachments/'+sales.id);
 await assert.rejects(commit(sales));check('repeat-old-cas-cannot-clobber-committed-pointer',(await db.attachment.findUnique({where:{id:sales.id}})).url===committedRow.url);
 check('ambiguous-and-missing-pointers-untouched',(await db.attachment.findUnique({where:{id:ambiguous.id}})).url===ambiguous.url&&(await db.attachment.findUnique({where:{id:missing.id}})).url===missing.url);
 // Stop the static server BEFORE changing its public inventory: live removal produced500 in the original probe.
 await stop();
 // Selective cutover: quarantine synthetic origins; preserve branding, unknown orphan and all bytes.
 for(const item of fixtures.filter(x=>committed.has(x.id)||x.id===deleted.id))await rename(join(publicDir,item.filename),join(quarantine,item.filename));
 const stablePointers=await db.attachment.findMany({where:{organizationId:pilot.id},orderBy:{id:'asc'}});
 async function validate(phase){
  for(const item of fixtures.filter(x=>committed.has(x.id))){const old=await request(item.url);check(phase+'-old-url-denied-'+item.filename,[403,404].includes(old.status)&&!old.bytes.includes(item.bytes)&&!old.bytes.includes(Buffer.from('SYNTHETIC_ONLY_')),{status:old.status});const r=await request('/api/attachments/'+item.id,{jar:jars[0]});check(phase+'-private-'+item.filename,r.status===(item.id===mkt.id?403:200)&&(item.id===mkt.id?!r.bytes.includes(item.bytes):hash(r.bytes)===checksums.get(item.id)),{status:r.status});}
  for(const [i,role]of ['owner','admin','user'].entries()){const good=await request('/api/attachments/'+sales.id,{jar:jars[i]});check(phase+'-'+role+'-sales',good.status===200&&hash(good.bytes)===checksums.get(sales.id));const denied=await request('/api/attachments/'+mkt.id,{jar:jars[i]});check(phase+'-'+role+'-marketing-denied',denied.status===403&&!denied.bytes.includes(mkt.bytes));}
  for(const [name,jar,expected]of [['anonymous',undefined,401],['foreign',jars[3],404]]){const r=await request('/api/attachments/'+sales.id,{jar});check(phase+'-'+name+'-denied',r.status===expected&&!r.bytes.includes(sales.bytes),{status:r.status});}
  const branding=await request(brandingUrl);check(phase+'-public-branding-preserved',branding.status===200&&hash(branding.bytes)===checksums.get(ambiguous.id));
  const f=await request(fresh.url,{jar:jars[0]});check(phase+'-concurrent-upload-integrity',f.status===200&&hash(f.bytes)===checksums.get(fresh.id));
  const anonymousHead=await request('/api/attachments/'+sales.id,{method:'HEAD',headers:{range:'bytes=0-1','if-none-match':'synthetic'}});check(phase+'-anonymous-head-denied',anonymousHead.status===401&&anonymousHead.bytes.length===0);
  const conditional=await request('/api/attachments/'+sales.id,{jar:jars[0],headers:{range:'bytes=0-1','if-none-match':'synthetic'}});check(phase+'-cache-range-authorized',conditional.status===200&&hash(conditional.bytes)===checksums.get(sales.id)&&/no-store/.test(conditional.headers.get('cache-control'))&&conditional.headers.get('x-content-type-options')==='nosniff'&&!conditional.headers.get('location'));
  for(const item of fixtures.filter(x=>committed.has(x.id)||x.id===deleted.id))check(phase+'-quarantine-integrity-'+item.filename,hash(await readFile(join(quarantine,item.filename)))===checksums.get(item.id));
  check(phase+'-pointers-persist',JSON.stringify(await db.attachment.findMany({where:{organizationId:pilot.id},orderBy:{id:'asc'}}))===JSON.stringify(stablePointers));
 }
 await start();await validate('cutover');
 const saved=users[0].permissions;await db.user.update({where:{id:users[0].id},data:{permissions:'{"leads":{"view":false}}'}});const revoked=await request('/api/attachments/'+sales.id,{jar:jars[0]});check('revocation-after-migration',revoked.status===403&&!revoked.bytes.includes(sales.bytes));await db.user.update({where:{id:users[0].id},data:{permissions:saved}});
 await stop();await start();await validate('restart');
 // Rebuild the isolated Next app without resetting external private storage/schema or restoring public origins.
 await stop();await rm(join(work,'.next'),{recursive:true,force:true});await run([join(root,'node_modules/next/dist/bin/next'),'build']);await start();await validate('rebuild');
 // Roll back a failed pointer attempt to the last SAFE private pointer, never to the public snapshot.
 await assert.rejects(db.$transaction(async tx=>{await tx.attachment.update({where:{id:sales.id},data:{url:'/synthetic-invalid-attempt'}});throw Error('Synthetic rollback');}));
 // Simulate a failed private copy and restore from the preserved PRIVATE quarantine, without public exposure.
 const privateSales=join(privateRoot,pilot.id,sales.id+'.bin'),failedBackup=join(temp,'failed-private-copy.bin');
 await rename(privateSales,failedBackup);
 const unavailable=await request('/api/attachments/'+sales.id,{jar:jars[0]});check('rollback-failed-copy-returns-no-bytes',unavailable.status===404&&!unavailable.bytes.includes(sales.bytes),{status:unavailable.status});
 const restoreBytes=await readFile(join(quarantine,sales.filename));assert.equal(hash(restoreBytes),checksums.get(sales.id));
 await storage.writePrivateAttachment(staged.get(sales.id),restoreBytes);
 check('rollback-restores-from-private-quarantine',hash(await readFile(privateSales))===checksums.get(sales.id)&&hash(await readFile(failedBackup))===checksums.get(sales.id)&&!await exists(join(publicDir,sales.filename)));
 await stop();await start();await validate('rollback');
 for(const item of fixtures.filter(x=>committed.has(x.id)))check('private-file-not-reintroduced-'+item.filename,!await exists(join(publicDir,item.filename))&&hash(await storage.readAttachment(staged.get(item.id)))===checksums.get(item.id));
 check('unknown-orphan-preserved',(await readFile(join(publicDir,'orphan.txt'),'utf8'))==='SYNTHETIC_ORPHAN_PRESERVED');
 check('inventory-no-implicit-global-certification',await exists(join(publicDir,brandingName))&&!await exists(join(publicDir,missing.filename)));
 // Selective cleanup never deletes identities/orgs/providers or relies on cascade.
 const allowed={lead:[cleanLead.id],task:[cleanTask.id],subtask:[cleanChild.id],comment:[cleanComment.id,cleanReply.id],attachment:[cleanFile.id],activity:[cleanActivity.id],notification:[cleanNotification.id]};
 const allModels=Prisma.dmmf.datamodel.models.map(model=>model.name[0].toLowerCase()+model.name.slice(1));
 const snapshot=async client=>Object.fromEntries(await Promise.all(allModels.map(async model=>[model,await client[model].findMany()])));
 const canonical=rows=>JSON.stringify(Object.fromEntries(Object.entries(rows).map(([model,items])=>[model,items.map(item=>JSON.stringify(item)).sort()])));
 const backup=await snapshot(db),backupBytes=await readFile(join(publicDir,cleanFile.filename));
 check('cleanup-backup-before-delete',hash(backupBytes)===checksums.get(cleanFile.id));
 async function preflight(client,candidate){
  assert.ok(allowed.lead.includes(candidate),'Only explicitly classified fixture IDs may be removed');
  assert.equal(await client.chatwootConversation.count({where:{leadId:candidate}}),0);
  assert.equal(await client.agendaEvent.count({where:{leadId:candidate}}),0);
  assert.equal(await client.task.count({where:{leadId:candidate,id:{notIn:allowed.task}}}),0);
  assert.equal(await client.activity.count({where:{leadId:candidate,id:{notIn:allowed.activity}}}),0);
  assert.equal(await client.comment.count({where:{entityType:'lead',entityId:candidate,id:{notIn:allowed.comment}}}),0);
 }
 await assert.rejects(preflight(db,retainedLead.id));check('cleanup-unclassified-provider-linked-record-denied',canonical(await snapshot(db))===canonical(backup));
 allowed.lead.push(retainedLead.id);await assert.rejects(preflight(db,retainedLead.id));allowed.lead.pop();check('cleanup-provider-link-overrides-test-label',canonical(await snapshot(db))===canonical(backup));
 // A newly discovered protected dependent blocks an otherwise classified parent.
 const blocker=await db.agendaEvent.create({data:{organizationId:pilot.id,title:'Synthetic protected dependency',date:new Date(),leadId:cleanLead.id}});
 await assert.rejects(preflight(db,cleanLead.id));check('cleanup-protected-dependent-blocks-parent',await db.lead.count({where:{id:cleanLead.id}})===1);
 // Remove only the temporary test blocker, not an unknown operational dependency.
 await db.agendaEvent.delete({where:{id:blocker.id}});
 const cleanup=async ({fail=false}={})=>db.$transaction(async tx=>{
  await tx.$queryRaw(Prisma.sql`SELECT id FROM leads WHERE id=${cleanLead.id} AND organization_id=${pilot.id} FOR UPDATE`);
  await preflight(tx,cleanLead.id);
  for(const [model,ids]of [['attachment',allowed.attachment],['comment',[cleanReply.id]],['comment',[cleanComment.id]],['notification',allowed.notification],['activity',allowed.activity],['subtask',allowed.subtask],['task',allowed.task],['lead',allowed.lead]]){
   const removed=await tx[model].deleteMany({where:{id:{in:ids}}});assert.equal(removed.count,ids.length);
   if(fail&&model==='task')throw Error('Synthetic cleanup transaction abort');
  }
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 await assert.rejects(cleanup({fail:true}));check('cleanup-mid-transaction-failure-restores-all-tables',canonical(await snapshot(db))===canonical(backup));
 await stop();await rename(join(publicDir,cleanFile.filename),join(quarantine,cleanFile.filename));
 await cleanup();
 const expected=Object.fromEntries(Object.entries(backup).map(([model,items])=>[model,items.filter(item=>!allowed[model]?.includes(item.id))]));
 check('cleanup-only-approved-rows-removed',canonical(await snapshot(db))===canonical(expected),{removed:Object.values(allowed).reduce((sum,ids)=>sum+ids.length,0),protectedModels:allModels.length-Object.keys(allowed).length});
 check('cleanup-file-quarantined-not-destroyed',hash(await readFile(join(quarantine,cleanFile.filename)))===checksums.get(cleanFile.id));
 await start();
 const gone=await request(cleanFile.url);check('cleanup-old-public-url-denied',[403,404].includes(gone.status)&&!gone.bytes.includes(backupBytes),{status:gone.status});
 check('cleanup-deleted-attachment-api-denied',(await request('/api/attachments/'+cleanFile.id,{jar:jars[0]})).status===404);
 check('cleanup-retained-private-download-integrity',hash((await request('/api/attachments/'+sales.id,{jar:jars[0]})).bytes)===checksums.get(sales.id));
 check('cleanup-branding-preserved',(await request(brandingUrl)).status===200);
 await stop();await start();
 check('cleanup-preservation-after-restart',canonical(await snapshot(db))===canonical(expected));
 check('cleanup-no-public-reappearance-after-restart',(await request(cleanFile.url)).status===404);
 // Recover deleted synthetic rows from the pre-cleanup snapshot, parent-first, into private storage.
 const restoredFile={...cleanFile,filename:cleanFile.id+'.bin',url:storage.attachmentDownloadUrl(cleanFile.id)};
 await storage.writePrivateAttachment(restoredFile,backupBytes);
 await db.$transaction(async tx=>{for(const model of ['lead','task','subtask','comment','attachment','activity','notification']){
  const rows=backup[model].filter(item=>allowed[model]?.includes(item.id));
  for(const row of rows)await tx[model].create({data:model==='attachment'?{...row,filename:restoredFile.filename,url:restoredFile.url}:row});
 }});
 const restoredExpected=Object.fromEntries(Object.entries(backup).map(([model,items])=>[model,items.map(item=>model==='attachment'&&item.id===cleanFile.id?{...item,filename:restoredFile.filename,url:restoredFile.url}:item)]));
 check('cleanup-recovery-preserves-all-records-except-safe-file-pointer',canonical(await snapshot(db))===canonical(restoredExpected));
 await stop();await start();
 const recovered=await request(restoredFile.url,{jar:jars[0]});check('cleanup-recovered-private-download',recovered.status===200&&hash(recovered.bytes)===checksums.get(cleanFile.id),{status:recovered.status});
 check('cleanup-recovery-never-restores-public-url',(await request(cleanFile.url)).status===404);
 check('cleanup-protected-config-credentials-oauth-receipts-unchanged',canonical(await snapshot(db))===canonical(restoredExpected));
 if(previousPrivate===undefined)delete process.env.CRM_ATTACHMENTS_PRIVATE_ROOT;else process.env.CRM_ATTACHMENTS_PRIVATE_ROOT=previousPrivate;
 check('candidate-policy-byte-identical',(await readFile(join(root,'src/lib/authorization/policy.ts'),'utf8'))===baselinePolicy);
 check('candidate-working-tree-unchanged',execFileSync('git',['status','--porcelain=v1'],{cwd:root,encoding:'utf8'})===baselineFiles);
}catch(error){exitFailure=true;results.push({name:'execution-error',passed:false,error:error instanceof assert.AssertionError?'assertion-failed':error?.message==='Isolated subprocess failed'?'subprocess-failed':'simulation-failed'});if(serverLog)console.error(JSON.stringify({diagnostic:serverLog.split('\n').filter(line=>/Error:|error |EACCES|Failed|Cannot|ENOENT|denied|Unknown|Unexpected|ERR_/.test(line)).slice(-12).map(line=>line.replace(/(?:postgres(?:ql)?|https?):\/\/[^\s]+/g,'[redacted-url]').slice(0,400))}));}
finally{
 await stop();if(db)await db.$disconnect();
 if(admin){if(schema&&/^block2_cutover_[a-f0-9]{16}$/.test(schema))await admin.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');await admin.end();}
 if(temp)await rm(temp,{recursive:true,force:true});
 console.log(JSON.stringify({kind:'SYNTHETIC_LEGACY_CUTOVER',results,passed:!exitFailure&&results.every(x=>x.passed),hashAlgorithm:'sha256',syntheticBytesOnly:true,hashesOrCredentialsPrinted:false,productionAccess:false,realInfrastructureVerified:false,realOrganizationEnforcement:false,globalMode:'observe_only',approvedEnforcements:[],limitations:['Temporary filesystem plus actual Next restart/rebuild; not a Docker/Coolify deployment','Branding overlap/missing/orphan deliberately preserved and require manual classification','CAS/row-lock migration is test-harness logic, not a production migration tool','Rollback preserves the current safe private-capable application; no downgrade to public-only versions']},null,2));
}
if(exitFailure)process.exitCode=1;
