# Guided article link editing

Release: `guided-link-editor-20261014`.

## Product decision

Authors bringing Word, formatted writing, or Markdown drafts need to add sources and correct links before publishing. The existing formatter has no link tool; draft checks select raw Markdown. A guided link editor and article-wide link inventory remove that syntax requirement from a common finishing task. This is a usability hypothesis. Demand, retention, acquisition lift, and willingness to pay remain unmeasured.

## Implemented behavior

- All five public workspaces include Add or edit link. Choose selected plain text or a cursor. A cursor inside an existing recognized inline link selects its exact complete source range. Draft-check link buttons open the editor, with direct source selection as a fallback.
- Enter descriptive single-line link text, at most 300 characters, and an absolute HTTP(S) URL, at most 2,048. Oversized bulk pastes are rejected in full. URL entry uses a textarea to avoid browser single-line-input sanitization joining a multiline URL. Credentials, whitespace, unsupported schemes, quoted titles, malformed parentheses, and body overflow reject without repair or mutation. Authored URL spelling is retained in Markdown; existing export URL normalization is unchanged.
- Preview the exact old/new source before applying. Literal label punctuation is escaped and round-trips through the existing parser. Preview removing link keeps the original label and ignores pending label/URL changes. Removal also rejects surrounding nested syntax that would create a different link. Every source character outside the selected range remains exact, including CRLF and Unicode. Invalid or split UTF-16/CRLF selections, partial emphasis/code/image tokens, code, source HTML, structural markers, and table contexts are left for direct source editing.
- Article links lists the first forty recognized inline references with raw URL, label, supported/literal status, table context, and descriptive-label reminders. The list uses text nodes with edit buttons, never navigation anchors. Download link review notes includes all recognized references from the current article. Plain URLs, reference links, images, code, and full nested Markdown interpretation are outside this inspection. No destination is visited, fetched, verified, or opened automatically.
- Apply captures a valid in-tab checkpoint before mutation, then clears approval and the WordPress linked-image option. Exact no-ops keep approval and avoid checkpoints. Preparing, viewing, and discarding do not change writing or approval. File reads block actions. Failed checkpoint capture keeps writing and preparation.
- Exact body changes invalidate pending targets and purge previews; no repeated or missing passage is guessed. Closing the editor purges its preview and hidden inventory, retaining pending fields. Full writing replacement clears preparation. Unsaved fields contribute to exit/replacement guards and are excluded from existing v1 backup, checkpoint, collection, profile, and article export formats. Applying uses ordinary article Markdown without schema changes.
- No new account, dependency, service, tracking, persistence, AI call, destination request, workflow, or scheduled job. Native Cloudflare deployment integration is preserved.

## Validation

422 Node tests passed, including independent Python HTML parsing of exported link attributes and literal labels, Word hyperlink relationships, source-range preservation, removal, stale targets, overflow, busy actions, no-op/discard behavior, checkpoint failure, inventory bounds, and unchanged private formats. The new automated browser scenarios compile but require an installed Chromium executable to run.

Static and live desktop results are recorded in the pull request after validation/deployment. Actual WordPress editor import, mobile operation, and screen-reader checks remain unrun. GitHub Actions remain stopped.
