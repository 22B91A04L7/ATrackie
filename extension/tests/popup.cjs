// Exercises actual popup handlers with controlled async completions; no DOM simulation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/App.jsx'),'utf8');
const helpers=source.slice(source.indexOf('  function beginOperation()'),source.indexOf('  //handles raw text'));
const applied=source.slice(source.indexOf('  async function handleApplied()'),source.indexOf('  async function handleDiscard()'));
function setup(saveJob){
  const state={error:'',saving:false,step:'pending',removed:0,saved:null};
  const context={busy:{current:false},generation:{current:0},sessionRef:{current:{token:'A',userId:'A'}},pendingJob:{job:{title:'A job'},revision:'r1'},
    setError(v){state.error=v},setSaving(v){state.saving=v},setLoading(){},setPendingJob(v){state.pending=v},setSavedJob(v){state.saved=v},setStep(v){state.step=v},
    saveJob,async removePendingJob(session,revision){assert.equal(session.token,'A');assert.equal(revision,'r1');state.removed++;return {removed:true}},console:{error(){}}};
  vm.createContext(context);vm.runInContext(helpers+applied,context);return {context,state};
}
async function main(){
  let calls=0,release;
  const gate=new Promise(resolve=>{release=resolve});
  const first=setup(async(job,token)=>{assert.equal(token,'A');calls++;await gate;return {job:{_id:'saved'}}});
  const pending=first.context.handleApplied();await first.context.handleApplied();
  assert.equal(calls,1);assert.equal(first.state.saving,true);
  release();await pending;assert.equal(first.state.step,'saved');assert.equal(first.state.removed,1);assert.equal(first.context.busy.current,false);
  console.log('PASS Repeated confirmation issues one save, disables controls, and clears only the matching draft');
  const failed=setup(async()=>{throw new Error('Connection lost')});await failed.context.handleApplied();
  assert.equal(failed.state.error,'Connection lost');assert.equal(failed.state.removed,0);assert.equal(failed.state.saving,false);
  assert.match(source,/<PendingJob[\s\S]*?error=\{error\}/);
  assert.match(fs.readFileSync(path.join(__dirname,'../src/components/PendingJob.jsx'),'utf8'),/role="alert">\{error\}/);
  console.log('PASS Failed save preserves pending work, releases the lock and passes its error to the alert');
  let resolveOld;
  const switched=setup(()=>new Promise(resolve=>{resolveOld=resolve}));const old=switched.context.handleApplied();
  switched.context.generation.current++;switched.context.sessionRef.current={token:'B',userId:'B'};
  resolveOld({job:{_id:'A-saved'}});await old;
  assert.equal(switched.state.removed,0);assert.equal(switched.state.saved,null);
  console.log('PASS A late save response cannot clear or display work in a different account');
}
main().catch(error=>{console.error(error);process.exitCode=1});
