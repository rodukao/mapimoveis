const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('dist/ids.js','utf8');
test('UUID fallback preserves native support and requires cryptographic randomness',()=>{
  const native=()=> 'native';const supported={crypto:{randomUUID:native}};vm.runInNewContext(source,supported);assert.equal(supported.crypto.randomUUID,native);
  let calls=0;const context={crypto:{getRandomValues:bytes=>{calls++;return bytes.fill(255);}}};vm.runInNewContext(source,context);
  assert.equal(context.crypto.randomUUID(),'ffffffff-ffff-4fff-bfff-ffffffffffff');assert.equal(calls,1);
  const unsupported={crypto:{}};vm.runInNewContext(source,unsupported);assert.throws(()=>unsupported.crypto.randomUUID(),/getRandomValues/);
});
