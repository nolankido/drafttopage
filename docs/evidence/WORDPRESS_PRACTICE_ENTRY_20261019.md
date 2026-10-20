# Word-to-WordPress practice entry, October 19, 2026

## Purpose

Base main: `e5c42496563fb16ad82bb8758ba2d8f4791b2271`.

The Word-to-WordPress entry previously exposed an editor-only sample. The Word-to-Markdown page already exposed the app-generated `/samples/word-to-markdown.docx`. This change makes that existing file accessible from the WordPress entry and adds a collapsed, semantic practice guide beside it. The existing sample button, file input, staged import, export approval, copied-block generation and recovery behavior are untouched.

The guide asks the visitor to choose the downloaded file, review and apply it explicitly, approve export separately, use a new unpublished WordPress draft, save/close/reopen, and make and retain a deliberate edit. It supplies the actual sample title, H2, bold text, link, numbered items and final table rows. It explicitly says the generated document is not a current Word-app capture and does not exercise images, comments or revisions. No status is collected or certified by the guide.

## Scope and executed checks

GitHub cloning remained unavailable in this runtime (DNS resolution failure); connected Browser required its originating extension context. A direct public-page read also failed. No paid browser, external account, policy bypass, installation, API activation or WordPress post was used.

The changed HTML source and its new targeted Node test were reconstructed locally from the connector response. The source test file executed: **4 passed, 0 failed**. It checks semantic nesting and unique IDs with Python HTMLParser, the closed-by-default disclosure and keyboard-focusable table region, the download action and unchanged sample button, separate approvals, unpublished save/reopen instructions and explicit limits. These are source checks, not browser accessibility or visual acceptance.

Two additional build-time tests check the complete generated WordPress page and the existing generated Word ZIP using independent XML inspection. They verify the sample's exact title/body, H2 paragraph, bold run, hyperlink relationship, ordinary decimal numbering, single table and header row. They require the full build; they were not executed locally in the source subset. Their execution is reported separately by the candidate build.

There are no new public JavaScript modules, event handlers, dependencies, network services, analytics, forms or storage. Only the WordPress entry template changes at runtime. The existing downloadable sample bytes and generator are unchanged.

## Outstanding acceptance

Successful live navigation, 320/390px rendering, keyboard and screen-reader use in a real browser, document import, WordPress paste/save/reopen, current Word/Docs source captures and human trials remain NOT_RUN here. The practice guide removes first-use friction but does not substitute for any of those observations.

## Reproduce

```sh
node --test tests/wordpress-practice-source.test.js
npm run build
node --test tests/wordpress-practice-output.test.js
```
