# Private pilot activation

This guide applies to the existing `drafttopage` Cloudflare Worker and `nolankido/drafttopage`. Leave Squarespace, nameservers, DNS, custom-domain attachments, and the successful hosting integration unchanged.

## 1. Review and deploy the code

Review the pilot pull request and its checks, then merge it into `main` when approved. The established Cloudflare Git integration should deploy it. Confirm a successful deployment in Cloudflare rather than assuming a GitHub merge means success.

Keep the Worker name `drafttopage`, production branch `main`, repository root, no build command, and deploy command `npx wrangler deploy`. This is a Workers application, not Pages. Wrangler bundles the JavaScript entrypoint and static assets. The configuration adds a SQLite-backed Durable Object named `PilotQuota`, binding `PILOT_QUOTA`, using migration `pilot-quota-v1`. It stores two rolling counter records, not private writing.

If a migration, binding, or plan error occurs, stop and inspect the deployment log. Do not remove the quota from the code to work around an error. Do not approve an unexpected paid-plan upgrade. No remote Cloudflare deployment was executed during implementation.

Before activation, the public landing page should work and `/pilot` should show that the pilot is not activated. An unavailable private pilot at this stage is intentional, not an error in the public site.

## 2. Add the pilot password

Open Cloudflare **Compute > Workers & Pages > drafttopage > Settings > Variables and Secrets**. Dashboard labels can differ slightly. Use runtime Worker secrets, not GitHub secrets or build-only environment variables.

Add:

| Field | Value |
| --- | --- |
| Type | Secret |
| Variable name | `PILOT_PASSWORD` |
| Value | A new, unique password from your password manager, at least 24 and at most 256 characters |

Save/deploy the change. Never use the known local test password, your GitHub password, or your API key as this password. Do not send the value in chat or commit it. The public repository contains no production password.

`https://drafttopage.com/pilot` should now show sign-in. After entering the password, the editor should open and explain that generation needs an API credential. The UI and API remain inaccessible without a valid sign-in cookie.

## 3. Prepare Anthropic and add the API key

Use the owner's real Anthropic Console account and an appropriate project-specific workspace. Check workspace eligibility, available API credit, billing, and data-processing settings. Set a small workspace spending cap before generating. Do not assume a Claude chat subscription by itself provides an API key or unlimited API use.

Create an API key for this project. Return to the same Cloudflare **Variables and Secrets** area and add:

| Field | Value |
| --- | --- |
| Type | Secret |
| Variable name | `ANTHROPIC_API_KEY` |
| Value | The project-specific Claude API key |

Save/deploy. This activates real generation when a valid password and usage quota are also present. AI generation may consume API credits or money. Do not put this key into the public page, browser JavaScript, repository variables, build logs, screenshots, or chat.

## 4. Run one real owner-only acceptance test

Use the canonical address `https://drafttopage.com/pilot`. Sign in, select a profile, and load the clearly labeled fictional sample. This button fills text locally; it does not call the model.

Confirm the data-use checkbox and select **Prepare draft** once. Wait up to a minute. Check the title, article, summary, page description, filename, and review questions. These should be a genuine API response, not the local mock fixture. The application has no production fallback that substitutes a fake article.

Edit the title and one sentence. Check the review-confirmation box. Download Markdown and verify that the edited text appears, `draft: true` is present, and source notes are absent. Changing the draft again should clear the approval box. Review the exported Markdown in a safe editor before any website import.

Then test sign-out. Reopening `/pilot` should require the password. An anonymous POST to `/api/pilot/generate` must not generate an article. Check the provider's actual usage to confirm the request and cost. No real end-to-end provider test has been performed by the implementation author because no credentials were supplied.

## Limits and troubleshooting

The whole pilot shares 20 generation attempts per UTC day with a 30-second minimum interval. Failed or timed-out attempts also count because upstream processing may already have occurred. Signing out, changing browser, or creating a new session does not reset those limits. Only two fixed rolling records persist; writing is not stored. A time-window reset replaces the prior counter values.

- **Pilot not activated:** check that the password is a runtime secret with at least 24 characters and the quota binding exists.
- **Generation not activated:** check the exact name and runtime placement of `ANTHROPIC_API_KEY`, then save/deploy and refresh.
- **AI credentials or billing error:** check the Anthropic workspace, key, credit, and model access. Do not paste the error's sensitive provider details into a public issue.
- **Daily or pacing limit:** wait until the stated window resets. Do not bypass the limit by renaming the Durable Object or changing its namespace.
- **Malformed output or refusal:** no automatic retry is performed. Retain the notes and deliberately decide whether to try a shorter or revised request later. AI output is not guaranteed to be factually correct.
- **Session expired:** keep the editing tab open, sign in again in a separate tab, then return and retry. There is no autosaved history.

## Disable and rollback

To stop AI spending immediately, remove or revoke `ANTHROPIC_API_KEY` and deploy the change. To invalidate all sign-ins, replace or remove `PILOT_PASSWORD`. Removing the password closes the entire private pilot. The public landing page does not depend on either secret.

Durable Object migrations have deployment/rollback constraints. Do not delete the migration, binding, or class from an already deployed version as a casual rollback. Prefer disabling the two secrets, then deploy a reviewed forward fix. Review Cloudflare's migration and rollback documentation before reverting across the first Durable Object migration.

## Before external testers

Keep this owner-only until the genuine acceptance test succeeds. Confirm the data-use notice, a direct owner contact route, the actual provider settings, and the use of a shared password are acceptable to each invited tester. This is not an audited multi-tenant product. It is not suitable for confidential or regulated data, public registration, or automatic publication.

## Official references checked during implementation

- Worker-first routing and static assets: https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- Worker secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Durable Object SQLite migrations: https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
- Durable Objects pricing and free-plan availability: https://developers.cloudflare.com/durable-objects/platform/pricing/
- Claude Messages API: https://platform.claude.com/docs/en/api/messages/create
- Structured JSON output: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
