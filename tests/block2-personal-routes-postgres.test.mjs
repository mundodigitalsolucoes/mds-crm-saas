import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server.js'
import * as validation from '../src/lib/validations/index.ts'
import * as permissions from '../src/lib/permissions.ts'
import { disposableDatabaseUrl, loadHandler } from './helpers/load-disposable-handler.mjs'
let prisma
const orgs = []
const routes = [['auth/me','GET'],['auth/export-data','GET'],['auth/delete-account','DELETE'],['notifications','GET'],['notifications/read','POST'],['usage','GET']]
before(() => { prisma = new PrismaClient({ datasources: { db: { url: disposableDatabaseUrl() } } }) })
after(async () => { if(prisma){for(const id of orgs)await prisma.organization.delete({where:{id}});await prisma.$disconnect()} })
async function fixture(role) {
 const suffix=randomUUID();const org=await prisma.organization.create({data:{name:'Personal route test',slug:`personal-${suffix}`}});orgs.push(org.id)
 const user=await prisma.user.create({data:{name:'Fixture',email:`${suffix}@example.invalid`,passwordHash:'not-login',organizationId:org.id,role}})
 return {org,user}
}
function route(f,path) {
 const session={user:{id:f.user.id,organizationId:f.sessionOrg||f.org.id,role:f.user.role}}
 const imports={'next/server':{NextResponse},'next-auth':{getServerSession:async()=>session},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma},'@/lib/permissions':permissions}
 const guard=loadHandler('src/lib/checkPermission.ts',imports)
 return loadHandler(`src/app/api/${path}/route.ts`,{...imports,'@/lib/checkPermission':guard,'@/lib/validations':validation,'@/lib/checkLimits':{getOrganizationUsage:async id=>{assert.equal(id,f.org.id);return {fixtureUsage:true}}}})
}
function request(method){return new NextRequest('http://localhost/api/test',{method,...(method==='POST'?{headers:{'content-type':'application/json'},body:JSON.stringify({all:true})}:{})})}
test('G2 personal routes: deleted user/tenant and foreign membership denied for three roles',async()=>{
 for(const role of ['owner','admin','user'])for(const state of ['deleted-user','deleted-tenant','foreign-membership']){
  const f=await fixture(role)
  if(state==='deleted-user')await prisma.user.update({where:{id:f.user.id},data:{deletedAt:new Date()}})
  if(state==='deleted-tenant')await prisma.organization.update({where:{id:f.org.id},data:{deletedAt:new Date()}})
  if(state==='foreign-membership')f.sessionOrg=randomUUID()
  const before=await prisma.user.findUnique({where:{id:f.user.id}})
  for(const [path,method]of routes){const response=await route(f,path)[method](request(method));assert.ok([401,403].includes(response.status),`${role} ${state} ${method} ${path}: ${response.status}`)}
  assert.deepEqual(await prisma.user.findUnique({where:{id:f.user.id}}),before)
 }
})
test('G2 personal routes: active own membership retains legitimate read/write behavior',async()=>{
 for(const role of ['owner','admin','user'])for(const [path,method]of routes){const f=await fixture(role);const response=await route(f,path)[method](request(method));assert.equal(response.status,path==='auth/delete-account'&&role==='owner'?403:200,`${role} ${path}`)}
})
