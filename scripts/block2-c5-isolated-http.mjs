// Test-only copy. Never changes the candidate policy, deployment manifest, real organizations or providers.
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,writeFileSync,symlinkSync,openSync,closeSync,rmSync} from 'node:fs';
import {join,dirname,resolve,parse} from 'node:path';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {createServer} from 'node:net';
const root=process.cwd(),out=resolve(process.env.BLOCK2_C5_REPORT_DIR||join(dirname(process.cwd()),'.mds-crm-c5-evidence')),database=new URL(process.env.DATABASE_URL||'http://invalid');
if(database.hostname!=='127.0.0.1'||database.port!=='5432'||database.pathname!=='/mds_crm_dev')throw Error('Disposable PostgreSQL required');
if(process.env.BLOCK2_TEST_DATABASE_URL!==process.env.DATABASE_URL)throw Error('Explicit disposable database opt-in required');
mkdirSync(out,{recursive:true,mode:0o700});
const policyPath='src/lib/authorization/policy.ts',original=readFileSync(policyPath,'utf8'),fingerprint=createHash('sha256').update(original).digest('hex');
if(!/APPROVED_ENFORCEMENTS[^=]*=\s*\[\s*\]/.test(original))throw Error('Manifest must remain empty');
const work=mkdtempSync(join(out,'isolated-')),files=new Set([...execFileSync('git',['ls-files','-z']).toString().split('\0'),...execFileSync('git',['ls-files','--others','--exclude-standard','-z']).toString().split('\0')].filter(Boolean));
let server,fd;const env={PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'production',DATABASE_URL:process.env.DATABASE_URL,BLOCK2_TEST_DATABASE_URL:process.env.DATABASE_URL,NEXTAUTH_URL:'http://127.0.0.1:3101',BLOCK2_TEST_HTTP_ORIGIN:'http://127.0.0.1:3101',NEXTAUTH_SECRET:randomBytes(48).toString('hex'),ADMIN_JWT_SECRET:randomBytes(48).toString('hex'),TOKENS_SECRET:randomBytes(32).toString('hex'),NEXT_TELEMETRY_DISABLED:'1',CRM_ATTACHMENTS_PRIVATE_ROOT:join(work,'.cache','private-attachments')};
for (const key of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE']) if(process.env[key]) env[key]=process.env[key];
try{
 for(const f of files){if(f.startsWith('.env')&&f!=='.env.example')throw Error('Sensitive file must not be copied');const target=join(work,f);mkdirSync(dirname(target),{recursive:true});copyFileSync(f,target);}
 symlinkSync(resolve('node_modules'),join(work,'node_modules'),'dir');
 // Synthetic legacy upload exists before startup, matching persisted public-file deployments.
 const uploadFixture=join(work,'public','uploads','00000000-0000-4000-8000-000000000002');mkdirSync(uploadFixture,{recursive:true});writeFileSync(join(uploadFixture,'lot2-known-file.txt'),'SYNTHETIC_LEGACY_MARKETING_FILE');writeFileSync(join(uploadFixture,'lot3-sales-legacy.txt'),'SYNTHETIC_LEGACY_SALES_FILE');
 // Only this synthetic fixture UUID changes selector in this disposable test copy.
 const testPolicy=original.replace('export function modeForOrganization(organizationId: string | undefined): AuthorizationMode {',"export function modeForOrganization(organizationId: string | undefined): AuthorizationMode {\n  if (organizationId === '00000000-0000-4000-8000-000000000002') return 'enforce';");
 if(testPolicy===original)throw Error('Expected policy selector missing');writeFileSync(join(work,policyPath),testPolicy);
 let commonRoot=root;while(!work.startsWith(commonRoot+'/')){const parent=dirname(commonRoot);if(parent===commonRoot||commonRoot===parse(commonRoot).root)break;commonRoot=parent;}
 const config=readFileSync(join(work,'next.config.js'),'utf8').replace('const nextConfig = {',"const nextConfig = {\n  turbopack: { root: "+JSON.stringify(commonRoot)+" },");writeFileSync(join(work,'next.config.js'),config);
 const build=spawnSync(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'build'],{cwd:work,env,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});writeFileSync(join(out,'isolated-build.log'),(build.stdout||'')+(build.stderr||''));if(build.status!==0)throw Error('Isolated build failed');
 const check=createServer();await new Promise((ok,no)=>{check.once('error',no);check.listen(3101,'127.0.0.1',ok);});await new Promise(r=>check.close(r));
 fd=openSync(join(out,'isolated-server-private.log'),'w',0o600);server=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3101'],{cwd:work,env,stdio:['ignore',fd,fd]});
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(env.NEXTAUTH_URL+'/api/auth/csrf')).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,200));}if(!ready)throw Error('Server not ready');
 const results=[];for(const [script,args,filename] of [['pilot-contract-http',['--require-commercial-blocking'],'isolated-direct.json'],['c5-remaining-surfaces-http',[],'isolated-indirect.json']]){
  const r=spawnSync(process.execPath,['tests/'+script+'.mjs',...args],{cwd:work,env,encoding:'utf8',timeout:180000});writeFileSync(join(out,filename),r.stdout||'',{mode:0o600});writeFileSync(join(out,filename+'.diagnostic'),r.stderr||'',{mode:0o600});results.push({script,exit:r.status});
 }
 const unchanged=createHash('sha256').update(readFileSync(policyPath)).digest('hex')===fingerprint;if(!unchanged)throw Error('Candidate policy changed');
 writeFileSync(join(out,'isolated-summary.json'),JSON.stringify({results,candidatePolicyUnchanged:unchanged,manifestEmpty:true,onlySyntheticUuidSelected:true,realOrganizationEnforcement:false,copyRemovedOnExit:true},null,2)+'\n');console.log(JSON.stringify(results));if(results.some(result=>result.exit!==0))process.exitCode=1;
}finally{if(server){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));}if(fd!==undefined)closeSync(fd);rmSync(work,{recursive:true,force:true});}
