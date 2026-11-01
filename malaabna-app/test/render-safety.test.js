const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const actionAttrDeclaration = appSource.match(/^function actionAttr\(type,handler\)\{.*$/m);
const dispatchDeclaration = appSource.match(/^function dispatchAppAction\(event\)\{.*$/m);
assert.ok(actionAttrDeclaration && dispatchDeclaration, 'delegated action helpers must exist');

const actionContext = vm.createContext({});
vm.runInContext(`const appActionHandlers=new Map();\nconst appActionPrefix='test-session';\nlet appActionCounter=0;\n${actionAttrDeclaration[0]}\n${dispatchDeclaration[0]}\nglobalThis.createAction=actionAttr;\nglobalThis.dispatchAction=dispatchAppAction;`, actionContext);

test('delegated action IDs resolve only to registered closures', () => {
  let called = 0;
  const attr = actionContext.createAction('click', () => { called += 1; return false; });
  assert.match(attr, /^data-app-action="test-session-\d+"$/);
  const id = attr.match(/"([^"]+)"/)[1];
  let prevented = false;
  const target = { getAttribute: () => id };
  actionContext.dispatchAction({
    type: 'click',
    target: { closest: () => target },
    preventDefault: () => { prevented = true; }
  });
  assert.equal(called, 1);
  assert.equal(prevented, true);
  actionContext.dispatchAction({
    type: 'change',
    target: { closest: () => target },
    preventDefault: () => {}
  });
  assert.equal(called, 1, 'event type must match the registered action');
  actionContext.dispatchAction({
    type: 'click',
    target: { closest: () => ({ getAttribute: () => 'forged-handler' }) },
    preventDefault: () => {}
  });
  assert.equal(called, 1, 'unknown IDs must not execute code');
});
