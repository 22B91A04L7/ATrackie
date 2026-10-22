// Diagnostic baseline only: real controllers/models, ephemeral MongoDB,
// stubbed AI, simulated Chrome storage. Never reads backend/.env.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'backend/package.json'));
const mongoose = req('mongoose');
const express = req('express');
const jwt = req('jsonwebtoken');
const toolsDir = process.argv[2] || path.join(process.env.TEMP, 'atrackie-baseline-tools');
const systemBinary = process.argv[3];
if (!systemBinary || !fs.existsSync(systemBinary)) throw new Error('Pass the installed mongod.exe path as the third argument; runtime downloads are disabled.');
process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
const { MongoMemoryServer } = require(path.join(toolsDir, 'node_modules/mongodb-memory-server'));
process.env.JWT_SECRET = 'isolated-baseline-test-secret-not-for-real-use';
// Route modules call dotenv.config(); prevent any environment-file access.
req('dotenv').config = () => ({ parsed: {} });
let aiFailure = false;
const aiPath = req.resolve('./services/aiService');
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  extractJobData: async () => { if (aiFailure) throw new Error('simulated provider outage'); return { title: 'Test role', company: 'Test company' }; },
}};
const Job = req('./models/Job');
const User = req('./models/User');
const results = [];
async function check(name, fn) {
  try { results.push({ name, status: 'observed', details: await fn() }); }
  catch (error) { results.push({ name, status: 'harness-failure', details: error.message }); }
}
let db, server;
async function main() {
  db = await MongoMemoryServer.create({ binary: { systemBinary, version: '8.0.4' }, instance: { ip: '127.0.0.1', dbName: 'atrackie_baseline' } });
  const uri = db.getUri();
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri);
  await Promise.all([Job.init(), User.init()]);
  const app = express();
  app.use(express.json());
  app.use('/api', req('./routes/JobRoutes'));
  app.use('/api/auth', req('./routes/authRoutes'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function api(method, endpoint, body, token) {
    const response = await fetch(base + endpoint, {
      method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000),
    });
    const raw = await response.text();
    let data; try { data = JSON.parse(raw); } catch { data = { nonJson: true }; }
    return { status: response.status, data };
  }
  const password = 'Baseline-test-password-123';
  async function account(email) {
    assert.equal((await api('POST', '/api/auth/signup', { name: 'Test', email, password })).status, 201);
    const login = await api('POST', '/api/auth/login', { email, password });
    assert.equal(login.status, 200); return login.data.token;
  }
  const a = await account('a@example.test'), b = await account('b@example.test');
  const jobBody = { title: 'Engineer', company: 'Test', url: 'https://example.test/job/1', source: 'example.test' };
  const created = await api('POST', '/api/jobs', jobBody, a);
  assert.equal(created.status, 201);
  const id = created.data.job._id;
  await check('Happy path: save/list/read/status/timeline', async () => {
    assert.equal((await api('GET', '/api/jobs', undefined, a)).data.jobs.length, 1);
    assert.equal((await api('GET', `/api/jobs/${id}`, undefined, a)).status, 200);
    const updated = await api('PATCH', `/api/jobs/${id}/status`, { status: 'Interview' }, a);
    assert.equal(updated.status, 200); assert.equal(updated.data.job.timeline.length, 2);
    assert.equal((await api('PATCH', `/api/jobs/${id}/status`, { status: 'Applied' }, a)).status, 400);
    return 'PASS: valid flow succeeds; backward transition rejected';
  });
  await check('Two-account isolation across list/read/status/delete/bulk/duplicate', async () => {
    assert.equal((await api('GET', '/api/jobs', undefined, b)).data.jobs.length, 0);
    for (const [method, endpoint, body] of [['GET', `/api/jobs/${id}`], ['PATCH', `/api/jobs/${id}/status`, {status:'Rejected'}], ['DELETE', `/api/jobs/${id}`]]) {
      assert.equal((await api(method, endpoint, body, b)).status, 404);
    }
    assert.equal((await api('DELETE', '/api/jobs', {jobIds:[id]}, b)).data.deletedCount, 0);
    assert.equal((await api('POST', '/api/jobs/check-duplicate', {url:jobBody.url}, b)).data.exists, false);
    assert.equal((await api('GET', `/api/jobs/${id}`, undefined, a)).status, 200);
    return 'PASS: tested operations do not expose or mutate the other account';
  });
  await check('Missing/tampered/expired authentication', async () => {
    for (const token of [undefined, 'invalid-token', jwt.sign({userId:'000000000000000000000001'}, process.env.JWT_SECRET, {expiresIn:-1})]) {
      assert.equal((await api('GET', '/api/jobs', undefined, token)).status, 401);
    }
    return 'PASS: all rejected with 401';
  });
  await check('Sequential duplicate', async () => {
    assert.equal((await api('POST', '/api/jobs', jobBody, a)).status, 409); return 'PASS: 409';
  });
  await check('Concurrent duplicate saves', async () => {
    const body = {...jobBody, url:'https://example.test/race'};
    const replies = await Promise.all(Array.from({length:10}, () => api('POST','/api/jobs',body,a)));
    return { statuses: replies.map(r=>r.status), savedDocuments: await Job.countDocuments({url:body.url}), indexes: Job.schema.indexes() };
  });
  await check('Missing request bodies', async () => {
    const endpoints = ['/api/jobs','/api/jobs/check-duplicate','/api/jobs/extract','/api/auth/login','/api/auth/signup'];
    return await Promise.all(endpoints.map(async endpoint => ({endpoint, status:(await api('POST',endpoint,undefined,a)).status})));
  });
  await check('Concurrent status updates (controlled overlapping reads)', async () => {
    const created = await api('POST','/api/jobs',{...jobBody,url:'https://example.test/status-race'},a);
    const raceId = created.data.job._id;
    const original = Job.findOne;
    let reads = 0, release;
    const barrier = new Promise(resolve => { release=resolve; });
    const timer = setTimeout(release, 3000);
    Job.findOne = async function(...args) {
      const doc = await original.apply(this,args);
      if(String(args[0]._id)===raceId) { reads++; if(reads===2)release(); await barrier; }
      return doc;
    };
    try {
      const replies = await Promise.all([1,2].map(()=>api('PATCH',`/api/jobs/${raceId}/status`,{status:'Interview'},a)));
      const saved = await Job.findById(raceId);
      return {statuses:replies.map(r=>r.status),timeline:saved.timeline.map(e=>e.status)};
    } finally { Job.findOne=original; clearTimeout(timer); }
  });
  await check('Optional field validation', async () => {
    const r = await api('POST','/api/jobs',{...jobBody,url:'https://example.test/types',salary:123,requiredSkills:'SQL'},a);
    return {status:r.status, salary:r.data.job?.salary, requiredSkills:r.data.job?.requiredSkills};
  });
  await check('One-character signup password', async () => ({status:(await api('POST','/api/auth/signup',{name:'Short',email:'short@example.test',password:'a'})).status}));
  await check('Extraction input and provider failure', async () => {
    const valid = await api('POST','/api/jobs/extract',{pageText:'A job description'},a);
    const tooLong = await api('POST','/api/jobs/extract',{pageText:'x'.repeat(30001)},a);
    aiFailure = true;
    const failed = await api('POST','/api/jobs/extract',{pageText:'A job description'},a);
    aiFailure = false;
    assert.equal(valid.status,200); assert.equal(tooLong.status,400); assert.equal(failed.status,500);
    return 'PASS: stubbed success, oversized input rejection, generic provider error';
  });
  await check('Successful owner single and bulk deletion', async () => {
    assert.equal((await api('DELETE',`/api/jobs/${id}`,undefined,a)).status,200);
    const jobs = (await api('GET','/api/jobs',undefined,a)).data.jobs;
    const r = await api('DELETE','/api/jobs',{jobIds:jobs.map(j=>j._id)},a);
    assert.equal(r.data.deletedCount,jobs.length); return 'PASS';
  });
  await check('Extension storage account switching and logout (Chrome API simulation)', async () => {
    const storage = {token:'account-a',pendingJob:{title:'A private pending job'},manualEntryJob:{title:'A manual draft'}};
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
    vm.runInNewContext(fs.readFileSync(path.join(root,'extension/src/background.js'),'utf8'),{chrome});
    listener({type:'AUTHENTICATE',token:'account-b'},{origin:'https://atrackie.vercel.app'},()=>{});
    const pendingSurvivesAccountSwitch = Boolean(storage.pendingJob);
    listener({type:'LOGOUT'},{origin:'https://atrackie.vercel.app'},()=>{});
    return {pendingSurvivesAccountSwitch,manualDraftSurvivesLogout:Boolean(storage.manualEntryJob),tokenRemoved:!storage.token,pendingRemoved:!storage.pendingJob};
  });
}
main().catch(error=>{results.push({name:'Harness setup/run',status:'harness-failure',details:error.message});process.exitCode=1;}).finally(async()=>{
  if(server) await new Promise(resolve=>server.close(resolve));
  await mongoose.disconnect();
  if(db) await db.stop();
  fs.writeFileSync(path.join(__dirname,'baseline-results.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
  if(results.some(r=>r.status==='harness-failure'))process.exitCode=1;
});
