import { createServer } from 'node:http';
import assert from 'node:assert/strict';
export async function syntheticChatwoot(){
 const state={accounts:[],users:[],webhooks:[],calls:[],nextAccount:100,nextUser:500,failListOnce:false,failAccountOnce:false,accountListStatus:200,failMembershipOnce:false,failWebhookOnce:false,holdAccount:null,holdWebhook:null,dropWebhookResponseOnce:false,webhookListStatus:200,webhookListBody:undefined,hideWebhooks:false};
 const platformToken='synthetic-platform-only',server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname,method=req.method;
  const chunks=[];for await(const c of req)chunks.push(c);let body={};try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{res.writeHead(400).end();return;}
  state.calls.push({path,method});const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
  const token=req.headers.api_access_token,user=state.users.find(u=>u.access_token===token);
  if(path.startsWith('/platform/')&&token!==platformToken){send(401,{error:'fixture_unauthorized'});return;}
  const view=u=>({...u,accounts:state.accounts.filter(a=>a.members.includes(u.id)).map(a=>({id:a.id,role:'administrator'}))});
  if(path==='/platform/api/v1/accounts'&&method==='GET'){
   if(state.failListOnce){state.failListOnce=false;send(503,{error:'synthetic_unavailable'});}else send(state.accountListStatus,state.accounts.map(a=>({id:a.id,name:a.name,custom_attributes:a.custom_attributes})));return;
  }
  if(path==='/platform/api/v1/accounts'&&method==='POST'){
   if(state.failAccountOnce){state.failAccountOnce=false;send(503,{error:'synthetic_account_unavailable'});return;}
   const a={id:state.nextAccount++,...body,members:[]};state.accounts.push(a);if(state.holdAccount)await state.holdAccount();send(200,a);return;
  }
  const accountMatch=path.match(/^\/platform\/api\/v1\/accounts\/(\d+)$/);
  if(accountMatch&&method==='GET'){const a=state.accounts.find(x=>x.id===+accountMatch[1]);send(a?200:404,a||{});return;}
  if(path==='/platform/api/v1/users'&&method==='POST'){
   assert.equal(body.password_confirmation,body.password,'Original Platform API password confirmation contract');
   // Match the public Platform API's by-email reuse, preserving the old identity.
   let u=state.users.find(x=>x.email===body.email);
   if(!u){u={id:state.nextUser++,name:body.name,email:body.email,confirmed:true,custom_attributes:body.custom_attributes,access_token:'synthetic-user-token-'+state.nextUser};state.users.push(u);}
   send(200,view(u));return;
  }
  const userMatch=path.match(/^\/platform\/api\/v1\/users\/(\d+)(\/login)?$/);
  if(userMatch&&method==='GET'){const u=state.users.find(x=>x.id===+userMatch[1]);send(u?200:404,u?userMatch[2]?{url:'/app/login?synthetic-user='+u.id}:view(u):{});return;}
  const memberMatch=path.match(/^\/platform\/api\/v1\/accounts\/(\d+)\/account_users$/);
  if(memberMatch&&method==='POST'){
   if(state.failMembershipOnce){state.failMembershipOnce=false;send(503,{error:'synthetic_membership_unavailable'});return;}
   const a=state.accounts.find(x=>x.id===+memberMatch[1]);if(!a){send(404,{});return;}
   if(!a.members.includes(body.user_id))a.members.push(body.user_id);send(200,{user_id:body.user_id});return;
  }
  if(path==='/api/v1/profile'&&method==='GET'){send(user?200:401,user?view(user):{});return;}
  const webhookMatch=path.match(/^\/api\/v1\/accounts\/(\d+)\/webhooks$/);
  if(webhookMatch){
   const account=state.accounts.find(x=>x.id===+webhookMatch[1]);if(!user||!account?.members.includes(user.id)){send(403,{});return;}
   if(method==='GET'){send(state.webhookListStatus,state.webhookListBody===undefined?(state.hideWebhooks?[]:state.webhooks.filter(w=>w.accountId===account.id)):state.webhookListBody);return;}
   if(method==='POST'){
    if(state.failWebhookOnce){state.failWebhookOnce=false;send(503,{error:'synthetic_webhook_unavailable '+token});return;}
    if(state.holdWebhook)await state.holdWebhook();const w={id:state.webhooks.length+1,accountId:account.id,...body};state.webhooks.push(w);if(state.dropWebhookResponseOnce){state.dropWebhookResponseOnce=false;res.destroy();return;}send(200,w);return;
   }
  }
  send(404,{error:'unsupported_fixture_endpoint'});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 return {state,base,platformToken,fetch:async(url,options)=>{assert.equal(new URL(url).origin,base,'External provider access forbidden');return fetch(url,options);},close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
