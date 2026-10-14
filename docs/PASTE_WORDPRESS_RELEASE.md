# Paste-first article preparation

## Result

The homepage leads with an immediate task: paste a draft, review it, and take editable blocks into WordPress. A clearly fictional sample opens in the same public workspace and uses the same approval-gated exports. Source notes, import, and other editing tools remain available under More tools. The article is first on narrow layouts and starts in focus mode.

WordPress handoff copies or downloads block-editor source for paragraphs, H2 through H6 headings, flat lists with list-item children, quotes with paragraph children, fenced code, simple inline emphasis/code, and safe absolute HTTP(S) links. Body H1 becomes H2 and numbered lists start at 1. Title is copied separately. Page metadata, source notes, and private review questions are excluded. Images and complex Markdown remain literal text with explicit destination-review instructions.

Approval is cleared after edits and destination changes. Temporary source preview is populated only while approved and open, and cleared when hidden, edited, restored, or reset. Loading a sample confirms article replacement and checkpoints existing writing; source and review notes are retained. Existing backups stay version 1 and exclude export preferences. No new accounts, storage, tracking, credentials, provider calls, or paid services were introduced.

## Validation

- 195 Node tests pass, including WordPress body bounds, private-field exclusion, hostile comments/HTML/URLs, supported formatting, approval reset, temporary preview clearing, and clipboard fallback.
- Static checks pass for 22 HTML pages, links/anchors, accessible references, browser imports, syntax, protected routing, storage/logging restrictions, and absent GitHub Actions workflows. Browser regression fixture compiles; whitespace checks pass.
- The generated sample plus H3, fenced code, inline code, emphasis, and query-string links was entered into the official https://wordpress.org/gutenberg/ Code editor, then opened in Visual editor. Paragraphs, headings, both lists with all six items, nested quote paragraph, literal code text, and protected links were editable. No invalid-block message was shown. This tests the official demo, not every WordPress version, theme, or plugin.
- The browser regression fixture now covers sample loading, WordPress file download, stale-output clearing, replacement cancellation, destination switching, and 1440/390/320 layouts. The local suite was not executed because Chromium is unavailable. Mobile changes were reviewed in source; live desktop validation is recorded in the release PR after deployment.

## Operations and follow-up

Publish through a feature branch and PR with the native Cloudflare Git deployment. No GitHub Actions workflow or scheduled Actions job is added or enabled. Acquisition impact remains unmeasured. The next product validation is to observe independent publishers complete their own article and return for another one, before investing in accounts or monetization.
