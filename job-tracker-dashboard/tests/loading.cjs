const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
async function verifyWarmup(folder) {
 const source = fs.readFileSync(path.join(__dirname, '../../', folder, 'src/utils/warmBackend.js'), 'utf8').replace(/^import .*;\r?\n/, '').replace('export function','function');
 let calls=0, release, request, onHide, deadline, cleaned=0;
 const context={API_URL:'https://backend.test', AbortController,
  setTimeout(fn, ms){assert.equal(ms,90000);deadline=fn;return 1;},clearTimeout(){cleaned++;},
  window:{addEventListener(name,fn){assert.equal(name,'pagehide');onHide=fn;}, removeEventListener(){onHide=null;}},
  fetch(url,options){calls++;assert.equal(url,'https://backend.test/api/health');request=options;return new Promise(resolve=>{release=resolve;});}
 };
 vm.createContext(context);vm.runInContext(source,context);
 const pending=context.warmBackend();context.warmBackend();assert.equal(calls,1);
 assert.equal(request.credentials,'omit');assert.equal(request.cache,'no-store');assert.equal(request.headers,undefined);
 onHide();assert.equal(request.signal.aborted,true);release({ok:true});await pending;assert.equal(onHide,null);assert.equal(cleaned,1);
 // A new document gets one request, and a rejected fetch is silent without retry.
 context.fetch=()=>{calls++;return Promise.reject(new Error('offline'));};
 vm.runInContext(source.replace('let started = false;', 'started = false;'),context);
 await context.warmBackend();assert.equal(calls,2);context.warmBackend();assert.equal(calls,2);
 assert.equal(typeof deadline,'function');
}
function verifyFeedback(folder) {
 const source=fs.readFileSync(path.join(__dirname,'../../',folder,'src/components/LoadingFeedback.jsx'),'utf8');
 const body=source.slice(source.indexOf('function ActiveFeedback'),source.indexOf('  return <div'))+'  return {seconds, message};\n}';
 let value=0,tick,cleanup,now=0,cleared=0;
 const context={Date:{now:()=>now},useState:()=>[value,next=>{value=next;}],useEffect(fn){if(!cleanup)cleanup=fn();},setInterval(fn){tick=fn;return 1;},clearInterval(){cleared++;}};
 vm.createContext(context);vm.runInContext(body,context);
 assert.equal(context.ActiveFeedback({kind:'backend'}).message,'');
 now=5000;tick();assert.match(context.ActiveFeedback({kind:'backend'}).message,/Still connecting/);
 now=11000;tick();assert.match(context.ActiveFeedback({kind:'backend'}).message,/may be waking/);
 assert.doesNotMatch(context.ActiveFeedback({kind:'extraction'}).message,/waking/);
 assert.doesNotMatch(context.ActiveFeedback({kind:'local'}).message,/server/);
 cleanup();assert.equal(cleared,1);
}
(async()=>{
 for(const folder of ['job-tracker-dashboard','extension']) {await verifyWarmup(folder);verifyFeedback(folder);}
 const server=fs.readFileSync(path.join(__dirname,'../../backend/server.js'),'utf8');
 let handler;
 const context={mongoose:{connection:{readyState:1}},app:{get(route,fn){assert.equal(route,'/api/health');handler=fn;}}};
 vm.createContext(context);vm.runInContext(server.slice(server.indexOf("app.get('/api/health'"),server.indexOf('// API routes')),context);
 const res={set(name,value){assert.equal(value,'no-store');},status(code){this.code=code;return this;},json(body){this.body=body;}};
 handler({},res);assert.equal(res.code,200);assert.equal(res.body.status,'ok');
 context.mongoose.connection.readyState=0;handler({},res);assert.equal(res.code,503);
 console.log('PASS warmup deduplication, silent failure, page-close abort, timer cleanup, delayed feedback, AI wording, and health readiness');
})().catch(error=>{console.error(error);process.exitCode=1;});
