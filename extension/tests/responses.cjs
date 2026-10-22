const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/services/jobService.js'), 'utf8')
  .replace(/^import .*\r?\n/gm, '').replaceAll('export async function', 'async function');
let response, cleared;
const context = { API_URL: 'http://localhost:5000',
  fetch: async () => { if (response instanceof Error) throw response; return response; },
  getAuthToken: async () => 'active', clearAuthToken: async token => { cleared = token; }
};
vm.createContext(context); vm.runInContext(source, context);
(async () => {
  for (const [name, arg] of [['saveJob', {}], ['extractJob', 'text'], ['checkJobDuplicate', 'url']]) {
    response = { status: 401, ok: false, json: async () => { throw new SyntaxError('HTML'); } };
    cleared = undefined;
    await assert.rejects(context[name](arg, 'captured-token'), /session has expired/);
    assert.equal(cleared, 'captured-token');
    response = { status: 502, ok: false, json: async () => { throw new SyntaxError('HTML'); } };
    await assert.rejects(context[name](arg), /HTTP 502/);
    response = new Error('offline');
    await assert.rejects(context[name](arg), /Could not reach/);
  }
  response = { status: 200, ok: true, json: async () => ({}) };
  await assert.rejects(context.saveJob({}), /did not confirm/);
  await assert.rejects(context.checkJobDuplicate('url'), /unexpected/);
  response = { status: 409, ok: false, json: async () => ({job: {_id: 'saved-id'}}) };
  assert.equal((await context.saveJob({})).alreadySaved, true);
  response = { status: 201, ok: true, json: async () => ({job: {_id: 'saved-id'}}) };
  assert.equal((await context.saveJob({})).job._id, 'saved-id');
  console.log('PASS: non-JSON 401/502 and offline handling on all job requests; invalid success rejected; save/retry preserved');
})().catch(error => { console.error(error); process.exitCode = 1; });
