# Lightweight kit file lists during live editing

Continuation of PR #120 from production commit `06a8823b45444741648022944ee6dd5115a7822c`. Observed validation completed October 17, 2026 HST; the filename retains the existing improvement-series date.

## Source finding and change

When the general publishing-kit panel was open, every editor update built its full reading-page HTML, Markdown and metadata files merely to show their filenames and purposes. Opening the WordPress kit did more work: it rebuilt the general files, WordPress block HTML, a second complete review and image notes, again only to display six descriptions.

The two controllers now use `public/kit-manifests.js` for field-validated filenames, file order, descriptions, optional page Markdown, slug notices and linked-image notices. The helper returns no article content, HTML, private fields or ZIP bytes. It retains no draft or cache. The WordPress file-list signature now contains descriptions, not article text; current review findings and source guards still use their original article signatures.

The full `publishing-kit.js` and `wordpress-kit.js` serializers are unchanged. Explicit approved downloads still regenerate actual files from the complete current article. Existing WordPress, Word and HTML findings, preview content, consent, permissions, approval invalidation, download error handling and private-field boundaries are not bypassed. The file list is not proof that final export serialization will succeed; the download handler remains authoritative and reports failures.

Descriptions deliberately duplicate the small existing serializer catalog to avoid changing authoritative export byte generation. Exact parity tests must fail if a later serializer changes a filename, purpose, notice or optional-file rule without updating its manifest.

## Completed correctness evidence

Feature runtime `9e9829fbe69eb74903d837279a2b6066f3f77465` passed the complete isolated gate in [diagnostic PR #124](https://github.com/nolankido/drafttopage/pull/124), commit `0a5b848af421d8062fa5ef6836457351da696d14`: full Node suite, static checks, 59 browser checks, 379 layout checks, all 37 document benchmark contracts, local WordPress 7.1.3 with 13 of 13 save/reopen cases, two Media Library uploads and three placements, and unchanged-source validation. The separate WordPress receipt check also passed. The diagnostic did not extract a total Node test count, so no count is asserted.

Six new manifest tests compare file metadata with the unchanged full serializers across valid/invalid fields, image and title choices, Unicode/CRLF, source HTML, tables, lists and near-limit documents. They also check private-field exclusion, independent mutable results, poisoned serializer exports and current-source download guards.

An instrumented browser check with both kit panels open recorded **six general-kit and three WordPress-kit generations for three native edits before the change, versus zero of either after**. Live TODO findings remained visible and current. Clearing the title removed stale file lists and disabled downloads. Real downloaded WordPress and general ZIP bytes exactly matched independently generated output from the unchanged exporters for the current edited article; their digests are in the evidence summary. Private sentinel fields were excluded.

## Measured typing result and limits

Five scenarios ran in before/after/after/before order, 31 native insertions per run, with identical built assets except the two controllers. Two CPU profiles were recorded separately; no profiler ran during the 20 timing runs. The table reports synchronous input-handler milliseconds, with medians of two run medians and ranges of the two run p95s, not pooled or population statistics.

| Rich article scenario | Before median | After median | Before p95 range | After p95 range |
| --- | ---: | ---: | ---: | ---: |
| WordPress, panels open | 206.55 | 143.95 | 231.8 to 277.1 | 168.2 to 187.2 |
| Word, panels open | 162.20 | 147.10 | 183.7 to 203.7 | 191.7 to 195.1 |
| HTML, panels open | 160.85 | 141.20 | 184.7 to 194.9 | 174.7 to 183.7 |
| WordPress, panels closed | 27.50 | 27.45 | 40.9 to 42.2 | 40.0 to 44.2 |
| Markdown, panels closed | 4.10 | 3.85 | 6.5 to 7.1 | 5.3 to 6.8 |

The open WordPress median is about **30% lower**, Word about **9% lower**, and HTML about **12% lower** in this synthetic environment. Closed WordPress is effectively unchanged, consistent with removal of work specific to open kit lists. Word p95 is still mixed. HTML's worst synchronous sample worsened from **209.6 to 241.4 ms**, despite its improved median and p95 range. Closed-panel WordPress also has a slightly worse maximum. Those adverse results remain in the committed summary.

These measurements exclude event queueing and actual paint. They do not establish field INP, physical-device speed, real-writer acceptance or universally improved tail latency. Open previews and full formatting review still perform substantial work; this change removes redundant kit generation, not all editing cost.

## Evidence retention and reproduction

The [committed observed summary](evidence/kit-manifests-summary-20261017.json) retains acceptance outcomes, mechanism counts, exact ZIP digests and all five paired summaries, including adverse maxima and frame-callback results. It is explicitly a summary, not a duplicate of every raw sample.

The [original immutable receipt](https://8ea165b7-drafttopage.nolankido.workers.dev/_dtp_kit_manifest_probe_20261016.json) retains all individual input/frame samples, separate CPU profiles and source fingerprints. Original receipt: 67,623 bytes, SHA256 `955941b8f83f9af80d266d52305bfa197f8e262cc19ab4ddfffb65f107160b87`. The external reader initially omitted JSON body text, so [temporary read-only projection PR #125](https://github.com/nolankido/drafttopage/pull/125) exposed bounded fields from that same immutable report. It ran no new tests or measurements and did not change the outcome.

The exact study and historical controller fixtures remain available on diagnostic commit `0a5b848af421d8062fa5ef6836457351da696d14`. Run its study deliberately in an isolated checkout with the already installed browser tools. Do not merge its temporary build hook, baseline fixtures or generated receipt pages into production. The permanent feature branch contains no diagnostic installers or automatic tests.

No GitHub Actions, cron, tracking, new production dependencies, provider activation, account changes, outreach, user drafts or automatic publication. Native Cloudflare Git deployment and live-byte verification are recorded separately in the release PR.
