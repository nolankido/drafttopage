# Draft to Page

Your ideas. Ready for your website.

Draft to Page is an early-stage publishing-assistant project for independent website owners. The planned workflow turns owner-supplied notes into editable articles for human review and export.

## Current scope

This repository contains a static product-preview website, not a functioning drafting application. Its example is fictional and clearly labeled. It has no AI calls, accounts, payments, sign-up form, analytics scripts, external fonts, or runtime JavaScript. Do not describe it as a launched service.

- Domain: `drafttopage.com`
- Repository: `nolankido/drafttopage`
- Intended host: Cloudflare Workers with static assets
- Production branch: `main`, after review and hosting configuration

## Cloudflare Workers setup

Merge the starter pull request before deploying `main`. Connect this repository to the existing Worker, or create a Worker only if one does not already exist.

| Setting | Value |
| --- | --- |
| Worker name | `drafttopage` |
| Repository | `nolankido/drafttopage` |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | Leave blank |
| Deploy command | `npx wrangler deploy` |
| Static assets directory | `./public`, set in `wrangler.jsonc` |

No framework build or application secrets are needed. If the existing Worker has another name, reconcile its name with `wrangler.jsonc` before deploying. Do not create a duplicate application or replace an unrelated Worker.

Verify the temporary Workers URL first. Then use the Worker's Settings > Domains & Routes > Add > Custom Domain for `drafttopage.com` and `www.drafttopage.com`, only if not already attached. Confirm the Cloudflare zone is Active. Do not remove unrelated DNS or email records. Domain registration remains at the existing registrar. Do not enable GitHub Pages.

If hosting was configured as Cloudflare Pages rather than Workers, do not use the Workers deployment command in Pages. Review that existing setup before changing platforms; the plain files in `public/` can be deployed as static assets.

Official references:
- https://developers.cloudflare.com/workers/static-assets/get-started/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

## Local preview

From the repository root, a basic static preview is available with `python -m http.server 8000 --directory public`. Open `http://localhost:8000`. This does not emulate Cloudflare routing or response headers. To test those, use `npx wrangler dev` in an environment with Node.js and network access.

## Change process

Use a focused feature branch and pull request. Review before merging into `main`. Once the Cloudflare Git integration is working, merging to the production branch should trigger deployment; check the deployment result and the live page before calling a change live.

Keep secrets, unpublished notes, customer information, and unrelated project files out of this public repository. Keep private drafts and future API credentials server-side. Authentication, usage limits, a verified contact address, privacy disclosures, and a drafting backend are separate future work.
