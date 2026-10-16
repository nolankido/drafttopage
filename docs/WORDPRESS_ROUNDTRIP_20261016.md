# Local WordPress save-and-reopen acceptance

This cycle follows the document benchmark in PR #71. It runs the exported source through an actual WordPress installation, saves unpublished drafts using the editor's Save control and real REST/database requests, closes the editor page, and opens each saved post in a fresh page. It adds save/reopen guidance to the workspace, converter guides, help, and downloaded WordPress kit.

## Tested environment and scope

The pinned environment is WordPress 7.1.3, Playground CLI 3.1.58, PHP 8.3, and the Playground SQLite integration. The initial run observed PHP 8.3.33 and `WP_SQLite_DB`. The browser is Chromium 153. The test account has the Author role, without the unfiltered HTML capability, and `DISALLOW_UNFILTERED_HTML` is enabled. Version, database class, role, and filtering configuration are checked, not inferred from a requested version string alone.

The runner creates a temporary fixture site on loopback, verifies its marker, and stops it on success or failure. It does not accept an arbitrary WordPress URL, use a connected public account, or publish a test article. There are no account credentials in the repository. The Blueprint changes only this temporary site's options, fixture-user role, disabled background jobs/networking, and a metadata file used to identify the environment. It does not replace WordPress's editor, post endpoints, validation, or content filtering.

WordPress core, its bundled block editor, and its REST save/read responses are real. The full-post Code editor textarea is exercised for one article. Other cases use WordPress's official block parser and editor store to load source, then the actual Save control. All cases close and reopen the post. One case then types into an editable paragraph, saves again, and reopens again. A Word footnote file also travels through Draft to Page's native file input, staged review/apply, and actual downloaded blocks before entering WordPress.

| Case | Checked through save/reopen |
| --- | --- |
| Paragraphs, headings, nested emphasis, and a link | Separate title, full-post Code editor input, exact rendered text/link target, native editing after reopen, second save/reopen |
| Nested ordered lists | Native List/List Item blocks, four list items, starting values 4 and 7, exact text |
| Aligned table and header-only table | Native Table blocks, exact rendered rows/cells/text, continued block validity |
| Quote, code, and separator | Native blocks, literal script text stays inert, exact rendered text |
| Unicode and literal source HTML | Café, Japanese text, emoji, literal punctuation/source retained; no source execution |
| Linked image enabled | Native Image block, exact URL and alternative text, expected image count |
| Linked image disabled | Image syntax remains literal article text; no Image block is invented |
| Word footnote handoff | Native Word import/review/download, note labels and both note sections retained in saved editable blocks |

For every case, the actual save response must be HTTP 200 with `draft` status. Saved and reopened source must agree. Independent HTML reading checks server-rendered article text and selected rows/links/image counts. All nested blocks must remain valid, the title must stay separate, and private source/review markers must be absent. A deliberately invalid Heading block must be rejected by WordPress's own parser as a negative control.

The image case uses a fictional HTTPS URL answered with local placeholder artwork. WordPress's nonessential welcome artwork is also answered locally. These are recorded fixture assets; all other off-origin browser requests fail. No REST or database response is mocked. PHP networking is disabled after boot. Initial tool setup and WordPress/SQLite boot artifacts can require downloads, so this command is not an entirely offline first installation.

## Reproduce deliberately

Use a trusted external test-tool installation. Playground 3.1.58 declares Node 24.18 or newer and npm 11.16 or newer. Keep these tools out of production dependencies:

```sh
npm install --prefix /absolute/test-tools --ignore-scripts --no-audit --no-fund @wp-playground/cli@3.1.58
npm run build
DRAFTTOPAGE_WORDPRESS_CLI=/absolute/test-tools/node_modules/@wp-playground/cli/cli.js CHROMIUM_EXECUTABLE=/absolute/chromium /absolute/python-with-playwright scripts/wordpress_roundtrip.py
```

With Playwright available to `python3`, `npm run verify:wordpress` runs the same test. The script does not install tools automatically. It boots a fresh temporary site and writes ignored `test-results/wordpress-results.json`, `wordpress-server.log`, and `wordpress-blueprint.json`.

To bind WordPress acceptance to all other release checks, run:

```sh
DRAFTTOPAGE_WORDPRESS_CLI=/absolute/test-tools/node_modules/@wp-playground/cli/cli.js DRAFTTOPAGE_BROWSER_PYTHON=/absolute/python-with-playwright CHROMIUM_EXECUTABLE=/absolute/chromium npm run verify:release
```

The gate removes old WordPress proof before running. When the CLI path is supplied, missing or partial proof, a different environment/source snapshot, skipped edits/reopens, a failed negative control, runtime errors, unexpected requests, or any published/invalid case fail the release. Without the CLI path, the normal release report explicitly records WordPress as `NOT_RUN`; its passing result does not establish save/reopen acceptance. Neither mode starts GitHub Actions or changes production hosting.

The standalone report also binds its result to a source digest and fails if source changes during the run. The release runner independently requires the same digest. Timestamps, source identities, initial saved-source hashes, and the edited case's final hash remain in the ignored report. Three Node regression tests cover incomplete/corrupted acceptance evidence, stale-proof removal/explicit skips, and damaged saved-post text, links, table shape, images, private fields, and publication status.

## Limits and next decisions

This establishes the eight stated local WordPress contracts for one pinned configuration. It is not acceptance for every hosted WordPress service, plugin, theme, role, browser, or mobile device. The test compares WordPress-rendered article content, not every theme's visual layout. It does not establish live image availability, Media Library uploading, SEO-plugin fields, or native operating-system clipboard behavior. The full-post text is entered by the browser test rather than copied from a live Word/Google Docs application session.

The initial cases were recognized as valid blocks; no converter markup change was required by these observations. Keep the existing conservative parser limits. The next roadmap cycle can simplify the first conversion using this acceptance coverage, while later fidelity work still needs Google Docs checklist support, strict-format Word review, full-length current application captures, and the earlier 4,000-line capacity follow-up.

Official setup references: [Playground CLI](https://developer.wordpress.org/playground/developers/local-development/wp-playground-cli/), [Blueprint data](https://developer.wordpress.org/playground/blueprints/data-format/), and [Blueprint steps](https://developer.wordpress.org/playground/blueprints/steps/).
