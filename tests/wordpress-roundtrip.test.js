import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { verifyRelease, validateWordPressEvidence } from '../scripts/verify-release.mjs';
import { configuration } from '../scripts/wordpress-roundtrip-cases.mjs';

const digest = 'a'.repeat(64);
const complete = () => ({ result: 'PASS', scope: 'local WordPress save/reopen', playground: configuration.playground,
  sourceSha256: digest, sourceUnchanged: true,
  environment: { wordpress: configuration.wordpress, php: configuration.php + '.33', marker: 'drafttopage-local-acceptance',
    databaseClass: 'WP_SQLite_DB', pdoDrivers: ['sqlite'], unfilteredHTMLDisabled: true },
  user: { roles: ['author'], unfilteredHTML: false }, negativeControl: true, runtimeErrors: [], unexpectedRequests: [],
  cases: configuration.cases.map((item, index) => ({ id: item.id, result: 'PASS', postId: index + 1, status: 'draft',
    saveResponse: 200, savedSha256: digest, validAfterReopen: true,
    ...(item.strikes ? { strikethroughVerified: true } : {}),
    ...(item.formatSelection ? { toolbarVerified: true, source: 'native toolbar fixture' } : {}),
    ...(item.listPaths ? { listHierarchyVerified: true } : {}),
    ...(item.rawText ? { rawTextVerified: true } : {}),
    ...(item.editAfterReopen ? { editedAndReopened: true, editedSha256: digest } : {}),
    ...(item.inputMode ? { inputMode: item.inputMode } : {}), ...(item.file ? { source: 'native file fixture' } : {}) }))
});

test('WordPress acceptance requires the pinned environment, every saved/reopened draft, and a functioning invalid-block control', () => {
  assert.equal(validateWordPressEvidence(complete(), configuration, digest).cases, configuration.cases.length);
  const corruptions = [
    x => x.result = 'FAIL', x => x.scope = 'parser-only', x => x.environment.wordpress = 'different',
    x => x.sourceSha256 = 'b'.repeat(64), x => x.sourceUnchanged = false,
    x => x.user.roles = ['administrator'], x => x.user.unfilteredHTML = true,
    x => x.environment.unfilteredHTMLDisabled = false, x => x.environment.databaseClass = 'wpdb',
    x => x.negativeControl = false, x => x.cases.pop(), x => x.cases[1].id = x.cases[0].id,
    x => x.cases[0].status = 'publish', x => x.cases[0].validAfterReopen = false,
    x => x.cases[0].saveResponse = 500, x => x.cases[0].editedAndReopened = false,
    x => x.runtimeErrors.push('fixture failure'), x => x.unexpectedRequests.push('https://example.invalid/'),
    x => delete x.cases.find(item => item.source).source,
    x => delete x.cases.find(item => item.strikethroughVerified).strikethroughVerified,
    x => delete x.cases.find(item => item.rawTextVerified).rawTextVerified,
    x => delete x.cases.find(item => item.toolbarVerified).toolbarVerified,
    x => delete x.cases.find(item => item.toolbarVerified).source,
    x => delete x.cases.find(item => item.listHierarchyVerified).listHierarchyVerified
  ];
  for (const corrupt of corruptions) {
    const evidence = complete(); corrupt(evidence);
    assert.throws(() => validateWordPressEvidence(evidence, configuration, digest), /WordPress evidence/);
  }
});

test('The manual gate removes stale WordPress proof, records an explicit skip, and requires fresh proof when requested', () => {
  for (const requested of [false, true]) for (const fresh of [false, true]) {
    const root = mkdtempSync(join(tmpdir(), 'drafttopage-wordpress-gate-'));
    try {
      mkdirSync(join(root, 'tests/fixtures'), { recursive: true }); mkdirSync(join(root, 'test-results'));
      writeFileSync(join(root, 'package.json'), '{"name":"drafttopage"}'); writeFileSync(join(root, 'tests/fixture.test.js'), '');
      writeFileSync(join(root, 'tests/fixtures/wordpress-roundtrip.json'), JSON.stringify(configuration));
      const wordpressFile = join(root, 'test-results/wordpress-results.json');
      writeFileSync(wordpressFile, JSON.stringify(complete()));
      const calls = [];
      const result = verifyRelease({ root, env: requested ? { DRAFTTOPAGE_WORDPRESS_CLI: '/explicit/test/cli.js' } : {}, run: (command, args) => {
        calls.push(args);
        if (calls.length === 1) assert.equal(existsSync(wordpressFile), false);
        if (calls.length === 4) writeFileSync(join(root, 'test-results/browser-results.json'), JSON.stringify({ result: 'PASS', scope: 'full', checks: ['fixture'], errors: [], unexpected_requests: [], layout: { narrow: false } }));
        if (calls.length === 5 && fresh) writeFileSync(wordpressFile, JSON.stringify(complete()));
        return { status: 0 };
      } });
      assert.equal(result.result, requested && !fresh ? 'FAIL' : 'PASS');
      assert.equal(calls.length, requested ? 5 : 4);
      if (requested && fresh) assert.equal(result.wordpress.result, 'PASS');
      if (!requested) assert.equal(result.wordpress.result, 'NOT_RUN');
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('The saved-post verifier rejects changed content, links, table shape, images, leaked private fields, and publication', () => {
  const result = execFileSync('python3', ['-c', String.raw`
import copy,sys
from pathlib import Path
sys.path.insert(0,str(Path('scripts').resolve()))
from wordpress_roundtrip import check_post
case={'title':'Fictional title','text':'Alpha Beta','links':[{'text':'Beta','href':'https://example.test/'}]}
html='<p>Alpha <a href="https://example.test/">Beta</a></p>'
good={'status':'draft','title':{'raw':'Fictional title'},'content':{'raw':html,'rendered':html}}
assert check_post(good,case,['PRIVATE'])==html
bad=[]
v=copy.deepcopy(good);v['status']='publish';bad.append(v)
v=copy.deepcopy(good);v['title']['raw']='Changed title';bad.append(v)
v=copy.deepcopy(good);v['content']['rendered']='<p>Alpha</p>';bad.append(v)
v=copy.deepcopy(good);v['content']['rendered']=html.replace('example.test','wrong.test');bad.append(v)
v=copy.deepcopy(good);v['content']['raw']+='<!-- PRIVATE -->';bad.append(v)
v=copy.deepcopy(good);v['content']['rendered']+= '<img src="https://example.test/image.png">';bad.append(v)
for v in bad:
 try:check_post(v,case,['PRIVATE'])
 except AssertionError:pass
 else:raise AssertionError('Damaged saved post was accepted')
table_case={'title':'Fictional title','text':'Alpha Beta','rows':[['Alpha','Beta']]}
v=copy.deepcopy(good);v['content']['rendered']='<table><tr><td>Alpha</td></tr><tr><td>Beta</td></tr></table>'
try:check_post(v,table_case,[])
except AssertionError:pass
else:raise AssertionError('Changed table shape was accepted')
print('7 damaged saved-post cases rejected')
`], { encoding: 'utf8' });
  assert.equal(result.trim(), '7 damaged saved-post cases rejected');
});
