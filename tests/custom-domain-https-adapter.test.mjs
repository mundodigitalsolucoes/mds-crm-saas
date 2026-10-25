import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import * as crypto from 'node:crypto';
import { loadHandler } from './helpers/load-disposable-handler.mjs';
function adapter({status=200,authorized=true,body='{"proof":"fixture-proof"}',location}={}){
 let options, destroyed=false;
 const networkModule=loadHandler('src/lib/domains/network.ts',{
  'node:dns/promises':{Resolver:class{ }},'node:net':net,'node:crypto':crypto,
  'node:https':{request:(config,callback)=>{
   options=config;const req=new EventEmitter();req.destroy=error=>req.emit('error',error);
   req.end=()=>{const res=new EventEmitter();res.statusCode=status;res.headers={location};res.socket={authorized,getPeerCertificate:()=>({valid_to:new Date(Date.now()+86400000).toUTCString()})};res.destroy=()=>{destroyed=true;};
    callback(res);queueMicrotask(()=>{res.emit('data',Buffer.from(body));res.emit('end');});};return req;
  }},
 });
 return {probe:networkModule.pinnedHttpsProbe,options:()=>options,destroyed:()=>destroyed};
}
test('HTTPS adapter pins lookup, validates TLS SNI and never sends cookies or ingress secrets',async()=>{
 const a=adapter();assert.equal((await a.probe('crm.customer.example.com','8.8.8.8','a'.repeat(64))).proof,'fixture-proof');
 const options=a.options();assert.equal(options.hostname,'crm.customer.example.com');assert.equal(options.servername,options.hostname);assert.equal(options.rejectUnauthorized,true);assert.equal(options.port,443);
 assert.deepEqual(Object.keys(options.headers),['User-Agent']);
 let address;options.lookup('attacker-changed-dns.example.com',{all:false},(_err,ip,family)=>{address=[ip,family];});assert.deepEqual(address,['8.8.8.8',4]);
 options.lookup('attacker-changed-dns.example.com',{all:true},(_err,ips)=>{address=ips;});assert.deepEqual(JSON.parse(JSON.stringify(address)),[{address:'8.8.8.8',family:4}]);
});
for(const scenario of [{status:302,location:'https://127.0.0.1/private'},{authorized:false},{body:'x'.repeat(4097)},{body:'invalid json'},{body:'{"proof":123}'}]){
 test('HTTPS adapter rejects unsafe/invalid response '+JSON.stringify({status:scenario.status,authorized:scenario.authorized,bytes:scenario.body?.length}),async()=>{
  const a=adapter(scenario);await assert.rejects(a.probe('crm.customer.example.com','8.8.8.8','a'.repeat(64)));
 });
}
