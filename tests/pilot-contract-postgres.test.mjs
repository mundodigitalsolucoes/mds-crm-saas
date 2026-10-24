// Existing commercial engine/guards and real Sidebar with two disposable organizations.
// enforce is a dependency-injected simulation; the deployment manifest remains empty.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {NextResponse} from 'next/server.js';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as permissions from '../src/lib/permissions.ts';
import {createModuleAuthorizer} from '../src/lib/authorization/authorize.ts';
import {authorizationEffect,modeForOrganization} from '../src/lib/authorization/policy.ts';
import * as resolver from '../src/lib/entitlements/resolver.ts';
import * as brandingValues from '../src/lib/branding-values.ts';
import {loadHandler,disposableDatabaseUrl} from './helpers/load-disposable-handler.mjs';
import {loadServerModule} from './helpers/load-server-module.ts';
let db;const orgs=[];
before(()=>{db=new PrismaClient({datasources:{db:{url:disposableDatabaseUrl()}}});});
after(async()=>{for(const o of orgs)await db.organization.delete({where:{id:o.id}});await db.$disconnect();});
test('pilot: real context/Sidebar, permissions and isolated existing guards; global policy stays observe_only',async()=>{
 for(const kind of ['mds','pilot']){
  const features=kind==='mds'?['atendimento','vendas','marketing']:['atendimento','vendas','white_label'];
  const org=await db.organization.create({data:{name:'Fictitious '+kind,slug:'pilot-policy-'+randomUUID(),plan:'trial',trialEndsAt:new Date(Date.now()+86400000),features:JSON.stringify(features)}});orgs.push(org);
  for(const role of ['owner','admin','user']){
   const p=Object.fromEntries(permissions.ALL_MODULES.map(k=>[k,{view:true,create:role!=='user',edit:role!=='user',delete:role!=='user'}]));
   const user=await db.user.create({data:{organizationId:org.id,name:role,email:randomUUID()+'@example.invalid',passwordHash:'not-a-login',role,permissions:JSON.stringify(p)}});
   const identity={user:{id:user.id,organizationId:org.id,role}};
   const auth=loadHandler('src/lib/checkPermission.ts',{'next/server':{NextResponse},'next-auth':{getServerSession:async()=>identity},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:db},'@/lib/permissions':permissions});
   const organization=loadHandler('src/lib/entitlements/organization.ts',{'../prisma':{prisma:db},'./resolver':resolver});
   const contextModule=loadHandler('src/lib/authorization/application-context.ts',{'../checkPermission':auth,'../entitlements/organization':organization,'./policy':{modeForOrganization}});
   const access=await contextModule.getApplicationContext();assert.equal(access.organizationId,org.id);assert.equal(access.mode,'observe_only');
   const {default:Sidebar}=loadServerModule(new URL('../src/components/Sidebar.tsx',import.meta.url),{
    '@/lib/branding-values':brandingValues,react:{...React,useState:initial=>React.useState(typeof initial==='object'?{atendimento:true,vendas:true,marketing:true,configuracoes:true,ajuda:true}:initial)},
    'next/link':{default:props=>React.createElement('a',props)},'next/navigation':{usePathname:()=>'/dashboard'},'next-auth/react':{useSession:()=>({data:identity}),signOut:()=>{}},'next/dynamic':{default:()=>()=>null},
    '@/hooks/usePermission':{usePermission:()=>({canAccess:resource=>permissions.hasPermission(permissions.parsePermissions(user.permissions,role),resource,'view'),isAdmin:role!=='user',isLoading:false})},
   });
   const html=renderToStaticMarkup(React.createElement(Sidebar,{access}));
   for(const path of ['/dashboard','/leads','/kanban','/atendimento'])assert.ok(html.includes('href="'+path+'"'));
   for(const path of ['/projects','/tasks','/os','/reports'])assert.equal(html.includes('href="'+path+'"'),kind==='mds');
   const authorize=createModuleAuthorizer({session:async()=>identity,readUser:id=>db.user.findUnique({where:{id},include:{organization:true}})});
   for(const mode of ['observe_only','enforce']){
    const evaluateModuleAccess=async request=>authorizationEffect(await authorize(request),kind==='pilot'?mode:'observe_only');
    const guard=loadHandler('src/lib/authorization/guards.ts',{'next/server':{NextResponse},'../checkPermission':auth,'./server':{evaluateModuleAccess},'./policy':{authorizationEffect,modeForOrganization}},{console:{info(){}}});
    const page=loadHandler('src/lib/authorization/page.ts',{'next/navigation':{notFound:()=>{throw Error('NOT_FOUND');},redirect:()=>{throw Error('LOGIN');}},'./server':{evaluateModuleAccess},'./guards':{recordAuthorizationObservation(){}}});
    for(const [module,permission] of [['marketing','projects'],['vendas','leads'],['vendas','kanban'],['atendimento','atendimento']]){
     const request={module,permission,action:'view'},blocked=kind==='pilot'&&module==='marketing'&&mode==='enforce';
     const result=await guard.checkModulePermission(request);assert.equal(result.allowed,!blocked);if(blocked)assert.equal(result.errorResponse.status,403);
     if(blocked)await assert.rejects(page.checkModulePage(request),/NOT_FOUND/);else await page.checkModulePage(request);
    }
    assert.equal(modeForOrganization(org.id),'observe_only');
   }
  }
 }
});
