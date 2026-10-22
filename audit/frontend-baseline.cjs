// Executes existing logic with simulated Chrome/network APIs, not a browser E2E test.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const results = [];
async function main() {
  const storage = {token:'account-a',pendingJob:{title:'A pending job'},manualEntryJob:{title:'A manual draft'}};
  let listener;
  const chrome = {
    runtime:{onMessageExternal:{addListener(fn){listener=fn;}}},
    storage:{local:{
      get(keys,cb){const data=Object.fromEntries(keys.map(k=>[k,storage[k]])); if(cb)cb(data); return Promise.resolve(data);},
      set(data,cb){Object.assign(storage,data); cb?.();},
      remove(keys,cb){keys.forEach(k=>delete storage[k]);cb?.();},
    },onChanged:{addListener(){}}},
    action:{setBadgeText(){},setBadgeBackgroundColor(){}},
  };
  vm.runInNewContext(read('extension/src/background.js'),{chrome});
  const sender = {origin:'https://atrackie.vercel.app'};
  listener({type:'AUTHENTICATE',token:'account-b'},sender,()=>{});
  const inheritedPending = Boolean(storage.pendingJob);
  listener({type:'LOGOUT'},sender,()=>{});
  results.push({name:'Account switch and logout',inheritedPending,manualDraftSurvivesLogout:Boolean(storage.manualEntryJob),tokenCleared:!storage.token});
  listener({type:'SAVE_MANUAL_ENTRY_JOB',job:{title:'Manual',company:'Company'}},sender,()=>{});
  assert.equal(storage.pendingJob.title,'Manual'); assert.equal(storage.manualEntryJob,undefined);
  results.push({name:'Manual-entry handoff',result:'PASS: pending created and draft removed'});

  const service = read('extension/src/services/jobService.js').replace(/import[^\n]*\n/,'').replace(/export /g,'');
  for(const status of [401,502]) {
    let cleared=false, message;
    const context = {getAuthToken:async()=>'test-token',clearAuthToken:async()=>{cleared=true;},fetch:async()=>({status,ok:false,json:async()=>{throw new SyntaxError('Unexpected token < in JSON');}})};
    vm.createContext(context); vm.runInContext(service,context);
    try { await context.saveJob({title:'Test'}); } catch(error) { message=error.message; }
    results.push({name:`Non-JSON response ${status}`,message,tokenCleared:cleared});
  }
  const app = read('extension/src/App.jsx');
  const handler = app.slice(app.indexOf('  async function handleApplied()'),app.indexOf('  async function handleDiscard()'));
  let removed=false, errorShown;
  const context = {pendingJob:{title:'Test'},saveJob:async()=>{throw new Error('network unavailable');},removePendingJob:async()=>{removed=true;},setPendingJob(){},setSavedJob(){},setStep(){},setError(error){errorShown=error;},console:{error(){}}};
  vm.createContext(context);vm.runInContext(handler,context);await context.handleApplied();
  assert.equal(removed,false);
  results.push({name:'Save failure preserves pending work',result:'PASS',capturedError:errorShown,errorPropPassedToPending:/\berror=/.test(app.split('<PendingJob')[1]?.split('/>')[0] || ''),savingHardcodedFalse:app.includes('saving={false}')});
  let saves=0, release;
  const gate=new Promise(resolve=>{release=resolve;});
  context.saveJob=async()=>{saves++;await gate;return {job:{title:'Saved'}};};
  const first=context.handleApplied(),second=context.handleApplied();
  release();await Promise.all([first,second]);
  results.push({name:'Repeated confirmation before first response',saveRequests:saves});
  const manual=read('job-tracker-dashboard/src/pages/ManualEntryPage.jsx');
  const effect=manual.slice(manual.indexOf('  useEffect(() => {')+'  useEffect(() => {'.length,manual.indexOf('  }, []);'));
  let error;
  try {vm.runInNewContext(effect,{EXTENSION_ID:'test',setFormData(){},console});}catch(e){error=e.message;}
  results.push({name:'Manual page without Chrome API',error});
  fs.writeFileSync(path.join(__dirname,'frontend-results.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
