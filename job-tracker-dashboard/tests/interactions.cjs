const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
(async () => {
  const source = read('components/StatusControl.jsx');
  const handler = source.slice(source.indexOf('  async function confirmStatusChange'), source.indexOf('  function cancelStatusChange'));
  const updated = {_id: 'job-a', status: 'Interview', timeline: [{status: 'Interview'}]};
  let result, error;
  const context = { pendingStatus: 'Interview', saving: false, job: {_id: 'job-a'}, API_URL: 'http://localhost:5000',
    localStorage: {getItem: () => 'token'}, navigate() {}, console: {error() {}},
    setSaving() {}, setError(value) {error = value;}, setStatus() {}, setPendingStatus() {},
    onStatusChange(value) {result = value;},
    apiRequest: async () => ({status: 200, ok: true, json: async () => ({job: updated})})
  };
  vm.createContext(context); vm.runInContext(handler, context);
  await context.confirmStatusChange();
  assert.equal(result, updated);
  result = undefined;
  context.apiRequest = async () => {throw new Error('Conflict: refresh');};
  await context.confirmStatusChange();
  assert.equal(result, undefined); assert.equal(error, 'Conflict: refresh');
  const manual = read('pages/ManualEntryPage.jsx');
  const open = manual.slice(manual.indexOf('  function handleGoToDashboard'), manual.indexOf('  if (saved)', manual.indexOf('  function handleGoToDashboard')));
  let destination;
  const page = {navigate(url) {destination = url;}};
  vm.createContext(page); vm.runInContext(open, page);
  page.handleGoToDashboard(); assert.equal(destination, '/jobs');
  console.log('PASS shared status returns server timeline, preserves state on conflict; manual success returns to dashboard');
})().catch(error => {console.error(error); process.exitCode = 1;});
