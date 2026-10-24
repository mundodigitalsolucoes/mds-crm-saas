import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disposableEnvironment, history, SANITIZED_BASE } from '../scripts/block2-c6-ci.mjs';
const local={DATABASE_URL:'postgresql://ci:ci@127.0.0.1:5432/mds_crm_dev'};
test('C6 schema preparation refuses remote/production/mismatched database configurations before any command',()=>{
 for(const DATABASE_URL of ['postgresql://ci:ci@production.invalid:5432/mds_crm_dev','postgresql://ci:ci@127.0.0.1:5432/production','postgresql://ci:ci@127.0.0.1:5433/mds_crm_dev','https://127.0.0.1:5432/mds_crm_dev','invalid'])assert.throws(()=>disposableEnvironment({DATABASE_URL,CI:'true',BLOCK2_CI_DISPOSABLE:'true'},true));
 assert.throws(()=>disposableEnvironment({...local,BLOCK2_TEST_DATABASE_URL:'postgresql://different.invalid/db'}));
});
test('C6 schema preparation requires both CI and explicit disposable opt-in',()=>{
 for(const flags of [{},{CI:'true'},{BLOCK2_CI_DISPOSABLE:'true'},{CI:'false',BLOCK2_CI_DISPOSABLE:'true'}])assert.throws(()=>disposableEnvironment({...local,...flags},true));
 assert.equal(disposableEnvironment({...local,CI:'true',BLOCK2_CI_DISPOSABLE:'true'},true).BLOCK2_TEST_DATABASE_URL,local.DATABASE_URL);
});
test('C6 HTTP/Node run may use local disposable database without permitting schema preparation',()=>{
 assert.equal(disposableEnvironment(local).BLOCK2_TEST_DATABASE_URL,local.DATABASE_URL);
 assert.throws(()=>disposableEnvironment(local,true));
});
test('C6 history guard uses reachable sanitized ancestry, preserving historical baselines',()=>{
 const result=history();assert.equal(result.base,SANITIZED_BASE);assert.equal(result.unsafeAncestry,false);assert.equal(result.forbiddenPaths,0);assert.equal(result.protectedBaselinesReachable,true);
});
