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
  const open = manual.slice(manual.indexOf('  function handleOpenJobPosting'), manual.indexOf('  if (saved)'));
  let destination;
  const page = {URL, formData: {url: 'https://example.test/job/123'}, window: {location: {assign(url) {destination = url;}}}, setError(value) {error = value;}};
  vm.createContext(page); vm.runInContext(open, page);
  page.handleOpenJobPosting(); assert.equal(destination, page.formData.url);
  destination = undefined; page.formData.url = 'javascript:alert(1)'; page.handleOpenJobPosting();
  assert.equal(destination, undefined); assert.match(error, /HTTP/);
  console.log('PASS shared status returns server timeline, preserves state on conflict; posting return uses URL and rejects unsafe schemes');
})().catch(error => {console.error(error); process.exitCode = 1;});
