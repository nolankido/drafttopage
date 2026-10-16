# Literal plain clipboard writing

Plain-text clipboard selections in Copied formatted writing mode previously entered the Markdown importer directly. Literal front-matter-looking text could become page fields, an opening heading could leave the body, and a reply code fence could disappear.

The fallback now serializes the selection as literal text using main's current bounded inline Markdown serializer before importing. Common ASCII punctuation is escaped in the stored Markdown so the reading preview, WordPress blocks, HTML, and Word display the original punctuation. It does not infer headings, emphasis, lists, links, tables, code, or page details from a plain selection. Existing newline normalization and boundary handling remain. The ordinary fallback filename remains untitled-article.

The plain-text notice explains the behavior and directs writers to choose Markdown in Import format when they want authored Markdown interpreted. Formatted HTML clipboard conversion and deliberate Markdown, JSON, HTML, and Word imports keep their existing paths. Review acknowledgement, replacement confirmation, checkpoints, private backup formats, and local-only handling remain intact.

The 512 KiB source bound remains. The escaped article must fit the existing 60,000-character editor bound. A conversion that exceeds the bound is rejected in full. An older visible preview cannot be applied after a newer selection fails, and current article writing remains intact.

## Validation

Seven new regression cases cover literal page details, ATX and underlined headings, separators, reply fences, inline and block punctuation, Unicode, unsafe-looking literal HTML, backup portability, newline normalization, invalid input, exact size boundaries, intentional Markdown, and the staged paste/re-preview/apply lifecycle. Independent Python HTML and Word XML readers verify exported visible text, rather than relying only on the application's own text renderer. Existing formatted-import checks cover the unchanged HTML path.

Run the full Node suite and static checks before release. These checks do not establish native clipboard behavior on every device or compatibility with every WordPress installation. This change adds no controls or layout rules. GitHub Actions remain off and the native Cloudflare deployment configuration is unchanged.
