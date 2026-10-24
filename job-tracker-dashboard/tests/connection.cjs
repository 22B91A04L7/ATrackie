const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/connectExtension.js'), 'utf8')
  .replace(/^import .*;\r?\n/m, '').replace('export function', 'function');
function setup(runtime) {
  const context = { EXTENSION_ID: 'expected-id', setTimeout, clearTimeout };
  if (runtime) context.chrome = { runtime };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.connectExtension;
}
(async () => {
  let respond;
  const connect = setup({ sendMessage(id, message, callback) {
    assert.equal(id, 'expected-id');
    assert.equal(message.token, 'test-token');
    respond = callback;
  } });
  let confirmed = false;
  const pending = connect('test-token').then(() => { confirmed = true; });
  await Promise.resolve();
  assert.equal(confirmed, false);
  respond({ success: true });
  await pending;
  assert.equal(confirmed, true);
  await assert.rejects(setup({ sendMessage(id, message, callback) {
    callback({ success: false, error: 'Could not verify this account' });
  } })('test-token'), /Could not verify/);
  const runtime = { lastError: { message: 'Receiving end does not exist' },
    sendMessage(id, message, callback) { callback(); } };
  await assert.rejects(setup(runtime)('test-token'), /Receiving end/);
  await assert.rejects(setup()('test-token'), /unavailable/);
  await assert.rejects(setup({ sendMessage(id, message, callback) { callback(); } })('test-token'), /did not confirm/);
  console.log('PASS: waits for confirmation; reports rejection, transport failure, unavailable extension, and missing response');
})().catch(error => { console.error(error); process.exitCode = 1; });
