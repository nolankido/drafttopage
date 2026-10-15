# Markdown to HTML tool and reviewed source handoff

Release: `html-source-tool-20261014`.

## Product reason

Writers who do not use the WordPress block editor need a direct, understandable HTML handoff. Formatted clipboard copying and a styled reading document serve different purposes, but neither exposed a clearly labeled article fragment for an HTML source field. A dedicated free `/markdown-to-html/` page provides another useful entry point using the working editor. It is a product hypothesis, not evidence of increased traffic or conversion.

## Implemented

The HTML route reuses the full workspace, opens its reading preview, and selects HTML source for a website by default. The same destination is available from the general and WordPress workspaces. It preserves imports, checkpoints, search, review, backup, and other exports. HTML remains the default on this route after sample loading, import, restore, and clear.

After review, users can copy plain-text HTML code, inspect/manual-copy current source, or download an article fragment. Only a body is required by default. Including the title as an H1 is explicit and requires a valid title; body H1 headings become H2. Optional metadata and private source/review fields stay out. Edits, title choices, destination changes, file operations, and reset remove stale or hidden output. Opening/closing the manual source panel is read-only.

The fragment has no document wrapper, metadata, scripts, external assets, or WordPress block comments. It uses the same bounded limited Markdown parser as other handoffs. Portable rendering adds explicit paragraph/quote line breaks, static code wrapping, scoped table headers, fixed validated alignment styles, and a keyboard-accessible table overflow region. Existing formatted-copy, reading-page, and WordPress outputs are unchanged. Source HTML, images, unsafe/relative links, malformed tables/lists, and unsupported syntax remain inert text. Destination styles and sanitization vary; actual destination inspection is still required.

The entry page has a unique title/description, self-canonical URL, a generated and escaped conversion example, task-specific instructions and FAQs, homepage/navigation/help links, and a sitemap entry. There are now 19 indexable public pages and 20 generated HTML files including the 404.

No account, API credit, tracking, persistent storage, new service, provider call, publishing integration, or production dependency is added. No GitHub Actions workflows or jobs are enabled. Native Cloudflare Git deployment remains the publishing path.

## Verification

Source checks and actual deployment/browser/download evidence are recorded in the pull request. The automated browser fixture must not be claimed as executed when the local Chromium runtime is unavailable. Real-mobile and screen-reader verification remain outstanding.
