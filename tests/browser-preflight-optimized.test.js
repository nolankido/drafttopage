import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Mock page objects test invariant enforcement, not real browser acceptance.
test('Navigation invariants remain enforced with Python optimization enabled', () => {
  const source = fileURLToPath(new URL('../scripts/browser-preflight.py', import.meta.url));
  const output = execFileSync('python3', ['-O', '-c', String.raw`
import json,runpy,sys
from types import SimpleNamespace
m=runpy.run_path(sys.argv[1],run_name='optimized_probe_unit')
origin=m['ORIGIN']
class Route:
 def __init__(self,url):self.request=SimpleNamespace(url=url,method='GET')
 def fulfill(self,**kwargs):pass
 def abort(self):pass
 def continue_(self):pass
class Context:
 def __init__(self,secure,paths):self.secure=secure;self.paths=paths;self.closed=False
 def route(self,pattern,handler):self.handler=handler
 def new_page(self):return self
 def set_default_timeout(self,value):pass
 def goto(self,url,**kwargs):
  for path in self.paths:self.handler(Route(origin+path))
 def wait_for_function(self,*args,**kwargs):pass
 def evaluate(self,*args):return self.secure
 def close(self):self.closed=True
class Browser:
 def __init__(self,context):self.context=context
 def new_context(self,**kwargs):return self.context
cases=[
 ('valid',True,[m['PAGE_PATH'],m['MODULE_PATH']],True),
 ('insecure',False,[m['PAGE_PATH'],m['MODULE_PATH']],False),
 ('missing-module',True,[m['PAGE_PATH']],False),
 ('unexpected-request',True,[m['PAGE_PATH'],m['MODULE_PATH'],'/not-allowed'],False),
 ('duplicate-request',True,[m['PAGE_PATH'],m['MODULE_PATH'],m['MODULE_PATH']],False),
]
results=[]
for name,secure,paths,expected in cases:
 context=Context(secure,paths)
 try:
  observed=m['navigate'](Browser(context),origin)
  accepted=observed['result']=='PASS'
 except RuntimeError:
  accepted=False
 if accepted is not expected:raise RuntimeError('Invariant incorrectly evaluated: '+name)
 if not context.closed:raise RuntimeError('Context was not closed: '+name)
 results.append({'case':name,'accepted':accepted})
print(json.dumps({'optimized':not __debug__,'cases':results,'browserStarted':False}))
`, source], { encoding: 'utf8', timeout: 10000, maxBuffer: 16384 });
  const result = JSON.parse(output);
  assert.equal(result.optimized, true);
  assert.equal(result.browserStarted, false);
  assert.equal(result.cases.length, 5);
  assert.deepEqual(result.cases.map(item => item.accepted), [true, false, false, false, false]);
});
