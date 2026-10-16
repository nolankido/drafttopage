# Keep restore activation out of recovered writing

Starting combined candidate: local `2006ff94e67e4032f12671b575bb882cc3e84d71`, stacked on PRs #95 and #96. Main remains `814bfa5d89ff13f50c4abc3aa80f21632335fab9`. No new main merge or production deployment is claimed.

## Reproduced problem

The corrected-pointer full gate passed 900 Node tests but failed the existing browser-recovery keyboard journey on October 16, 2026, 19:54:10 UTC. Expected restored body was `Fictional keyboard recovery article.`; actual body had an additional newline. Source SHA-256 `13ba40c3047830dc317ea7aa3ddead074b79db362d5a4cf12703994daa7c2427`. The browser gate failed and the WordPress stage was not reached; this is not a release pass.

Three read-only native-event probes show the original restore completing before Enter keyup, with keyup reaching the restored textarea. Those three ordinary probes did not themselves add a newline. A separate deterministic baseline reproduction holds Enter until restore focuses the article, then sends a native repeated keydown: the body changes from `Fictional exact recovery.` to `Fictional exact recovery.\n`. This establishes the held-key failure; it does not claim which exact event ordering caused the earlier single-press gate observation.

## Bounded fix

Only the browser-copy Restore button uses the new small keyboard helper. It prevents native Enter activation on press/repeat and activates once after the corresponding release, while the button remains focused, connected, visible and enabled. A focus change, pointer action anywhere or window blur cancels the pending gesture and removes its temporary listeners. Composition is not reinterpreted as restore. Normal pointer, native Space and assistive click activation keep the existing click handler. There is no timer, draft cache, input suppression in the article, or change to ordinary typing.

The existing controller still owns consent, reviewed saved/current comparison, exact source rechecks, exclusive browser lock, checkpoint before replacement, cancellation/failure behavior, local copy bounds/deletion and approval reset. No automatic export approval, new storage accessor, format, provider, network request, dependency or hosting configuration is added. This is a desktop Chromium and model check, not assistive-technology or physical-device certification.

## Validation

All 32 focused keyboard/recovery model checks pass, including six new cases for activation/repeat/release, unowned repeats, focus/pointer/window cancellation, disabled/detached/hidden controls, composition/other keys and later reuse without double activation. The unchanged earlier keyboard journey passes against the corrected helper, including cancelled restore, exact successful restore, focus, checkpoint, background save and cross-tab notification.

The new actual-browser journey passes all eight public workspaces. Held Enter plus a repeat leaves current writing, approval and checkpoint count unchanged; release restores exact Unicode text with no native article input event. Deliberate subsequent typing works. Two routes additionally verify Tab/pointer cancellation, native Space restore and pointer restore. All eight require fresh export approval and independently read the actual downloaded Markdown bytes, including the exact ending. The 24 wide/narrow layout checks pass. An earlier partial diagnostic was interrupted when the helper changed; only the stable rerun is counted. One preliminary probe expected a transient restore status after autosave had already replaced it; the corrected probe reads actual source and event order.

The complete final combined stable-source gate, source/tree hash, feature PR and native preview outcome are recorded in the PR after execution. Failed and incomplete prior runs remain recorded. The previously passed combined gate at local `c4cc12a` remains historical evidence for that exact source; it is not substituted for this fix's acceptance.
