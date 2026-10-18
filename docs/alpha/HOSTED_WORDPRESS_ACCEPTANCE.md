# Hosted WordPress destination acceptance | Alpha Turn 6

Status: **NOT_RUN until a real hosted destination and an authorized editor are used**. The existing local WordPress Playground runner and its pinned 7.1.3 receipt do not verify other hosted editors, plugins or roles. This procedure is performed on a disposable, unpublished draft. No real account, WordPress post, or target device was accessed in preparing this protocol.

## Preconditions

Use an owner- or tester-controlled WordPress installation with permission to create a **draft**. Do not make test posts public. Record the installed WordPress version, actual editor role, browser family/version, and any plugins or themes affecting Gutenberg. Do not record login details, domain names, site URLs, access tokens, user identities, unpublished article text, private review notes, clipboard contents or screenshots in this public repository.

Use a fictional or explicitly approved article with a separate title, optional excerpt/slug/SEO description, a heading, styled text, nested numbered list with non-one start, at least one HTTPS link, a table with headings, and a unique final paragraph. If the case includes linked or imported Word images, use the existing Word image ZIP/map and deliberately review each placement and alt text. If the environment lacks a feature, record the incompatibility instead of quietly marking it as passed.

## Observe each boundary separately

1. **Local reviewed export**: identify the release Git commit and whether you used Copy WordPress blocks or downloaded full block source. Export approval alone is not evidence of clipboard success.
2. **Clipboard or file preparation**: record whether you used the Copy button (`source_transport: copy-button`) or downloaded a block-source file (`source_transport: downloaded-block-file`). For downloads, separately record both the download request and that the actual file was saved and could be opened. A successful request is not evidence of a saved file or a WordPress paste.
3. **Actual paste**: in a new unpublished WordPress draft, set the title separately and paste into an empty Visual paragraph. If literal code or a clipboard error occurs, undo and try the documented Code editor fallback. Log which route actually succeeded.
4. **Editor content**: inspect native editable block types, no unexpected-content or recovery warning, heading hierarchy, non-one numbered starts and child lists, link targets, header tables, images and alt text, optional fields, private-note exclusion, and the complete source ending. Do not infer saved content from preview alone.
5. **First save**: explicitly save the post as a draft and inspect the destination's save result.
6. **Reopen**: close/leave WordPress editing and reopen the same draft. Inspect its blocks, text and ending. This is not satisfied by switching Visual/Code tabs.
7. **Second edit and save**: edit a small word, save again, leave/reopen, and check that both the edit and last paragraph remain.

Use `docs/alpha/hosted-wordpress-record-template.json` as a blank starting point. Put completed records under ignored `test-results/` or private storage, not Git. `node scripts/validate-hosted-wordpress-evidence.mjs PATH_TO_PRIVATE_RECORD.json` classifies complete observations as `OBSERVED_MANUAL_PASS`; it is **not** a server attestation and does not create or inspect WordPress content. Missing fields are `INCOMPLETE`; failures are `OBSERVED_FAIL`; the untouched template is `NOT_RUN`.

A valid local Playground result cannot turn hosted WordPress `NOT_RUN` into a hosted PASS. Keep the two evidence tracks separate. An actual supported hosted configuration, including a plugin-specific failure and successful fallback if needed, is required before broad alpha claims.
