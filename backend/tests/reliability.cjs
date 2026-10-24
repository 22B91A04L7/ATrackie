// Run with: node backend/tests/reliability.cjs <test-tools-dir> <installed-mongod>
const assert = require('node:assert/strict');
const path = require('node:path');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
process.env.JWT_SECRET = 'isolated-batch2-test-secret';
require('dotenv').config = () => ({parsed:{}});
const { MongoMemoryServer } = require(path.join(process.argv[2], 'node_modules/mongodb-memory-server'));
const aiPath = require.resolve('../services/aiService');
require.cache[aiPath] = {id:aiPath,filename:aiPath,loaded:true,exports:{extractJobData:async()=>({title:'Test'})}};
const Job = require('../models/Job');
const { ensureJobIndexes } = require('../utils/jobIndexes');
let db, server;
const passed = [];
async function main() {
  assert.ok(process.argv[3], 'An installed mongod path is required; no downloads allowed');
  db = await MongoMemoryServer.create({binary:{systemBinary:process.argv[3],version:'8.0.4'},instance:{ip:'127.0.0.1',dbName:'atrackie_batch2'}});
  assert.match(db.getUri(),/^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(db.getUri());
  const a = '000000000000000000000001', b = '000000000000000000000002';
  const User = require('../models/User');
  await User.create([{_id:a,name:'Owner A',email:'a@example.test',password:'unused'}, {_id:b,name:'Owner B',email:'b@example.test',password:'unused'}]);
  const old = {userId:a,title:'Test',company:'Test',source:'example.test',url:'https://example.test/legacy',appliedAt:new Date()};
  await Job.create([old,old]);
  await assert.rejects(ensureJobIndexes(),/Duplicate applications exist/);
  assert.equal(await Job.countDocuments(),2);
  passed.push('Index preflight detects duplicates without deleting or merging records');
  // Only this disposable database is cleaned.
  await Job.deleteMany({});
  await ensureJobIndexes();
  const indexes = await Job.collection.indexes();
  assert.equal(indexes.find(i=>i.name==='unique_user_job_url').unique,true);
  passed.push('Unique account + URL index is created');
  const app=express();app.use(express.json());
  app.use(require('../middlewares/validateInput').inputError);
  app.use('/api',require('../routes/JobRoutes'));
  app.use('/api/auth',require('../routes/authRoutes'));
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const tokens={a:jwt.sign({userId:a},process.env.JWT_SECRET,{expiresIn:'1h'}),b:jwt.sign({userId:b},process.env.JWT_SECRET,{expiresIn:'1h'})};
  async function call(method,url,body,token=tokens.a) {
    const r=await fetch(`http://127.0.0.1:${server.address().port}${url}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:r.status,body:await r.json()};
  }
  assert.equal((await call('GET','/api/auth/session')).body.userId,a);
  const bcrypt = require('bcryptjs');
  const signup = { name: 'Password test', email: 'password@example.test', password: '1234567' };
  assert.equal((await call('POST', '/api/auth/signup', signup)).status, 400);
  assert.equal(await User.countDocuments({ email: signup.email }), 0);
  signup.password = '12345678';
  assert.equal((await call('POST', '/api/auth/signup', signup)).status, 201);
  assert.equal((await call('POST', '/api/auth/login', signup)).status, 200);
  await User.create({ name: 'Legacy test', email: 'legacy@example.test', password: await bcrypt.hash('old', 12) });
  assert.equal((await call('POST', '/api/auth/login', { email: 'legacy@example.test', password: 'old' })).status, 200);
  passed.push('Signup rejects seven characters, accepts eight, and existing shorter passwords still work at login');
  for (const password of ['a'.repeat(73), 'é'.repeat(37)]) {
    assert.equal((await call('POST', '/api/auth/signup', {...signup, email: 'oversize@example.test', password})).status, 400);
  }
  assert.equal(await User.countDocuments({email: 'oversize@example.test'}), 0);
  assert.equal((await call('POST', '/api/auth/signup', {...signup, email: 'boundary@example.test', password: 'é'.repeat(36)})).status, 201);
  const legacyLong = 'b'.repeat(73);
  await User.create({name: 'Legacy long', email: 'legacy-long@example.test', password: await bcrypt.hash(legacyLong, 12)});
  assert.equal((await call('POST', '/api/auth/login', {email: 'legacy-long@example.test', password: legacyLong})).status, 200);
  passed.push('Signup enforces 72 UTF-8 bytes, accepts the exact boundary, and preserves legacy long-password login');
  for (const [method, route] of [
    ['POST', '/api/auth/login'], ['POST', '/api/auth/signup'],
    ['POST', '/api/jobs'], ['POST', '/api/jobs/extract'],
    ['POST', '/api/jobs/check-duplicate'], ['DELETE', '/api/jobs']
  ]) {
    assert.equal((await call(method, route)).status, 400, `${route} must reject a missing body`);
  }
  assert.equal(await Job.countDocuments(), 0);
  passed.push('Missing request bodies return 400 on six endpoints without writing jobs');
  const forged=jwt.sign({userId:a},'wrong-signing-key',{expiresIn:'1h'});
  assert.equal((await call('GET','/api/auth/session',undefined,forged)).status,401);
  passed.push('Session verification accepts valid tokens and rejects forged signatures');
  const body={title:'Engineer',company:'Test',url:'https://example.test/job',source:'example.test'};
  for (const invalid of [{salary: 100}, {requiredSkills: 'SQL'}, {preferredSkills: [42]}, {title: 'a'.repeat(501)}, {jobDescription: 'a'.repeat(30001)}]) {
    assert.equal((await call('POST', '/api/jobs', {...body, ...invalid})).status, 400);
  }
  assert.equal((await call('POST', '/api/jobs', [])).status, 400);
  assert.equal((await call('DELETE', '/api/jobs', {jobIds: [{$ne: null}]})).status, 400);
  for (const [raw, status] of [['{broken', 400], [JSON.stringify({text: 'x'.repeat(103000)}), 413]]) {
    const result = await fetch(`http://127.0.0.1:${server.address().port}/api/jobs`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: raw
    });
    assert.equal(result.status, status);
    assert.equal(typeof (await result.json()).error, 'string');
  }
  assert.equal(await Job.countDocuments(), 0);
  passed.push('Invalid types, oversized fields, invalid IDs and malformed/oversized JSON are rejected without writes');
  const saves=await Promise.all(Array.from({length:10},()=>call('POST','/api/jobs',body)));
  assert.equal(saves.filter(r=>r.status===201).length,1);
  assert.equal(saves.filter(r=>r.status===409).length,9);
  assert.equal(await Job.countDocuments({userId:a,url:body.url}),1);
  const id=saves.find(r=>r.status===201).body.job._id;
  passed.push('Ten concurrent saves create exactly one application; nine return 409');
  const retry=await call('POST','/api/jobs',body);
  assert.equal(retry.status,409);assert.equal(retry.body.job._id,id);
  passed.push('Retry returns the owner’s existing record for lost-response recovery');
  assert.equal((await call('POST','/api/jobs',body,tokens.b)).status,201);
  assert.equal((await call('GET',`/api/jobs/${id}`,undefined,tokens.b)).status,404);
  assert.equal((await call('PATCH',`/api/jobs/${id}/status`,{status:'Interview'},tokens.b)).status,404);
  assert.equal((await call('DELETE',`/api/jobs/${id}`,undefined,tokens.b)).status,404);
  assert.equal((await call('DELETE','/api/jobs',{jobIds:[id]},tokens.b)).body.deletedCount,0);
  passed.push('Same URL is allowed for different users; cross-account reads/writes/deletes remain blocked');
  const original=Job.findOne;let reads=0,release;
  const barrier=new Promise(resolve=>{release=resolve;});
  const timer=setTimeout(release,3000);
  Job.findOne=async function(...args){const doc=await original.apply(this,args);if(String(args[0]._id)===id){if(++reads===2)release();await barrier;}return doc;};
  try {
    const updates=await Promise.all([1,2].map(()=>call('PATCH',`/api/jobs/${id}/status`,{status:'Interview'})));
    assert.deepEqual(updates.map(r=>r.status).sort(),[200,409]);
    assert.deepEqual((await Job.findById(id)).timeline.map(e=>e.status),['Applied','Interview']);
  } finally {Job.findOne=original;clearTimeout(timer);}
  passed.push('Overlapping status writes append one event and return one conflict');
  assert.equal((await call('PATCH',`/api/jobs/${id}/status`,{status:'Applied'})).status,400);
  assert.equal((await call('PATCH',`/api/jobs/${id}/status`,{status:'Selected'})).status,200);
  assert.equal((await call('PATCH',`/api/jobs/${id}/status`,{status:'Rejected'})).status,400);
  assert.equal((await call('GET','/api/jobs')).body.jobs.length,1);
  assert.equal((await call('DELETE',`/api/jobs/${id}`)).status,200);
  passed.push('Existing transitions, terminal states, listing and deletion remain correct');
  // The missing-body checks above consumed one login failure and one extraction.
  for (let i = 0; i < 9; i++) {
    assert.equal((await call('POST', '/api/auth/login', {email: 'missing@example.test', password: 'incorrect'})).status, 401);
    assert.equal((await call('POST', '/api/jobs/extract', {pageText: 'Test job description'})).status, 200);
  }
  assert.equal((await call('POST', '/api/auth/login', signup)).status, 429);
  assert.equal((await call('POST', '/api/jobs/extract', {pageText: 'Test job description'})).status, 429);
  assert.equal((await call('POST', '/api/jobs/extract', {pageText: 'Test job description'}, tokens.b)).status, 200);
  assert.equal((await call('GET', '/api/jobs')).status, 200);
  assert.equal((await call('POST', '/api/jobs', {...body, url: 'https://example.test/after-limit'})).status, 201);
  passed.push('Real routes enforce login/extraction limits; another account, listing and saving remain available');
  const profile = await call('GET', '/api/auth/profile');
  assert.equal(profile.body.user.email, 'a@example.test');
  assert.equal(profile.body.user.password, undefined);
  await User.updateOne({_id:a}, {$set:{password: await bcrypt.hash('delete-password', 12)}});
  assert.equal((await call('DELETE', '/api/auth/account', {password:'wrong',confirmation:'DELETE'})).status,400);
  assert.ok(await User.findById(a));
  assert.equal((await call('DELETE', '/api/auth/account', {password:'delete-password',confirmation:'NO'})).status,400);
  const otherJobs = await Job.countDocuments({userId:b});
  assert.equal((await call('DELETE', '/api/auth/account', {password:'delete-password',confirmation:'DELETE'})).status,200);
  assert.equal(await User.findById(a),null);
  assert.equal(await Job.countDocuments({userId:a}),0);
  assert.equal(await Job.countDocuments({userId:b}),otherJobs);
  assert.ok(await User.findById(b));
  assert.equal((await call('GET', '/api/auth/session')).status,401);
  assert.equal((await call('POST', '/api/jobs',body)).status,401);
  passed.push('Profile excludes password; deletion requires password/confirmation, preserves other users and revokes deleted-account access');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  await mongoose.disconnect();if(db)await db.stop();
  passed.forEach(message=>console.log(`PASS ${message}`));
  console.log(`${passed.length} checks passed`);
});
