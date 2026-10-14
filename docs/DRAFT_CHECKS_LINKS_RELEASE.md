# Local draft review and reading links

Release marker: `draft-checks-links-20261014`.

## User-facing change

The public writing desk now helps an author find the next edit. Check draft opens a local review panel with an up-to-date section outline, approximate word/reading-time estimates, and optional editorial findings. Each outline entry or finding selects its exact source passage. Article edits clear previous findings so old positions cannot select unrelated text.

Checks flag possible placeholders, repeated prose of at least eight words, empty headings/sections, skipped heading levels, duplicate title headings, paragraphs over 120 approximate words, unclosed code fences, unsupported inline link/image handoffs, and generic link labels. They do not rewrite, approve, or block export. Code is excluded from prose checks. Results are capped at forty with a visible total and truncation notice. They remain temporary and are excluded from the existing version-1 workspace backup.

Simple inline Markdown links to absolute HTTP(S) URLs without credentials work in both the DOM preview and standalone HTML export. Both use the same bounded parser and URL validator. Links open a new tab only after deliberate selection and use `noopener noreferrer`. Images, source HTML, unsupported URLs, relative addresses, fragments, and reference links remain inert text. HTML export keeps one title heading and preserves levels for article subsections. Page Markdown continues to preserve authored content for its destination renderer.

The public site adds `/help/draft-checks/` and updates first-use, export, workspace, import, and data-use guidance. There are sixteen indexable pages plus the existing 404. Existing article URLs, fictional samples, selected-file imports, review notes, templates, body-only exports, and private backups remain supported.

## Verification

- `npm test`: includes pure parser/review tests for hostile URLs/labels, bound enforcement, CRLF/Unicode selection positions, code exclusions, repetition, missing sections, and reading-export behavior.
- `npm run check`: checks syntax, relative assets/anchors, accessible references, safe browser imports, protected routes, and storage/logging guards.
- `python scripts/browser-smoke.py`: actual local ES-module loading under CSP, full existing workflow regressions, exact outline/finding selection, unchanged advisory approval, stale-result clearing, summary-copy exclusions, forty-item limits, real HTML-download bytes, safe rendered links, unchanged version-1 backup shape, and narrow layouts at 1440, 390, and 320 pixels. All responses are routed fixtures.
- GitHub CI also bundles the existing Worker using a pinned Wrangler dry-run before publication.

Browser fixtures are not real Cloudflare authentication, Durable Object execution, live URL availability checks, or genuine provider testing. Source completion, CI, production deployment, and direct live interaction are reported separately.

## Product limits

The Markdown renderer is deliberately limited. Nested markup, tables, reference links, and other syntax may be missed or stay as text. Word counts and the 200-words-per-minute estimate are approximate and less informative for some languages. Intentional repetitions and ordinary words may be flagged. An empty finding list is not certification of facts, grammar, sources, permissions, or safety. An HTTP(S) link is a navigable address, not proof that its destination is trustworthy or available.

No provider activation, credentials, DNS, hosting plans, billing, tracking, autosave, browser persistent storage, account history, automatic publishing, paid calls, or external dependencies were added. Check results and outline state are excluded from backups and article exports. Explicit summary copying excludes source notes and private review notes. The owner activation checklist remains the next step for genuine AI-pilot readiness.
