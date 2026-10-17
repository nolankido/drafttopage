// TEMP validation only, never merge. Exact feature files plus this hook.
import { execFileSync } from 'node:child_process';
await import('./build-content.mjs');
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'inherit',timeout:120000});
run('python3',['-m','py_compile','scripts/wordpress_media_acceptance.py','scripts/wordpress_roundtrip.py']);
run('python3',['-c',"import sys;sys.path.insert(0,'scripts');from wordpress_media_acceptance import media_fixtures;f=media_fixtures('.');assert len(f['originals'])==2 and len(f['occurrences'])==3;print('Offline Word image source verified')"]);
run(process.execPath,['--test','tests/wordpress-roundtrip.test.js']);
run(process.execPath,['scripts/check.mjs']);
