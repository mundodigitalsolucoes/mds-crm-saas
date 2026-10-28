import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextResponse} from 'next/server.js';
import {loadHandler} from './helpers/load-disposable-handler.mjs';
const cap=10*1024*1024+64*1024;
function fixture({authenticated=true,permitted=()=>true,fastTimeout=false,source='src/app/api/attachments/route.ts'}={}){
 const state={read:0,parsed:0,writes:0,transactions:0,cancelled:false};
 class Parser extends Response{async formData(){state.parsed++;return super.formData();}}
 const session={user:{id:'synthetic-user',organizationId:'synthetic-org',role:'user'}};
 const route=loadHandler(source,{'next/server':{NextResponse},'@/lib/prisma':{prisma:{$transaction:async fn=>{state.transactions++;return fn({attachment:{create:async({data})=>({...data,createdAt:new Date()})}});}}},
  '@/lib/checkPermission':{checkAuth:async()=>({authenticated,session,errorResponse:NextResponse.json({error:'Unavailable'},{status:401})}),checkPermission:async(module)=>({allowed:permitted(module),session,errorResponse:NextResponse.json({error:'Forbidden'},{status:authenticated?403:401})})},
  '@/lib/authorization/guards':{commercialEntityDenial:async()=>null},
  '@/lib/attachments/storage':{MAX_ATTACHMENT_BYTES:10*1024*1024,attachmentDownloadUrl:id=>'/api/attachments/'+id,writePrivateAttachment:async()=>{state.writes++;},removePrivateAttachment:async()=>{},AttachmentStorageError:class extends Error{}},
  ...(fastTimeout?{'node:timers':{setTimeout:fn=>setTimeout(fn,5),clearTimeout}}:{})},{Response:Parser});
 return{state,route};
}
function request(state,{chunks=[],length,type='multipart/form-data; boundary=synthetic',stall=false}={}){
 const headers=new Headers({'content-type':type});if(length!==undefined)headers.set('content-length',String(length));
 let at=0;return{headers,body:new ReadableStream({pull(controller){state.read++;if(stall)return new Promise(()=>{});if(at<chunks.length)controller.enqueue(chunks[at++]);else controller.close();},cancel(){state.cancelled=true;}},{highWaterMark:0}),formData:async()=>{state.parsed++;return new FormData();}};
}
async function valid(state,bytes=Buffer.from('SYNTHETIC_UPLOAD')){const form=new FormData();form.set('entityType','lead');form.set('entityId','synthetic-lead');form.set('file',new Blob([bytes]),'synthetic.txt');const body=new Request('http://127.0.0.1/api/attachments',{method:'POST',body:form});return request(state,{type:body.headers.get('content-type'),chunks:[new Uint8Array(await body.arrayBuffer())]});}
for(const mode of ['anonymous','no-permission'])test('upload denies '+mode+' before reading or parsing body',async()=>{const f=fixture({authenticated:mode!=='anonymous',permitted:()=>false});const r=await f.route.POST(request(f.state,{chunks:[new Uint8Array(cap+1)]}));assert.equal(r.status,mode==='anonymous'?401:403);assert.equal(f.state.read,0);assert.equal(f.state.parsed,0);assert.equal(f.state.writes,0);});
test('declared oversize is rejected without consuming body',async()=>{const f=fixture();assert.equal((await f.route.POST(request(f.state,{length:cap+1}))).status,413);assert.equal(f.state.read,0);assert.equal(f.state.parsed,0);});
test('streamed/chunked body is capped and cancelled before multipart parsing',async()=>{const f=fixture();const chunks=Array.from({length:30},()=>new Uint8Array(1024*1024));assert.equal((await f.route.POST(request(f.state,{chunks}))).status,413);assert.equal(f.state.read,11);assert.equal(f.state.parsed,0);assert.ok(f.state.cancelled);assert.equal(f.state.transactions,0);});
for(const [type,length,status]of[['application/json',undefined,415],['multipart/form-data',undefined,400],['multipart/form-data; boundary=synthetic','invalid',400]])test('invalid envelope rejected before read: '+type+'/'+length,async()=>{const f=fixture();assert.equal((await f.route.POST(request(f.state,{type,length}))).status,status);assert.equal(f.state.read,0);assert.equal(f.state.parsed,0);});
test('malformed multipart is controlled400, without writes',async()=>{const f=fixture();assert.equal((await f.route.POST(request(f.state,{chunks:[Buffer.from('invalid multipart')]}))).status,400);assert.equal(f.state.parsed,1);assert.equal(f.state.writes,0);});
test('read deadline cancels stalled body without parsing',async()=>{const f=fixture({fastTimeout:true});assert.equal((await f.route.POST(request(f.state,{stall:true}))).status,408);assert.ok(f.state.cancelled);assert.equal(f.state.parsed,0);});
test('coarse admission cannot grant a different entity permission',async()=>{const f=fixture({permitted:module=>module==='tasks'});assert.equal((await f.route.POST(await valid(f.state))).status,403);assert.equal(f.state.writes,0);});
test('legitimate bounded upload preserves existing success behavior',async()=>{const f=fixture();assert.equal((await f.route.POST(await valid(f.state))).status,201);assert.equal(f.state.writes,1);assert.equal(f.state.parsed,1);});
test('10MiB legitimate file fits envelope allowance; larger file rejected',async()=>{const f=fixture();assert.equal((await f.route.POST(await valid(f.state,Buffer.alloc(10*1024*1024)))).status,201);const g=fixture();assert.equal((await g.route.POST(await valid(g.state,Buffer.alloc(10*1024*1024+1)))).status,413);assert.equal(g.state.writes,0);});
