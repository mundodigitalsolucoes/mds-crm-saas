// Real Chromium + NextAuth + disposable PostgreSQL. No provider or production access.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {PrismaClient}=require('@prisma/client'),bcrypt=require('bcryptjs');
const {chromium}=require(process.env.BLOCK2_PLAYWRIGHT_MODULE || 'playwright');
const base='http://127.0.0.1:3100',out=process.env.BLOCK2_BRANDING_REPORT_DIR || '/tmp/block2-branding-report';
assert.equal(process.env.BLOCK2_WL_DISPOSABLE,'true','Explicit synthetic browser opt-in required');
assert.ok(process.cwd().startsWith('/tmp/mds-wl-v1-'),'Only an isolated temporary source copy is permitted');
const url=new URL(process.env.DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'5432');assert.equal(url.pathname,'/mds_crm_dev');assert.equal(process.env.BLOCK2_TEST_DATABASE_URL,process.env.DATABASE_URL);
const db=new PrismaClient(),fixtures=[],plans=[],checks=[],screens=[],errors=[];
let browser,admin,completed=false,loginIndex=120;
const password=randomBytes(32).toString('hex');
const check=(name,condition)=>{checks.push({name,passed:!!condition});assert.ok(condition,name);};
async function login(page,user){
 await page.context().setExtraHTTPHeaders({'x-forwarded-for':'198.51.100.'+(loginIndex++)});
 await page.goto(base+'/auth/login');await page.locator('input[type=email]').fill(user.email);await page.locator('input[type=password]').fill(password);
 await Promise.all([page.waitForURL('**/dashboard'),page.getByRole('button',{name:'Entrar',exact:true}).click()]);
 await page.waitForLoadState('domcontentloaded'); await page.evaluate(() => document.fonts.ready);
}
async function snap(page,name){await page.screenshot({path:out+'/captures/'+name+'.png',fullPage:true,animations:'disabled'});screens.push(name+'.png');}
try{
 await mkdir(out+'/captures',{recursive:true});
 const hash=await bcrypt.hash(password,10),assets=process.cwd()+'/public/images';
 for(const [key,name,primary,secondary,wl] of [['a','Ótica São Paulo — FICTÍCIA','#ff8800','#202020',true],['b','Cliente B — FICTÍCIO','#e0ffff','#005500',true],['c','Sem adicional — FICTÍCIO','#ff00ff','#000000',false]]){
  const logo=`/images/wl-fixture-${key}.svg`,favicon=`/images/wl-icon-${key}.svg`;
  await writeFile(assets+`/wl-fixture-${key}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120"><rect width="600" height="120" fill="${secondary}"/><text x="20" y="80" fill="white" font-size="55">FIXTURE ${key.toUpperCase()}</text></svg>`);
  await writeFile(assets+`/wl-icon-${key}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${secondary}"/><text x="16" y="46" fill="white" font-size="40">${key.toUpperCase()}</text></svg>`);
  const org=await db.organization.create({data:{name,slug:'wl-'+key+'-'+randomUUID(),plan:'trial',trialEndsAt:new Date(Date.now()+86400000),features:JSON.stringify(['atendimento','vendas',...(wl?['white_label']:[])]),logo,favicon,primaryColor:primary,secondaryColor:secondary}});
  const user=await db.user.create({data:{organizationId:org.id,name:'Visual Fixture',email:key+'-'+randomUUID()+'@example.invalid',role:'owner',passwordHash:hash}});
  fixtures.push({key,name,primary,secondary,wl,org,user,logo,favicon});
 }
 admin=await db.superAdmin.create({data:{name:'Visual admin fixture',email:'admin-'+randomUUID()+'@example.invalid',passwordHash:hash}});
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking']});
 for(const device of ['desktop','mobile']){
  const context=await browser.newContext({viewport:device==='desktop'?{width:1440,height:1000}:{width:390,height:844},isMobile:device==='mobile',hasTouch:device==='mobile'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/auth/login');check(device+' anonymous default',!(await page.content()).includes('FIXTURE A'));await snap(page,device+'-login');
  for(const f of fixtures){
   await context.clearCookies();await login(page,f.user);
   check(device+f.key+' title',(await page.title()).includes(f.wl?f.name:'MDS CRM'));
   const faviconResponse=await context.request.get(base+(f.wl?f.favicon:'/images/favicon.png'));check(device+f.key+' favicon bytes',faviconResponse.status()===200&&(await faviconResponse.body()).length>0);
   const scope=page.locator('[data-crm-brand]');check(device+f.key+' scope',await scope.getAttribute('data-crm-brand')===f.org.id);
   const primary=await scope.evaluate(e=>getComputedStyle(e).getPropertyValue('--brand-primary').trim());check(device+f.key+' primary',primary===(f.wl?f.primary:'#2f3453'));
   for(const other of fixtures.filter(x=>x!==f))check(device+f.key+' no foreign '+other.key,!(await page.content()).includes(other.logo));
   const icon=await page.locator('link[rel=icon]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));check(device+f.key+' favicon',icon.includes(f.wl?f.favicon:'/images/favicon.png'));
   if(device==='mobile')await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
   const img=page.locator('aside img');check(device+f.key+' logo loaded',await img.evaluate(e=>e.complete&&e.naturalWidth>0));
   check(device+f.key+' horizontal width',(await img.boundingBox()).width>=150);
   await snap(page,device+'-'+f.key+'-navigation');
   check(device+f.key+' marketing absent',await page.locator('aside').getByText('Marketing',{exact:true}).count()===0);
   if(device==='desktop'){
    await page.getByRole('button',{name:'Recolher menu',exact:true}).click();check(f.key+' compact',await img.getAttribute('src')===(f.wl?f.favicon:'/images/favicon.png'));await snap(page,device+'-'+f.key+'-compact');await page.getByRole('button',{name:'Expandir menu',exact:true}).click();
   }else await page.getByRole('button',{name:'Fechar menu',exact:true}).click();
   for(const path of ['/dashboard','/leads','/kanban','/agenda','/settings/branding']){
    const response=await page.goto(base+path);await page.waitForLoadState('domcontentloaded'); await page.evaluate(() => document.fonts.ready);check(device+f.key+path+' http',response.status()===200);
    check(device+f.key+path+' overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await snap(page,device+'-'+f.key+'-'+path.split('/').at(-1));
   }
   const missing=await page.goto(base+'/wl-page-does-not-exist');check(device+f.key+' scoped 404',missing.status()===404);
   check(device+f.key+' 404 private cache',!/public/.test(missing.headers()['cache-control']||''));
   await page.waitForFunction(name=>document.title.includes(name),f.wl?f.name:'MDS CRM');
   check(device+f.key+' 404 identity',(await page.getByText(f.wl?f.name:'MDS CRM',{exact:true}).count())>0);await snap(page,device+'-'+f.key+'-404');
   if(f.wl){
    const denied=await context.request.put(base+'/api/admin/organizations/'+f.org.id,{data:{branding:{name:'Intruder'}}});check(device+f.key+' admin denied',[401,403,307].includes(denied.status())||denied.url().includes('/admin/login'));
    const deniedOwn=await context.request.patch(base+'/api/organizations',{data:{name:'Intruder'}});check(device+f.key+' self edit denied',deniedOwn.status()===403);
   }
  }
  // Same browser/session storage: switch back to A, then logout to the neutral login.
  await context.clearCookies();await login(page,fixtures[0].user);check(device+' switch back A',(await page.title()).includes(fixtures[0].name));
  if(device==='mobile')await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
  await Promise.all([page.waitForURL('**/auth/login'),page.getByRole('button',{name:'Sair',exact:true}).click()]);
  const session=await page.evaluate(()=>fetch('/api/auth/session').then(r=>r.json()));check(device+' logout session removed',!session.user);
  check(device+' logout no retained identity',!(await page.content()).includes(fixtures[0].logo));
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const page=await context.newPage();
 const loginAdmin=await context.request.post(base+'/api/admin/auth',{data:{email:admin.email,password}});check('Super Admin login',loginAdmin.status()===200);
 await page.goto(base+'/admin/organizations');await page.waitForLoadState('domcontentloaded'); await page.evaluate(() => document.fonts.ready);
 // Locate the existing editor in the selected organization card.
 const target=fixtures[0];
 await page.getByPlaceholder('Buscar por nome ou slug...').fill(target.org.slug);
 await page.getByRole('row').filter({hasText:fixtures[0].name}).getByRole('button',{name:'Editar',exact:true}).click();
 await page.getByRole('heading',{name:'Identidade visual — controle MDS'}).waitFor();
 await page.getByLabel('Nome de exibição',{exact:true}).fill('Identidade pela UI — FICTÍCIA');
 const saved=page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname==='/api/admin/organizations/'+fixtures[0].org.id);
 await page.getByRole('button',{name:'Salvar identidade visual',exact:true}).click();check('MDS UI save',(await saved).status()===200);
 check('MDS UI persistence',(await db.organization.findUnique({where:{id:fixtures[0].org.id}})).name==='Identidade pela UI — FICTÍCIA');
 await page.getByRole('button',{name:'Restaurar padrão MDS',exact:true}).click();
 const reset=page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname==='/api/admin/organizations/'+fixtures[0].org.id);
 await page.getByRole('button',{name:'Salvar identidade visual',exact:true}).click();check('MDS UI reset',(await reset).status()===200);
 check('MDS reset persistence',(await db.organization.findUnique({where:{id:fixtures[0].org.id}})).logo==='/images/logo-fundo-escuro.png');
 await snap(page,'admin-organizations');
 // Full onboarding through existing Super Admin APIs; no per-customer code/deploy.
 const adminCall=(path,method,data)=>page.evaluate(async ({path,method,data})=>{
   const response=await fetch(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(data)});
   return {status:response.status,body:await response.json()};
 },{path,method,data});
 const plan=await adminCall('/api/admin/plans','POST',{name:'wl-'+randomUUID(),displayName:'Synthetic modular White-Label',features:'["atendimento","vendas","white_label"]'});
 check('onboarding plan created',plan.status===201);plans.push(plan.body.id);
 const created=await adminCall('/api/admin/organizations','POST',{name:'New customer — FICTITIOUS',slug:'wl-new-'+randomUUID(),plan:plan.body.name,syncFromPlan:true});
 check('onboarding organization created',created.status===201);const fresh={org:created.body};fixtures.push(fresh);
 check('onboarding contract inherited',created.body.features==='["atendimento","vendas","white_label"]');
 const branded=await adminCall('/api/admin/organizations/'+fresh.org.id,'PUT',{branding:{name:'Universal customer — FICTITIOUS',logo:target.logo,favicon:target.favicon,primaryColor:'#ff8800',secondaryColor:'#202020'}});
 check('onboarding branding saved',branded.status===200);
 const owner=await adminCall('/api/admin/users','POST',{organizationId:fresh.org.id,name:'New fictional owner',email:randomUUID()+'@example.invalid',password,role:'owner'});
 check('onboarding owner created',owner.status===201);fresh.user=owner.body;
 const customer=await browser.newContext({viewport:{width:1440,height:1000}});await customer.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const customerPage=await customer.newPage();await login(customerPage,fresh.user);
 check('onboarding branded login',(await customerPage.title()).includes('Universal customer — FICTITIOUS'));
 check('onboarding no marketing menu',await customerPage.locator('aside').getByText('Marketing',{exact:true}).count()===0);
 await snap(customerPage,'onboarding-new-customer');await customer.close();
 // Persistence through real admin endpoint, including fallback for missing assets.
 const update=await page.evaluate(async ({id,branding}) => (await fetch('/api/admin/organizations/'+id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({branding})})).status,{id:target.org.id,branding:{name:target.name,logo:'/images/wl-missing.svg',favicon:'/images/wl-missing.ico',primaryColor:'#abcdef',secondaryColor:'#123456'}});check('MDS update persisted HTTP '+update,update===200);
 check('provider fields intact',(await db.organization.findUnique({where:{id:target.org.id}})).chatwootAccountId===null);
 await context.clearCookies();await login(page,target.user);await page.waitForFunction(()=>document.querySelector('aside img')?.getAttribute('src')==='/images/logo-fundo-escuro.png');
 check('missing logo local fallback',await page.locator('aside img').getAttribute('src')==='/images/logo-fundo-escuro.png');
 check('missing favicon local fallback',(await page.locator('link[rel=icon]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')))).every(x=>!x?.includes('wl-missing')));
 await snap(page,'missing-assets-fallback');await context.close();
 check('no uncaught browser errors',errors.length===0); completed=true;
}finally{
 if(browser)await browser.close();
 for(const f of fixtures){await db.activity.deleteMany({where:{entityId:{in:[f.org.id,...(f.user?[f.user.id]:[])]}}});await db.organization.delete({where:{id:f.org.id}});}
 for(const id of plans)await db.plan.delete({where:{id}});
 if(admin)await db.superAdmin.delete({where:{id:admin.id}});await db.$disconnect();
 await writeFile(out+'/visual.json',JSON.stringify({completed,checks,screens,errors,productionAccess:false},null,2));
}
