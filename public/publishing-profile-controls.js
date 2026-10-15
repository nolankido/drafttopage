import { MAX_PROFILE_BYTES, PROFILE_DESTINATIONS, checklistFromText, validatePublishingProfile, createPublishingProfile, parsePublishingProfile } from './publishing-profile.js';
import { downloadText } from './download.js';
import { suggestFilename } from './preview.js';

export function installPublishingProfiles({ getWorkspace, changed, workChanged, isBusy = () => false, report, download = downloadText }) {
  const $ = id => document.getElementById(id);
  let pending = null, reading = false, generation = 0, signature = null, checklist = [], ticks = [];
  const preferences = () => ({ destination: $('publishing-destination').value, formattedTitle: $('copy-title').checked, htmlTitle: $('html-include-title').checked, wordTitle: $('word-include-title').checked, markdownTitle: $('export-format').value });
  const profile = () => validatePublishingProfile({ format: 'drafttopage-publishing-profile', version: 1, name: $('publishing-profile-name').value, preferences: preferences(), checklist: checklistFromText($('publishing-profile-checks').value) });
  function status(message) { $('publishing-profile-status').textContent = message; }
  function clearPreview() {
    pending = null; $('publishing-profile-preview').hidden = true;
    $('publishing-profile-preview-name').textContent = '';
    $('publishing-profile-preview-choices').replaceChildren(); $('publishing-profile-preview-checks').replaceChildren();
    $('apply-publishing-profile').disabled = true;
  }
  function renderChecklist() {
    $('publishing-checklist').hidden = !checklist.length;
    $('publishing-checklist-items').replaceChildren(...checklist.map((text, i) => {
      const item = document.createElement('li'), label = document.createElement('label'), input = document.createElement('input'), span = document.createElement('span');
      label.className = 'check'; input.type = 'checkbox'; input.checked = Boolean(ticks[i]); input.disabled = isBusy(); span.textContent = text;
      input.addEventListener('change', () => { if (isBusy()) { input.checked = Boolean(ticks[i]); return; } ticks[i] = input.checked; changed(); });
      label.append(input, span); item.append(label); return item;
    }));
    $('publishing-checklist-status').textContent = checklist.length ? ticks.filter(Boolean).length + ' / ' + checklist.length + ' reminders checked. Export approval is separate.' : '';
  }
  function update() {
    $('publishing-profile-controls').disabled = isBusy();
    $('load-publishing-profile').disabled = reading;
    $('apply-publishing-profile').disabled = !pending || reading || isBusy();
    let next = [], error = '';
    try { next = checklistFromText($('publishing-profile-checks').value); } catch (failure) { error = failure.message; }
    $('publishing-profile-error').textContent = error;
    if (error) $('publishing-profile-checks').setAttribute('aria-invalid', 'true'); else $('publishing-profile-checks').removeAttribute('aria-invalid');
    const current = JSON.stringify([getWorkspace(), preferences(), $('publishing-profile-checks').value]);
    if (current !== signature) { signature = current; checklist = next; ticks = []; renderChecklist(); }
    else {
      for (const input of $('publishing-checklist-items').querySelectorAll('input')) input.disabled = isBusy();
      $('publishing-checklist-status').textContent = checklist.length ? ticks.filter(Boolean).length + ' / ' + checklist.length + ' reminders checked. Export approval is separate.' : '';
    }
    let valid = false;
    try { profile(); valid = true; } catch { /* No error is shown for a blank optional profile name. */ }
    $('download-publishing-profile').disabled = !valid || reading || isBusy();
  }
  for (const id of ['publishing-profile-name', 'publishing-profile-checks']) $(id).addEventListener('input', () => { workChanged(); if (id === 'publishing-profile-checks') changed(); else update(); });
  $('download-publishing-profile').addEventListener('click', () => {
    if (reading || isBusy()) return;
    try { const value = profile(); download(createPublishingProfile(value), suggestFilename(value.name) + '-publishing-profile.json', 'application/json;charset=utf-8'); status('Profile download requested with export choices and reminder text only. Check the saved file. It does not save your article.'); }
    catch (error) { status(error.message); }
  });
  $('load-publishing-profile').addEventListener('change', async () => {
    const file = $('load-publishing-profile').files?.[0];
    if (!file || reading || isBusy()) { $('load-publishing-profile').value = ''; return; }
    const token = ++generation; reading = true; clearPreview(); update(); workChanged(); status('Reading the selected profile locally. Current writing and export choices are unchanged.');
    try {
      if (file.size > MAX_PROFILE_BYTES) throw new Error('Choose a publishing profile no larger than 16 KiB.');
      const value = parsePublishingProfile(await file.text());
      if (token !== generation) return;
      pending = value; $('publishing-profile-preview-name').textContent = value.name;
      const p = value.preferences;
      const choices = ['Destination: ' + PROFILE_DESTINATIONS[p.destination], 'Title in formatted copy: ' + (p.formattedTitle ? 'included' : 'separate'), 'Title in HTML source: ' + (p.htmlTitle ? 'included' : 'separate'), 'Title in Word: ' + (p.wordTitle ? 'included' : 'separate'), 'Page Markdown title heading: ' + (p.markdownTitle === 'document' ? 'included' : 'supplied by website')];
      $('publishing-profile-preview-choices').replaceChildren(...choices.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
      $('publishing-profile-preview-checks').replaceChildren(...value.checklist.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
      $('publishing-profile-preview').hidden = false;
      status('Profile ready to preview. Apply changes only export choices and your checklist, and clears approval. Your article and source notes stay in place.');
    } catch (error) { if (token === generation) { clearPreview(); status(error.message || 'Could not read this profile. Current writing and choices are unchanged.'); } }
    finally { if (token === generation) { reading = false; $('load-publishing-profile').value = ''; update(); workChanged(); } }
  });
  $('apply-publishing-profile').addEventListener('click', () => {
    if (!pending || reading || isBusy()) return;
    const value = pending, p = value.preferences;
    $('publishing-destination').value = p.destination;
    $('copy-title').checked = p.formattedTitle; $('html-include-title').checked = p.htmlTitle; $('word-include-title').checked = p.wordTitle; $('export-format').value = p.markdownTitle;
    if (p.destination === 'other') $('additional-exports').open = true;
    $('publishing-profile-name').value = value.name; $('publishing-profile-checks').value = value.checklist.join('\n');
    signature = null; clearPreview(); changed(); workChanged();
    status('Applied ' + value.name + '. Reminders start unchecked and approval is cleared. Current writing is kept.'); report('Publishing profile applied. Review your checklist and article before approving an export. Nothing was uploaded or published.');
  });
  $('cancel-publishing-profile').addEventListener('click', () => { clearPreview(); update(); workChanged(); status('Profile preview cancelled. Current writing and export choices are unchanged.'); });
  function reset() {
    ++generation; reading = false; clearPreview(); $('load-publishing-profile').value = '';
    $('publishing-profile-name').value = ''; $('publishing-profile-checks').value = ''; signature = null; checklist = []; ticks = []; update();
    status('No profile name or checklist is loaded. Export choices remain in the destination controls. Download a profile explicitly to reuse them after leaving.');
  }
  $('clear-publishing-profile').addEventListener('click', () => { if (isBusy()) return; reset(); changed(); workChanged(); });
  update(); status('Save the current export choices as a reusable profile, or load one to preview. Nothing is saved automatically.');
  const hasSetup = () => Boolean($('publishing-profile-name').value.trim() || $('publishing-profile-checks').value.trim());
  return { update, reset, hasSetup, hasWork: () => reading || Boolean(pending) || Boolean($('publishing-profile-name').value || $('publishing-profile-checks').value) };
}
