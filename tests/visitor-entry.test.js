import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { writingPages } from '../scripts/writing-pages.mjs';
import { renderPage } from '../scripts/site-shell.mjs';

// Inspect the assembled pages directly so this gate cannot pass against stale
// generated HTML. The parser checks complete markup, not builder replacements.
let parsedPages;
function pages() {
  if (parsedPages) return parsedPages;
  const html = Object.fromEntries(writingPages.filter(page => page.desk).map(page => [page.route, renderPage(page)]));
  parsedPages = new Promise((resolve, reject) => {
    const parser = execFile('python3', ['-c', String.raw`
import json, sys
from html.parser import HTMLParser

VOID = set('area base br col embed hr img input link meta param source track wbr'.split())
TRACKED = set('import-file import-text import-entry-help import-file-status import-paste-status import-source-url import-source-url-help import-file-help import-html-help import-html-source-help import-first-row-headers import-format import-word-revisions preview-import import-advanced-options copied-import-alternatives word-import-alternatives copied-import-help import-file-details workspace-layout-options sample workflow-steps import-panel import-fields import-join-options import-new-article-help import-destination import-destination-help import-insertion-controls import-preview import-preview-heading'.split())
TRACKED.add('desk-status')

class Page(HTMLParser):
    def __init__(self, route):
        super().__init__()
        self.route = route
        self.stack = []
        self.nodes = {}
        self.labels = {}
        self.position = 0

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        self.position += 1
        node = {'tag': tag, 'attrs': attrs, 'position': self.position, 'hasText': False}
        key = attrs.get('id')
        if key:
            assert key not in self.nodes, (self.route, 'duplicate ID', key)
            node['ancestors'] = [{
                'tag': parent['tag'],
                'id': parent['attrs'].get('id'),
                'hidden': 'hidden' in parent['attrs'] or parent['attrs'].get('aria-hidden') == 'true' or 'inert' in parent['attrs'],
                'closed': parent['tag'] == 'details' and 'open' not in parent['attrs'],
                'disabled': 'disabled' in parent['attrs']
            } for parent in self.stack]
            self.nodes[key] = node
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        assert tag in VOID, (self.route, 'self-closing non-void HTML element', tag)
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        assert self.stack and self.stack[-1]['tag'] == tag, (self.route, 'unbalanced element', tag)
        node = self.stack.pop()
        if tag == 'label' and node['attrs'].get('for'):
            self.labels[node['attrs']['for']] = node['hasText']

    def handle_data(self, text):
        if text.strip():
            for node in self.stack:
                node['hasText'] = True

output = {}
for route, html in json.load(sys.stdin).items():
    page = Page(route)
    page.feed(html)
    page.close()
    assert not page.stack, (route, 'unclosed markup')
    output[route] = {
        'ids': list(page.nodes),
        'nodes': {key: node for key, node in page.nodes.items() if key in TRACKED},
        'labels': page.labels
    }
print(json.dumps(output))
`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(error);
      try { resolve(JSON.parse(stdout)); } catch (parseError) { reject(parseError); }
    });
    parser.stdin.on('error', reject);
    parser.stdin.end(JSON.stringify(html));
  });
  return parsedPages;
}

const focusedRoutes = [
  ['/word-to-wordpress/', 'import-file'],
  ['/word-to-markdown/', 'import-file'],
  ['/google-docs-to-wordpress/', 'import-text']
];
const contains = (node, ancestor) => node.ancestors.some(parent => parent.id === ancestor);
const blockedAncestors = node => node.ancestors.filter(parent => parent.hidden || parent.closed || parent.disabled);

test('All assembled workspaces have balanced markup and retain each shared control exactly once', async () => {
  const workspaces = await pages();
  assert.ok(workspaces['/write/'], 'the public writing workspace is present');
  const sharedIds = workspaces['/write/'].ids;
  for (const [route, page] of Object.entries(workspaces)) {
    assert.equal(new Set(page.ids).size, page.ids.length, route + ' has unique IDs');
    assert.deepEqual(sharedIds.filter(id => !page.ids.includes(id)), [], route + ' keeps all shared workspace IDs');
  }
});

test('Word and Docs visitors can reach their real source input before optional help, samples and layout controls', async () => {
  const workspaces = await pages();
  for (const [route, primaryId] of focusedRoutes) {
    const page = workspaces[route];
    const primary = page.nodes[primaryId];
    assert.ok(primary, route + ' has its intended source input');
    assert.equal(primary.tag, primaryId === 'import-file' ? 'input' : 'textarea', route);
    if (primaryId === 'import-file') assert.equal(primary.attrs.type, 'file', route);
    assert.deepEqual(blockedAncestors(primary), [], route + ' input is not hidden, disabled or behind a closed disclosure');
    for (const attribute of ['hidden', 'disabled', 'readonly', 'inert']) assert.equal(Object.hasOwn(primary.attrs, attribute), false, route + ' input remains usable');
    assert.equal(page.labels[primaryId], true, route + ' input has a nonempty associated label');
    assert.ok(contains(primary, 'import-fields'), route + ' input participates in busy-state disabling');
    const secondaryIds = ['sample', 'workspace-layout-options', 'import-format', 'import-first-row-headers', 'import-file-help', 'import-html-help'];
    if (primaryId === 'import-text') secondaryIds.push('import-source-url', 'import-file');
    for (const secondaryId of secondaryIds) {
      assert.ok(primary.position < page.nodes[secondaryId].position, route + ' input precedes ' + secondaryId);
    }
    const advanced = page.nodes['import-advanced-options'];
    assert.equal(advanced.tag, 'details', route + ' optional source settings use a native disclosure');
    assert.equal(Object.hasOwn(advanced.attrs, 'open'), false, route + ' optional source settings start collapsed');
    assert.ok(contains(page.nodes['import-first-row-headers'], 'import-advanced-options'), route + ' table settings remain reachable');
    if (primaryId === 'import-text') assert.ok(contains(page.nodes['import-source-url'], 'import-advanced-options'), route + ' relative-link settings remain reachable');
  }
});

test('Source descriptions and feedback stay accessible while every import control remains in its busy-state fieldset', async () => {
  const workspaces = await pages();
  const sourceControls = ['import-file', 'import-text', 'import-format', 'import-word-revisions', 'import-source-url', 'import-first-row-headers', 'preview-import'];
  for (const [route, page] of Object.entries(workspaces)) {
    for (const id of sourceControls) assert.ok(contains(page.nodes[id], 'import-fields'), route + ': ' + id + ' stays in import-fields');
    for (const id of ['import-file', 'import-text', 'import-format', 'import-word-revisions', 'import-source-url']) {
      assert.equal(page.labels[id], true, route + ': ' + id + ' retains its associated label');
    }
    assert.ok(page.nodes['import-first-row-headers'].ancestors.some(parent => parent.tag === 'label'), route + ' header choice retains its checkbox label');
  }
  for (const [route, primaryId] of focusedRoutes) {
    const page = workspaces[route];
    const references = page.nodes[primaryId].attrs['aria-describedby'].split(/\s+/);
    const statusId = primaryId === 'import-file' ? 'import-file-status' : 'import-paste-status';
    assert.ok(references.includes('import-entry-help'), route + ' announces the entry instruction');
    assert.ok(references.includes(statusId), route + ' connects the input to its feedback');
    for (const id of references) {
      assert.ok(page.nodes[id], route + ' description target exists: ' + id);
      assert.deepEqual(blockedAncestors(page.nodes[id]), [], route + ' description is outside collapsed or hidden guidance: ' + id);
    }
    assert.equal(page.nodes['import-entry-help'].hasText, true, route + ' has a usable entry instruction');
    assert.deepEqual(blockedAncestors(page.nodes['import-file-status']), [], route + ' source feedback is outside closed file alternatives');
    assert.equal(page.nodes['desk-status'].attrs.role, 'status', route + ' one shared status announces results');
    assert.equal(page.nodes['desk-status'].attrs['aria-live'], 'polite', route);
    assert.equal(page.nodes['import-file-status'].attrs.role, undefined, route + ' field feedback does not duplicate announcements');
    assert.equal(page.nodes['import-file-status'].attrs['aria-live'], undefined, route);
  }
});

test('New-article guidance and existing-article destination choices can be shown independently', async () => {
  for (const [route, page] of Object.entries(await pages())) {
    const join = page.nodes['import-join-options'];
    const guidance = page.nodes['import-new-article-help'];
    assert.ok(join && guidance, route + ' supports both import contexts');
    assert.ok(contains(join, 'import-preview') && contains(guidance, 'import-preview'), route + ' context choices belong to import review');
    assert.equal(contains(guidance, 'import-join-options'), false, route + ' new-article guidance survives hiding destination choices');
    assert.equal(Object.hasOwn(guidance.attrs, 'hidden'), true, route + ' waits for the controller to select new-article guidance');
    assert.equal(guidance.hasText, true, route + ' has an explanation for a new article');
    for (const id of ['import-destination', 'import-destination-help']) assert.ok(contains(page.nodes[id], 'import-join-options'), route + ': ' + id + ' follows the existing-article choice');
    assert.equal(page.labels['import-destination'], true, route + ' destination choice retains its label');
    assert.ok(page.nodes['import-destination'].attrs['aria-describedby'].split(/\s+/).includes('import-destination-help'), route + ' destination choice retains its explanation');
    assert.equal(contains(page.nodes['import-insertion-controls'], 'import-join-options'), false, route + ' insertion preparation is controlled independently');
  }
});
