// Real worker/storage/service modules; simulated Chrome API, no network or browser profile writes.
// node --experimental-vm-modules extension/tests/drafts.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'../src');
const data={};const changes=[];let internal,external;let badge='';
const tokens={};
function token(id){const t=`header.${Buffer.from(JSON.stringify({userId:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.signature`;tokens[t]=id;return t;}
const a=token('000000000000000000000001'),b=token('000000000000000000000002');
const chrome={runtime:{id:'test-extension',onMessage:{addListener(fn){internal=fn;}},onMessageExternal:{addListener(fn){external=fn;}}},storage:{local:{
  async get(keys){if(typeof keys==='string')keys=[keys];return Object.fromEntries(keys.map(k=>[k,structuredClone(data[k])]))},
  async set(values){const diff={};for(const [k,v]of Object.entries(values)){diff[k]={oldValue:data[k],newValue:structuredClone(v)};data[k]=structuredClone(v);}queueMicrotask(()=>changes.forEach(fn=>fn(diff,'local')));},
  async remove(keys){if(typeof keys==='string')keys=[keys];const diff={};for(const k of keys){diff[k]={oldValue:data[k]};delete data[k];}queueMicrotask(()=>changes.forEach(fn=>fn(diff,'local')));}
},onChanged:{addListener(fn){changes.push(fn);}}},action:{async setBadgeText({text}){badge=text;},async setBadgeBackgroundColor(){}}};
function send(message,outside=false){return new Promise(resolve=>{const listener=outside?external:internal;const accepted=listener(message,outside?{origin:dashboardOrigin}:{id:'test-extension'},resolve);if(!accepted)resolve({success:false});});}
chrome.runtime.sendMessage=send;
const context=vm.createContext({chrome,console,atob,crypto:webcrypto,URL,AbortSignal,Date,fetch:async(url,options)=>{
  const supplied=options.headers.Authorization.slice(7);return {ok:Boolean(tokens[supplied]),json:async()=>({userId:tokens[supplied]})};
}});
const cache=new Map();
async function load(file){if(cache.has(file))return cache.get(file);const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});cache.set(file,m);await m.link((name,parent)=>load(path.resolve(path.dirname(parent.identifier),name.endsWith('.js')?name:`${name}.js`)));return m;}
const passed=[];
let dashboardOrigin;
async function main(){
  const worker=await load(path.join(root,'background.js'));await worker.evaluate();
  dashboardOrigin = new URL(cache.get(path.join(root, 'config.js')).namespace.DASHBOARD_URL).origin;
  async function auth(t){assert.equal((await send({type:'AUTHENTICATE',token:t},true)).success,true);}
  async function command(type,t,more={}){return send({type,token:t,...more});}
  await auth(a);
  const draft=(await command('SET_PENDING_JOB',a,{job:{title:'Private A'}})).draft;
  await command('SET_MANUAL_JOB',a,{job:{title:'Manual A'}});
  await command('LOGOUT',a);assert.equal(data.token,undefined);
  await auth(b);assert.equal((await command('GET_DRAFT_STATE',b)).pending,null);
  const fakeB=b.replace(/signature$/, 'forged');
  assert.equal((await command('GET_DRAFT_STATE',fakeB)).success,false);
  assert.equal((await command('GET_MANUAL_ENTRY_JOB',b)).job,null);
  assert.equal((await command('GET_MANUAL_ENTRY_JOB',a)).success,false);
  assert.equal((await command('REMOVE_PENDING_JOB',a,{revision:draft.revision})).success,false);
  await auth(a);assert.equal((await command('GET_DRAFT_STATE',a)).pending.job.title,'Private A');
  assert.equal((await command('GET_MANUAL_ENTRY_JOB',a)).job.title,'Manual A');
  passed.push('Account-specific pending/manual work survives logout and cannot be read or modified by another active account');
  assert.equal((await command('REMOVE_PENDING_JOB',a,{revision:'stale'})).removed,false);
  assert.equal((await command('GET_DRAFT_STATE',a)).pending.revision,draft.revision);
  await command('REMOVE_PENDING_JOB',a,{revision:draft.revision});
  const manual=await command('GET_MANUAL_ENTRY_JOB',a);
  assert.equal((await command('SAVE_MANUAL_ENTRY_JOB',a,{job:{title:'Wrong'},revision:'stale'})).success,false);
  const handoffs=await Promise.all([1,2].map(()=>command('SAVE_MANUAL_ENTRY_JOB',a,{job:{title:'Completed A'},revision:manual.revision})));
  assert.equal(handoffs.filter(r=>r.success).length,1);
  assert.equal((await command('GET_MANUAL_ENTRY_JOB',a)).job,null);
  passed.push('Draft revisions reject stale removal and concurrent manual handoffs; normal handoff succeeds');
  await auth(b);
  await command('CLEAR_EXPIRED_TOKEN',a);assert.equal(data.token,b);
  assert.equal((await command('LOGOUT',a)).success,false);assert.equal(data.token,b);
  passed.push('Late failures and stale-tab logout cannot clear the new account session');
  const forged=`header.${Buffer.from(JSON.stringify({userId:'000000000000000000000001',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.forged`;
  assert.equal((await send({type:'AUTHENTICATE',token:forged},true)).success,false);assert.equal(data.token,undefined);
  await auth(b);
  passed.push('Unverified account connections cannot select another user’s local drafts');
  await chrome.storage.local.set({pendingJob:{title:'Legacy'},manualEntryJob:{title:'Legacy manual'}});
  const before=await command('GET_DRAFT_STATE',b);assert.equal(before.hasLegacy,true);assert.equal(before.pending,null);
  assert.equal((await command('GET_MANUAL_ENTRY_JOB',b)).job,null);
  await command('CLAIM_LEGACY_DRAFTS',b);
  assert.equal((await command('GET_DRAFT_STATE',b)).pending.job.title,'Legacy');assert.equal(data.pendingJob,null);
  await auth(a);assert.equal((await command('GET_DRAFT_STATE',a)).pending.job.title,'Completed A');
  passed.push('Legacy work stays hidden until explicitly claimed and never overwrites another account');
  await chrome.storage.local.set({pendingJob:{title:'Another legacy'}});
  assert.equal((await command('CLAIM_LEGACY_DRAFTS',a)).success,false);assert.equal(data.pendingJob.title,'Another legacy');
  await command('LOGOUT',a);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(badge,'');
  passed.push('Restoration refuses to overwrite existing drafts; logout clears the active-account badge');
  const services=await load(path.join(root,'services/jobService.js'));await services.evaluate();
  context.fetch=async()=>({status:409,ok:false,json:async()=>({job:{_id:'existing'}})});
  assert.equal((await services.namespace.saveJob({url:'https://example.test'},a)).job._id,'existing');
  passed.push('Save retry recovers the existing application from a duplicate response');
  context.fetch=async(url,options)=>({status:tokens[options.headers.Authorization.slice(7)]?200:401,ok:true,json:async()=>({userId:tokens[options.headers.Authorization.slice(7)]})});
  await auth(a);
  assert.equal((await send({type:'ACCOUNT_DELETED',token:a},true)).success,false);
  delete tokens[a];
  assert.equal((await send({type:'ACCOUNT_DELETED',token:a},true)).success,true);
  assert.equal(data.token,undefined);
  assert.equal(data[`draft:000000000000000000000001:pending`],undefined);
  assert.ok(data[`draft:000000000000000000000002:pending`]);
  passed.push('Verified account deletion clears only the connected owner drafts and token');
  passed.forEach(message=>console.log(`PASS ${message}`));console.log(`${passed.length} checks passed`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
