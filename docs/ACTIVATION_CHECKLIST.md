# Owner activation and acceptance checklist

This checklist is for the existing `drafttopage` Cloudflare Worker and `nolankido/drafttopage`. No DNS, registrar, custom-domain, hosting-plan, or billing upgrade is needed by this content release. Do not remove the password gate or quota to work around setup failures.

## What this release does and does not activate

Public resources and the sample editor run without AI credentials. The sample editor uses prewritten fictional material, never a disguised model response. It is separate from the protected `/pilot` and does not grant access to the generation API.

A deployed page or configured secret is not proof that real generation works. Keep the live pilot owner-only until the acceptance test below passes. No production secrets were available during authoring, and no real provider call was performed.

## 1. Verify deployment

The Cloudflare dashboard should show a successful deployment of the reviewed release. Keep the existing Worker, production branch `main`, blank dashboard build command, and deploy command `npx wrangler deploy`. Wrangler now runs the repository's deterministic `node scripts/build-content.mjs` custom build before bundling assets. It requires no packages or network access. It does not alter runtime secrets.

Visit `/release.json`, `/demo/`, `/templates/`, and `/help/markdown-export/`. The release identifier is `content-pilot-20261008`. Confirm the private route fails closed rather than displaying the editor anonymously.

## 2. Configure runtime access privately

In Cloudflare Workers & Pages, choose **drafttopage > Settings > Variables and Secrets**. Labels may vary slightly. Add values as **Secret**, not plain-text variables and not build-only variables.

| Name | Value supplied privately by the owner |
| --- | --- |
| `PILOT_PASSWORD` | A new, unique password-manager-generated password, between 24 and 256 characters. |
| `ANTHROPIC_API_KEY` | A project-specific API credential from the owner's Anthropic workspace. |

Do not paste either value into chat, a public issue, a screenshot, the Git repository, or browser JavaScript. A Claude chat subscription is not itself an API credential. Review the provider workspace's data handling, access, credit, and spending controls. Set a small spending cap before testing. Do not approve an unexpected paid-plan upgrade.

Save and deploy the runtime secret changes. Confirm the existing `PILOT_QUOTA` Durable Object binding is present. The migration and quota class must remain intact.

If a secret is already configured, do not rotate or replace it casually. Changing the pilot password invalidates all current sessions. A missing or invalid password or missing binding can leave `/pilot` at HTTP 503; a missing API key can leave sign-in available but generation disabled. Inspect the actual account state rather than guessing which item is missing.

## 3. Run one real fictional-notes acceptance test

1. Open `https://drafttopage.com/pilot` in your normal browser and sign in using the private pilot password.
2. Select Personal essay and load the labeled fictional sample notes. Loading a sample alone should make no AI request.
3. Read and acknowledge the data-use checkbox. Select Prepare draft once. This is a real API request and can consume credits. No automatic retry is made.
4. Confirm the title, article, excerpt, page description, filename, and review questions arrive. A successful response must come from the provider, not a fallback fixture.
5. Change the title and one sentence. Approve the draft. Download the actual Markdown file onto your device and open it in a trusted text editor.
6. Confirm the edits are in the file, `draft: true` is present, and source notes and review questions are absent. Copy any questions separately. Do not assume the draft flag prevents publication in your destination.
7. Edit one field again and confirm that approval is cleared and exports are disabled until review is reconfirmed.
8. Sign out. Reopening `/pilot` should show sign-in, not the protected editor. Anonymous callers must not generate articles.
9. Check actual Anthropic usage and cost. Record pass/fail and non-sensitive observations privately. Do not put credentials, raw responses, or private writing into public evidence.

## 4. Invitation gate

Before inviting testers, verify the genuine provider result, real file download, hosted cookie and security-header behavior, quota behavior, and a manual destination preview. Agree a direct support route and explain the shared password, unsaved-work behavior, provider processing, and 20-attempt shared daily limit. Public registration and automatic publishing remain out of scope.

## Disable safely

To stop AI requests, revoke or remove `ANTHROPIC_API_KEY` and deploy the change. To invalidate sessions or close pilot access, rotate or remove `PILOT_PASSWORD`. Leave the Durable Object migration, binding, and class in place; use a reviewed forward fix rather than casually reverting across a migration. Public resources do not depend on the two secrets.

## Official implementation references

- Worker secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Wrangler custom builds: https://developers.cloudflare.com/workers/wrangler/custom-builds/
- Static-asset headers: https://developers.cloudflare.com/workers/static-assets/headers/

Checked October 8, 2026. See `PILOT_SETUP.md` for the original runtime setup and rollback details. The current content build is documented in `CONTENT_RELEASE.md`.
