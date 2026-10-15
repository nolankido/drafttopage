# Guided article image editor

Release: `guided-image-editor-20261014`.

## Product decision

The Word-to-WordPress entry flow converts embedded images into visible text placeholders. Finishing an article previously required writing image Markdown by hand. The next improvement removes that editing barrier: all five public writing workspaces offer a guided image editor with an existing HTTPS URL, alternative text, an explicit decorative choice, and an exact replacement preview. This is a usability hypothesis; acquisition, retention, and willingness to pay remain unmeasured.

## Implemented behavior

- Choose an omitted Word image by line number, use the exact article selection, or place a new image at the article end. The WordPress reference list opens the same editor, with direct source editing as a fallback.
- Insert standalone image Markdown, adding paragraph separators and preserving every character outside the selected range. Inline Word placeholders can be replaced while keeping surrounding prose. The user sees both the selected text and replacement before applying.
- Restrict replacements to ordinary paragraph positions, complete inline formatting tokens, and blank lines. Reject unsupported structural positions, split UTF-16 surrogate pairs/CRLF, unsafe URLs, unbalanced parentheses, and total body overflow. No URL is repaired. Alternative text escapes Markdown punctuation, including square brackets supported by the shared inline parser.
- Limit URLs to 2,048 characters, alternative text to 500 on one line, and the final article to 60,000. Bulk pastes over field limits are rejected in full. URL entry is a textarea so browser single-line input sanitization cannot join an invalid multiline address into a valid URL.
- Exact article changes invalidate the pending target and clear its preview. A new location must be selected explicitly; repeated or missing text is never searched to guess a replacement.
- Apply captures previous valid writing before mutation, then clears export approval and the linked-image option. Checkpoint failure preserves the article and preparation. An exact no-op preserves approval and avoids checkpoints. File reads block editing actions.
- Preparing, viewing, and discarding do not change writing or approval. Closing the panel clears its preview and keeps fields. Unsaved preparation contributes to exit/replacement guards, is excluded from all file formats, and is cleared by full article/workspace replacement. Applied Markdown uses existing v1 article fields.
- No image fetch, rendering, upload, binary extraction, server call, browser persistence, account, tracking, or new dependency. Other exports retain literal image syntax. WordPress linked Image blocks require a separate explicit choice after applying. No Media Library upload, availability check, permission check, caption, dimensions, or featured image is invented.

## Validation

Local Node tests: 402 passed. Static validation: 26 HTML pages plus script syntax, assets, anchors, accessible references, local imports, routing/storage/logging guards, and absence of GitHub Actions workflows passed. Python browser script syntax passed.

The automated Playwright suite has new guided-editor and optional-module fallback scenarios but could not run because the Chromium executable is absent in this environment. Production desktop QA and downloaded block verification are recorded in the pull request after deployment. Real WordPress editor import, mobile browser operation, and screen-reader testing remain unrun.

GitHub Actions remain stopped. Deployment uses the existing native Cloudflare Workers GitHub App integration.
