function shell(title, content, script = '') {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${title} | Draft to Page</title>
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/pilot.css"><link rel="stylesheet" href="/content.css"></head>
<body><a class="skip-link" href="#main">Skip to content</a>
<header class="site-header wrap"><a class="brand" href="/">Draft to Page<span aria-hidden="true">.</span></a><nav aria-label="Pilot navigation"><a href="/help/" target="_blank" rel="noopener">Help (new tab)</a><a href="/privacy/" target="_blank" rel="noopener">Data use (new tab)</a><span class="badge">Private pilot</span></nav></header>
<main id="main" class="wrap pilot-main">${content}</main>
<footer class="wrap site-footer"><p>Early-stage software. Human review required.</p><a href="/">Back to the public site</a></footer>
${script ? `<script type="module" src="/${script}"></script>` : ''}</body></html>`;
}
export const unavailablePage = shell('Pilot not activated', `
<section class="pilot-card narrow"><p class="eyebrow">Invitation only</p><h1>The pilot is not activated yet.</h1>
<p>Private access or usage protection still needs owner configuration. This is not a public sign-up page.</p>
<p>No notes have been submitted and no AI request has been made.</p>
<p>While access is being set up, you can edit and export a prewritten fictional sample or prepare your own source notes.</p>
<div class="actions"><a class="button" href="/demo/">Try the sample editor</a><a href="/templates/">Browse note templates</a></div>
<p><a href="/access/">Access and owner activation checklist</a></p></section>`);
export const loginPage = shell('Pilot sign-in', `
<section class="pilot-card narrow"><p class="eyebrow">Invitation only</p><h1>Make room for your next page.</h1>
<p>Use the password supplied by the owner. There is no public registration or individual password recovery.</p>
<form id="login-form" method="post" action="/api/pilot/login">
<label for="password">Pilot password</label><input id="password" name="password" type="password" autocomplete="current-password" minlength="24" maxlength="256" required>
<button class="button" id="sign-in" type="submit">Open the pilot</button>
<p id="login-status" class="message" role="status" aria-live="polite"></p></form>
<noscript><p>JavaScript is required. The sign-in endpoint does not accept ordinary form submissions.</p></noscript>
<p class="small">The sign-in cookie lasts up to four hours. Do not paste an API key here. <a href="/privacy/">Read the data-use notice.</a></p>
<p><a href="/getting-started/">First-use guide</a> · <a href="/demo/">Try a public sample</a></p></section>`, 'login.js');
export const appPage = shell('Publishing workspace', `
<section class="pilot-heading"><div><p class="eyebrow">Notes → draft → review → export</p><h1>Your next page starts here.</h1><p>Bring the facts. Shape the writing. Keep the final say.</p></div><button id="logout" class="secondary" type="button">Sign out</button></section>
<p class="notice">Private pilot, not a public service. AI can invent or misstate facts. Nothing is automatically published.</p>
<p class="notice save-warning"><strong>No autosave.</strong> Keep your original notes in your own document. Refreshing or leaving this page can discard your work. Download your reviewed article before you leave.</p>
<p class="pilot-links"><a href="/getting-started/" target="_blank" rel="noopener">First-use guide (new tab)</a><a href="/guides/review/" target="_blank" rel="noopener">Review checklist (new tab)</a></p>
<div class="inline-tools"><button id="reconnect" class="secondary" type="button">Recheck connection</button><span class="small">Checks sign-in and configuration only. No AI request.</span></div>
<p id="status" class="message" role="status" aria-live="polite">Checking the pilot connection…</p>
<p id="reauth" class="notice" hidden>Your session ended. <a href="/pilot" target="_blank" rel="noopener">Sign in in a new tab</a>, then return here and select Recheck connection. Keep this tab open to preserve your notes.</p>
<div class="workspace"><section class="pilot-card" aria-labelledby="source-title"><p class="eyebrow">01 / Bring the substance</p><h2 id="source-title">Your source notes</h2>
<form id="draft-form" method="post" action="/api/pilot/generate"><fieldset id="source-fields"><legend class="sr-only">Prepare the article</legend>
<label for="profile">Article type</label><select id="profile" name="profile" required><option value="personal">Personal essay</option><option value="update">Project update</option><option value="guide">Practical guide</option></select>
<p id="profile-help" class="small">Three built-in writing presets, not saved website profiles or a learned personal voice.</p>
<details class="source-template"><summary>Start with a note outline</summary><label for="note-template">Choose an outline</label><select id="note-template"><option value="reflection">Personal reflection</option><option value="learning">What I learned</option><option value="progress">Project progress update</option><option value="release">Release announcement</option><option value="process">Step-by-step process</option><option value="checklist">Practical checklist</option></select><button id="load-template" type="button" class="secondary">Load outline</button><p class="small">This replaces source notes only after confirmation, selects the matching article type, and makes no AI request. Replace the prompts with your own facts.</p></details>
<label for="audience">Audience <span class="optional">(optional)</span></label><input id="audience" name="audience" maxlength="160" placeholder="Who is this page for?">
<label for="purpose">Purpose <span class="optional">(optional)</span></label><input id="purpose" name="purpose" maxlength="240" placeholder="What should readers take away?">
<div class="field-heading"><label for="notes">Notes or existing draft</label><span id="note-count" class="small">0 / 8,000</span></div>
<textarea id="notes" name="notes" rows="13" minlength="30" maxlength="8000" aria-describedby="notes-help" required placeholder="Paste actual facts, observations, or ideas. Mark interpretation and uncertainty explicitly."></textarea>
<p id="notes-help" class="small">30 to 8,000 characters. Do not include passwords, confidential business material, sensitive personal information, or another person's writing without permission.</p>
<div class="inline-tools"><button id="sample" type="button" class="secondary">Load fictional sample notes</button><button id="copy-notes" type="button" class="secondary">Copy source notes</button></div>
<label class="check"><input id="consent" type="checkbox" required><span>I have permission to use these notes and understand that preparing a draft sends them, the article-type guidance, audience, and purpose to Anthropic. <a href="/privacy/" target="_blank" rel="noopener">Data use (new tab)</a></span></label>
<button class="button" id="generate" type="submit" disabled>Prepare draft</button><p class="small">Shared limit: 20 generation attempts per UTC day, at least 30 seconds apart. Failed provider attempts also count. No automatic retries.</p>
</fieldset></form></section>
<section class="pilot-card" aria-labelledby="editor-title"><p class="eyebrow">02 / Keep the final say</p><h2 id="editor-title">Your editable article</h2>
<p id="empty-state" class="small">The proposed title, article, page details, and review questions will appear here. You can edit every article field. Nothing is saved automatically.</p>
<div id="editor" hidden><label for="title">Article title</label><input id="title" maxlength="160">
<label for="excerpt">Short excerpt</label><textarea id="excerpt" rows="3" maxlength="300" aria-describedby="excerpt-help"></textarea><p id="excerpt-help" class="small">A short introduction for a listing, preview, or article summary.</p>
<label for="description">Page description</label><textarea id="description" rows="3" maxlength="160" aria-describedby="description-help"></textarea><p id="description-help" class="small">A plain description of this page. Your website may need this in a separate field.</p>
<label for="slug">Filename <span class="optional">(without .md)</span></label><input id="slug" maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" spellcheck="false" aria-describedby="slug-help"><p id="slug-help" class="small">Lowercase letters, numbers, and separating hyphens. Example: project-progress-update.</p>
<label for="body">Article body <span class="optional">(Markdown)</span></label><textarea id="body" rows="19" maxlength="12000" spellcheck="true"></textarea>
<section class="review-box" aria-labelledby="review-title"><h3 id="review-title">Check before publishing</h3><p>These are AI-suggested questions, not a complete fact-check. No returned questions does not mean the draft is verified.</p><ul id="questions"></ul><button id="copy-questions" type="button" class="secondary">Copy review questions</button><p class="small">Verify names, dates, claims, links, permissions, and whether the writing sounds like you. Review Markdown in a safe editor before importing it into a website.</p></section>
<label class="check"><input id="reviewed" type="checkbox"><span>I have reviewed this draft and its open questions. Exporting does not publish it.</span></label>
<div class="actions"><button class="button" id="download" type="button" disabled>Download Markdown</button><button class="secondary" id="copy" type="button" disabled>Copy Markdown</button><button class="secondary" id="copy-body" type="button" disabled>Copy article body</button></div>
<p class="small">Editing an article field clears approval. The article file includes metadata and a draft flag, but not your source notes or review questions. Copy those separately to your own private document when needed.</p>
<div class="export-help"><strong>Next: check the actual file.</strong><p>Confirm your edits appear, then preview the article in your publishing workflow. <code>draft: true</code> is not a universal publication lock.</p><a href="/help/markdown-export/" target="_blank" rel="noopener">Read the export guide (new tab)</a></div>
</div></section></div>
<div class="pilot-bottom"><p class="small">No draft history or autosave. Refreshing, navigating away, or signing out can discard your work. Application code does not store notes or drafts on the server.</p><button class="secondary" id="clear" type="button">Clear this workspace</button></div>
<noscript><p>JavaScript is required for the workspace. Public examples and guides can be read without it.</p></noscript>`, 'pilot.js');
