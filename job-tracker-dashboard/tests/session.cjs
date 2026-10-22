// Exercises the existing manual-submit and storage subscription logic without a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/pages/ManualEntryPage.jsx'), 'utf8');
const submit = source.slice(source.indexOf('  function handleSubmit('), source.indexOf('  function handleOpenJobPosting('));
function setup(activeToken) {
  const state = { messages: [], error: '', saving: false, saved: false };
  const context = {
    saving: false, draftReady: true, pageToken: 'account-a', draftRevision: 'revision-a', EXTENSION_ID: 'test-extension',
    formData: { title: 'Manual job', responsibilities: 'Task one\nTask two', requiredSkills: 'SQL, JS', preferredSkills: '' },
    localStorage: { getItem: () => activeToken },
    setError(value) { state.error = value; }, setSaving(value) { state.saving = value; }, setSaved(value) { state.saved = value; },
    chrome: { runtime: { sendMessage(id, message, callback) { state.messages.push({ id, message }); state.respond = callback; } } },
    console: { error() {} }
  };
  vm.createContext(context); vm.runInContext(submit, context);
  return { state, context };
}
const switched = setup('account-b');
switched.context.handleSubmit({ preventDefault() {} });
assert.equal(switched.state.messages.length, 0);
assert.match(switched.state.error, /account changed/);
console.log('PASS A stale manual-entry tab cannot submit its form under a new account');
const valid = setup('account-a');
valid.context.handleSubmit({ preventDefault() {} });
assert.equal(valid.state.messages[0].message.token, 'account-a');
assert.equal(valid.state.messages[0].message.revision, 'revision-a');
assert.equal(valid.state.messages[0].message.job.responsibilities.length, 2);
valid.state.respond({ success: false, error: 'Draft changed' });
assert.equal(valid.state.saved, false); assert.equal(valid.state.saving, false); assert.equal(valid.state.error, 'Draft changed');
assert.equal(valid.context.formData.title, 'Manual job');
console.log('PASS Manual completion includes its owner session and revision, and preserves the form on rejection');
const route = fs.readFileSync(path.join(__dirname, '../src/components/ProtectedRoute.jsx'), 'utf8');
const subscription = route.slice(route.indexOf('function subscribeToSession'), route.indexOf('function ProtectedRoute'));
let listener, removed = false, notifications = 0;
const context = { window: { addEventListener(type, fn) { listener = fn; }, removeEventListener(type, fn) { removed = fn === listener; } } };
vm.createContext(context); vm.runInContext(subscription, context);
const unsubscribe = context.subscribeToSession(() => { notifications++; });
listener({ key: 'unrelated' }); listener({ key: 'token' }); listener({ key: null });
assert.equal(notifications, 2); unsubscribe(); assert.equal(removed, true);
console.log('PASS Dashboard session subscription responds to cross-tab login/logout and cleans up');
