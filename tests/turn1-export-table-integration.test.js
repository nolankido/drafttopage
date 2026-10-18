import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Turn 1 integration: both separately reviewed changes must ship in every writing workspace.
const routes = ['write', 'word-to-wordpress', 'word-to-markdown', 'html-to-markdown', 'google-docs-to-wordpress', 'markdown-to-wordpress', 'markdown-to-html', 'markdown-to-word'];

async function read(path) { return readFile(new URL('../' + path, import.meta.url), 'utf8'); }

test('every generated writing route includes export review shortcut and guided table arrangement', async () => {
  for (const route of routes) {
    const html = await read('public/' + route + '/index.html');
    assert.match(html, /id="approved-export-shortcut"/, route + ': approved export shortcut');
    assert.match(html, /id="jump-to-primary-export"/, route + ': destination action shortcut');
    assert.match(html, /id="table-row-arrange"/, route + ': table row arrangement');
    assert.match(html, /id="table-move-to"/, route + ': row relocation action');
    assert.ok(html.indexOf('id="reviewed"') < html.indexOf('id="approved-export-shortcut"'), route + ': shortcut must follow explicit approval');
    assert.ok(html.indexOf('id="table-row-arrange"') < html.indexOf('id="reviewed"'), route + ': table changes must stay in editor before review');
  }
});

test('integrated styles retain current-draft navigation and new review shortcut', async () => {
  const css = await read('public/desk.css');
  assert.ok(css.includes('.site-header .workspace-navigation'));
  assert.ok(css.includes('.workspace-resume'));
  assert.ok(css.includes('.approved-export-shortcut[hidden]'));
});

test('combined experience keeps export action separate from navigation', async () => {
  const workflow = await read('public/workflow-navigation.js');
  assert.ok(workflow.includes('navigate(target)'));
  assert.ok(workflow.includes("getAttribute?.('aria-disabled')"));
  const desk = await read('public/desk.js');
  assert.ok(desk.includes('updateExitWarning(); workflow?.update();'));
  assert.match(workflow, /Nothing was copied or published by this shortcut/);
  const table = await read('scripts/table-editor.html.inc');
  assert.match(table, /Only prepared cells change/);
  assert.match(table, /id="table-apply"/);
});
