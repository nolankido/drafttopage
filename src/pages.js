function shell(title, content, script = '') {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${title} | Draft to Page</title>
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/pilot.css"></head>
<body><a class="skip-link" href="#main">Skip to content</a>
<header class="site-header wrap"><a class="brand" href="/">Draft to Page<span aria-hidden="true">.</span></a><nav aria-label="Pilot navigation"><a href="/privacy/">Data use</a><span class="badge">Private pilot</span></nav></header>
<main id="main" class="wrap pilot-main">${content}</main>
<footer class="wrap site-footer"><p>Early-stage software. Human review required.</p><a href="/">Back to the public site</a></footer>
${script ? `<script type="module" src="/${script}"></script>` : ''}</body></html>`;
}

export const unavailablePage = shell('Pilot not activated', `
<section class="pilot-card narrow"><p class="eyebrow">Not open to the public</p><h1>The pilot is not activated yet.</h1>
<p>The owner still needs to configure private access. The public product-preview site is unaffected.</p>
<p>No notes have been submitted and no AI request has been made.</p><a class="button" href="/">Return to the website</a></section>`);

export const loginPage = shell('Pilot sign-in', `
<section class="pilot-card narrow"><p class="eyebrow">Invitation only</p><h1>Make room for your next page.</h1>
<p>This small pilot is for the owner and invited testers. There is no public registration.</p>
<form id="login-form" method="post" action="/api/pilot/login">
<label for="password">Pilot password</label><input id="password" name="password" type="password" autocomplete="current-password" minlength="24" maxlength="256" required>
<button class="button" id="sign-in" type="submit">Open the pilot</button>
<p id="login-status" class="message" role="status" aria-live="polite"></p></form>
<noscript><p>JavaScript is required. The sign-in endpoint does not accept ordinary form submissions.</p></noscript>
<p class="small">A secure sign-in cookie lasts up to four hours. Do not paste an API key here. <a href="/privacy/">Read the data-use notice.</a></p></section>`, 'login.js');

export const appPage = shell('Publishing workspace', `
<section class="pilot-heading"><div><p class="eyebrow">Notes → draft → review → export</p><h1>Your next page starts here.</h1><p>Bring the facts. Shape the writing. Keep the final say.</p></div><div class="pilot-tools"><button id="refresh" class="secondary" type="button">Refresh connection</button><button id="logout" class="secondary" type="button">Sign out</button></div></section>
<p class="notice">Private pilot, not a public service. AI can invent or misstate facts. Nothing is automatically published.</p>
<p id="status" class="message" role="status" aria-live="polite">Checking the pilot connection…</p>
<details class="recovery"><summary>Save or restore your work</summary>
<p id="backup-help" class="small">A workspace backup includes your source notes, article, and review questions. It is an unencrypted file on your device. Keep it private. No passwords or approvals are included, and restoring it makes no AI request.</p>
<div class="pilot-tools"><button id="save-backup" class="secondary" type="button" aria-describedby="backup-help">Save workspace backup</button><div><label for="restore-backup">Restore workspace backup (.json)</label><input id="restore-backup" type="file" accept=".json,application/json" aria-describedby="backup-help"></div></div></details>
<div class="workspace">
<section class="pilot-card" aria-labelledby="source-title"><p class="eyebrow">01 / Bring the substance</p><h2 id="source-title">Your source notes</h2>
<form id="draft-form" method="post" action="/api/pilot/generate">
<fieldset id="source-fields"><legend class="sr-only">Prepare the article</legend>
<label for="profile">Website profile</label><select id="profile" name="profile" aria-describedby="profile-help" required><option value="personal">Personal essay</option><option value="update">Project update</option><option value="guide">Practical guide</option></select>
<p id="profile-help" class="small" aria-live="polite" aria-atomic="true">Reusable writing guidance, configured for this pilot.</p>
<label for="audience">Audience <span class="optional">(optional)</span></label><input id="audience" name="audience" maxlength="160" placeholder="Who is this page for?">
<label for="purpose">Purpose <span class="optional">(optional)</span></label><input id="purpose" name="purpose" maxlength="240" placeholder="What should readers take away?">
<div class="field-heading"><label for="notes">Notes or existing draft</label><span id="note-count" class="small">0 / 8,000</span></div>
<textarea id="notes" name="notes" rows="13" minlength="30" maxlength="8000" aria-describedby="notes-help note-count" required placeholder="Paste the actual facts, observations, or ideas you want to work with."></textarea>
<p id="notes-help" class="small">30 to 8,000 characters. Do not include passwords, confidential business material, sensitive personal information, or another person's writing without permission.</p>
<button id="sample" type="button" class="secondary">Load fictional sample notes</button>
<label class="check"><input id="consent" type="checkbox" required><span>I have permission to use these notes and understand that generating a draft sends them and the selected profile to Anthropic. <a href="/privacy/">Data use</a></span></label>
<button class="button" id="generate" type="submit" disabled>Prepare draft</button>
<p class="small">Shared limit: 20 generation attempts per UTC day, at least 30 seconds apart. Failed attempts also count. No automatic retries.</p>
</fieldset></form></section>
<section class="pilot-card" aria-labelledby="editor-title"><p class="eyebrow">02 / Keep the final say</p><h2 id="editor-title">Your editable article</h2>
<p id="empty-state" class="small">Your proposed article and review questions will appear here. All fields remain editable.</p>
<div id="editor" hidden>
<label for="title">Article title</label><input id="title" maxlength="160">
<label for="excerpt">Short excerpt</label><textarea id="excerpt" rows="3" maxlength="300"></textarea>
<label for="description">Page description</label><textarea id="description" rows="2" maxlength="160"></textarea>
<label for="slug">Filename <span class="optional">(without .md)</span></label><input id="slug" maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" spellcheck="false">
<label for="body">Article body <span class="optional">(Markdown)</span></label><textarea id="body" rows="19" maxlength="12000" spellcheck="true"></textarea>
<section class="review-box" aria-labelledby="review-title"><h3 id="review-title">Check before publishing</h3><p>These are AI-suggested questions, not a complete fact-check.</p><ul id="questions"></ul><p class="small">Verify names, dates, claims, links, permissions, and whether the writing sounds like you. Review Markdown in a safe editor before importing it into a website.</p></section>
<label class="check"><input id="reviewed" type="checkbox"><span>I have reviewed this draft and its open questions. Exporting does not publish it.</span></label>
<div class="actions"><button class="button" id="download" type="button" disabled>Download Markdown</button><button class="secondary" id="copy" type="button" disabled>Copy Markdown</button></div>
<p class="small">Export includes a draft flag and page metadata, but not your private source notes. Review questions are not included in the article file. Use a workspace backup to keep your notes and questions separately from the publication file.</p>
</div></section></div>
<div class="pilot-bottom"><p class="small">No automatic history or autosave. Save a workspace backup before leaving. Refreshing, navigating away, or signing out can discard unsaved work. Application code does not store notes or drafts on the server.</p><button class="secondary" id="clear" type="button">Clear this workspace</button></div>
<p id="reauth" hidden>Your session ended. <a href="/pilot" target="_blank" rel="noopener">Sign in in a new tab</a>, then return here and select Refresh connection. This does not reload or clear your writing. Keep this tab open to preserve your notes.</p>
<noscript><p>JavaScript is required for the workspace.</p></noscript>`, 'pilot.js');
