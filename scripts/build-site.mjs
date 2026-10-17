// TEMP full offline regression validation only. NEVER MERGE this build hook.
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
await import('./build-content.mjs');
const run=(cmd,args,timeout=210000)=>execFileSync(cmd,args,{stdio:'inherit',timeout});
run('python3',['-m','py_compile','scripts/wordpress_media_acceptance.py','scripts/wordpress_roundtrip.py']);
run('python3',['-c',"import sys;sys.path.insert(0,'scripts');from wordpress_media_acceptance import media_fixtures;f=media_fixtures('.');assert len(f['originals'])==2 and len(f['occurrences'])==3;print('Word media fixture generated and inspected')"]);
const tests=readdirSync('tests').filter(name=>name.endsWith('.test.js')).sort().map(name=>'tests/'+name);
console.log('Running full offline Node suite with '+tests.length+' files');
run(process.execPath,['--test',...tests]);
run(process.execPath,['scripts/check.mjs'],60000);
