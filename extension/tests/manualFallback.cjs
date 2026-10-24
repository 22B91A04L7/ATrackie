const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf8');
const start = source.indexOf('  async function handleStartManualEntry');
const end = source.indexOf('  //to view duplicate', start);
let opened = 0, saved, error, finished = 0, current = true;
const context = {
 beginOperation: () => ({session:{token:'owner-token'}}), setLoading(){},
 getActiveTab: async () => ({url:'https://example.test/job'}),
 isCurrent: () => current,
 getSourceFromUrl: url => new URL(url).hostname,
 setManualEntryJob: async (job,session) => {saved={job,session};},
 setHasManual(){}, handleCompleteDetailsManually(){opened++;},
 setError(value){error=value;}, finishOperation(){finished++;}
};
vm.createContext(context); vm.runInContext(source.slice(start,end),context);
(async()=>{
 await context.handleStartManualEntry();
 assert.equal(saved.job.url,'https://example.test/job'); assert.equal(saved.job.source,'example.test');
 assert.equal(saved.session.token,'owner-token'); assert.equal(opened,1);
 context.setManualEntryJob = async () => {throw new Error('Existing draft');};
 await context.handleStartManualEntry(); assert.equal(opened,1); assert.equal(error,'Existing draft');
 current=false; saved=null;
 await context.handleStartManualEntry(); assert.equal(saved,null); assert.equal(opened,1); assert.equal(finished,3);
 console.log('PASS manual fallback seeds posting URL/source, preserves existing drafts on failure, and ignores account changes');
})().catch(error=>{console.error(error);process.exitCode=1;});
