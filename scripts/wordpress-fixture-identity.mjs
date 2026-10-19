// Release-only evidence policy. An observed synthetic input digest must match
// the bytes created from its named, allowlisted authored source fixture.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const allowedIds = ['authored-compound-docx-article', 'authored-compound-docs-style-html'];
let cached = null;
export function verifiedSyntheticSourceDigests() {
  if (!cached) {
    const python = process.env.DRAFTTOPAGE_BROWSER_PYTHON || 'python3';
    const output = execFileSync(python, ['-c', String.raw`
import json,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve()
sys.path.insert(0,str(root/'scripts'))
from wordpress_source_fixtures import SOURCES,load_wordpress_source_fixture
print(json.dumps({name:load_wordpress_source_fixture(root,name)['sha256'] for name in SOURCES},sort_keys=True))
`, root], { encoding: 'utf8', timeout: 30000, maxBuffer: 16384 });
    const values = JSON.parse(output);
    if (Object.keys(values).sort().join('|') !== [...allowedIds].sort().join('|') ||
        !Object.values(values).every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)))
      throw new Error('The allowlisted WordPress synthetic fixture identities could not be confirmed.');
    cached = Object.freeze(values);
  }
  return cached;
}
export function verifiedSyntheticSourceDigest(id) {
  if (!allowedIds.includes(id)) return null;
  return verifiedSyntheticSourceDigests()[id];
}
