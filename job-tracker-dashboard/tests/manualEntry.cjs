const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const helpers = { URL, TextEncoder, atob };
vm.createContext(helpers);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/utils/manualEntry.js'), 'utf8').replaceAll('export ', ''), helpers);
const good = { title: 'Engineer', company: 'Example', source: 'example.test', url: 'https://example.test/job', responsibilities: ['Build'], requiredSkills: ['SQL'], preferredSkills: [] };
assert.equal(helpers.validateManualJob(good), '');
for (const field of ['title', 'company', 'source']) assert.match(helpers.validateManualJob({...good, [field]: '   '}), /required/);
assert.match(helpers.validateManualJob({...good, url: 'ftp://example.test'}), /http/);
assert.match(helpers.validateManualJob({...good, title: 'a'.repeat(501)}), /500/);
assert.match(helpers.validateManualJob({...good, responsibilities: Array(101).fill('task')}), /100 items/);
assert.match(helpers.validateManualJob({...good, requiredSkills: ['a'.repeat(2001)]}), /2000/);
assert.match(helpers.validateManualJob({...good, responsibilities: Array(100).fill('a'.repeat(2000))}), /100 KB/);
const token = id => `header.${Buffer.from(JSON.stringify({userId:id})).toString('base64url')}.signature`;
const a = token('000000000000000000000001'), b = token('000000000000000000000002');
assert.notEqual(helpers.manualDraftKey(a, 'rev1'), helpers.manualDraftKey(b, 'rev1'));
assert.notEqual(helpers.manualDraftKey(a, 'rev1'), helpers.manualDraftKey(a, 'rev2'));
assert.equal(helpers.manualDraftKey('bad', 'rev1'), null);
const source = fs.readFileSync(path.join(__dirname, '../src/pages/ManualEntryPage.jsx'), 'utf8');
const change = source.slice(source.indexOf('  function handleChange'), source.indexOf('  function handleSubmit'));
const stored = new Map();
let warning, form;
const context = {formData: {...good}, pageToken:a, draftKey:helpers.manualDraftKey(a, 'rev1'), error:'',
 setFormData(value){form=value;}, setDraftWarning(value){warning=value;},
 localStorage:{getItem(){return a;}, setItem(key,value){stored.set(key,value);}}
};
vm.createContext(context); vm.runInContext(change,context);
context.handleChange({target:{name:'company',value:'Updated company'}});
assert.equal(JSON.parse(stored.get(context.draftKey)).company, 'Updated company');
assert.equal(warning,'');
context.localStorage.setItem = () => {throw new Error('Quota exceeded');};
context.handleChange({target:{name:'company',value:'Keep my typing'}});
assert.equal(form.company,'Keep my typing'); assert.match(warning,/could not be saved/);
console.log('PASS manual validation: required text, HTTP URL, field/list/body limits; edits persist by account and revision; storage failure preserves form and warns');
