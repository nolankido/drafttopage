# Manual validation, no GitHub Actions jobs

The owner explicitly stopped automatic GitHub Actions work on October 14, 2026.

The only configured workflow, `.github/workflows/pilot-checks.yml`, has been removed. It had push, pull-request, and manual-dispatch triggers, with two test jobs. No cron schedule was configured. Repository source inspection found no other Actions workflow or cron trigger. GitHub reported zero in-progress, queued, and waiting runs before removal, so there was no active run to cancel.

Do not add, re-enable, dispatch, or schedule Actions workflows. `AGENTS.md` records this rule; `npm run check` rejects YAML workflow files under `.github/workflows`. Old runs remain historical records. This change removes source-defined workflows; it does not claim an administrator-level change to the repository's Actions permission setting.

## Run checks manually

```sh
npm test
npm run check
python3 scripts/browser-smoke.py
```

The browser script needs manually installed Playwright and Chromium. It uses local routed fixtures and makes no provider request. Do not install or run it through GitHub Actions. A pinned Worker bundle check can be run manually with `WRANGLER_SEND_METRICS=false npx --yes wrangler@4.148.0 deploy --dry-run` when the tooling is available.

Use feature branches and pull requests. The removal commit and merge use `[skip ci]` to avoid the former push/pull-request triggers during the transition. Future product changes must be validated locally, documented, and reviewed without starting Actions runs.

The existing Cloudflare-native Git integration is separate from GitHub Actions and remains the site's publishing mechanism. No DNS, runtime secret, hosting plan, billing, or deployment-provider change is made here.
