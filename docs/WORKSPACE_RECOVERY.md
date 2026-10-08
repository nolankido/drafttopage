# Workspace recovery and reliability

This change builds on the private pilot merged in PR #2. It does not activate generation, change authentication or quota policy, publish articles, or change any Cloudflare/DNS settings. Existing owner activation steps in PILOT_SETUP.md still apply.

## Keep your work without server storage

Open **Save or restore your work**, then choose **Save workspace backup**. The JSON file contains the notes, selected profile, audience, purpose, edited article, and review questions. It can preserve incomplete writing before AI generation or publication approval. It contains no authentication fields and does not carry consent or review approval.

A backup is not a publication file. It is unencrypted and contains your source notes. Keep it private, confirm the download on your device, and never commit it to GitHub. The standard backup filename is excluded by .gitignore as an additional precaution. This exclusion is not a guarantee against deliberately adding or renaming a private file.

Use **Restore workspace backup (.json)** to read a file locally. The whole file is validated before any current writing is replaced. Unsupported versions, extra keys, invalid fields, oversized content, or malformed JSON are rejected. The file-size ceiling is 128 KiB. Restoring a backup does not send the writing anywhere or call the AI provider. You must confirm data use again before generating and review again before Markdown export.

There is still no autosave or automatic recovery after a tab closes. Backups must be downloaded explicitly. The browser's leave-page warning is not a substitute for saving, particularly on mobile.

## Reconnect without reloading

Use **Refresh connection** after activating the API credential or after signing back in using the new-tab link. This checks the existing session without replacing notes, article text, review questions, or profile choices. It never triggers generation. Local backup and export remain usable when the connection fails.

## Safer failure handling

The browser now bounds requests with timeouts, bounds response size, and checks response shape before replacing any editor fields. HTML error pages, unreadable JSON, expired sessions, and malformed drafts leave the existing writing untouched. Controls recover after failure. Requests are never automatically retried, since an interrupted generation may already have consumed an attempt or provider credit.

Timeouts are 75 seconds for a generation attempt and 15 seconds for connection/sign-out requests. They do not guarantee cancellation of work already started on the server. Existing server quota and provider timeout protections remain in place.

## Accessibility corrections

The website-profile selector now references its guidance with aria-describedby. Guidance changes use a polite, atomic live region. The notes field references both its help and character count. Generated-title focus occurs after the field is enabled, not while it is disabled. Clearing/restoring updates profile guidance correctly. The busy state is exposed programmatically.

The profile fix addresses the review finding on PR #2 at src/pages.js. Automated markup and DOM checks are not a substitute for manual screen-reader testing.

## Tests and evidence

Run `npm test`, `npm run check`, and `python scripts/browser-smoke.py` from the repository root. The browser script requires Python Playwright and Chromium; an optional CHROMIUM_EXECUTABLE can select a local Chromium binary. GitHub Actions installs Playwright 1.57.0 only for its separate browser-test job.

The local focused run passed 47 new tests covering backup validation, text round trips, publication separation, request methods, size limits, timeouts, malformed responses, and accessibility relationships. The existing backend tests are retained and run alongside these in GitHub Actions.

Chromium DOM fixtures passed at 1440x1000, 390x844, and 320x740 with no horizontal overflow or page errors. The script exercises editing, review gating, captured Markdown/JSON download contents, invalid/cancelled/local restore, hostile markup, reconnecting, and preserving existing work after failed requests. Desktop and mobile screenshots were inspected locally.

These are DOM fixtures with mocked fetch and captured download Blobs, not real hosted authentication, device filesystem saves, Cloudflare quota execution, or real Claude output. Deployment/build results are reported separately in the pull request. No paid AI calls, production secret changes, or production merge are part of this change.

Technical references:
- https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
- https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
- https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
- https://www.w3.org/TR/wai-aria/#aria-live
