// Compose the existing content build with the local-writing feature. All work is local.
import './build-content.mjs';
import { extendSite } from './extend-site.mjs';
await extendSite();
