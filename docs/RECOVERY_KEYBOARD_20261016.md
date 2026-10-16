# Recovery keyboard continuity

Cycle 12 is implemented in [PR #82](https://github.com/nolankido/drafttopage/pull/82), from main `9bab282f96882e5e86c6fd4dcfdf77531a8f2b86`. Complete stable-source validation and native deployment outcomes belong in the PR before release.

## Reproduced problem and change

A local Chromium check activated recovery controls with Enter. Enabling, pausing and removing a browser recovery copy each left document.body focused after the initiating button became unavailable. Users then lost their useful keyboard position within the recovery controls.

Explicit recovery actions now retain a visible, enabled control when the initiating button remains available. Enable moves to Save recovery now, pause moves to Review saved browser copy, and deletion returns to the consent checkbox. Focus uses the browser's normal scrolling behavior so its target can come into view. The existing successful restore moves to the restored article and is respected. Cancelled or rejected actions keep their usable initiating control.

Each action's focus ownership ends when it settles. Focus or pointer movement elsewhere while a lock waits cancels that action's handoff. Closed recovery panels are not reopened. Programmatic activations without owned focus, autosaves and cross-tab storage notifications do not gain a new focus handoff. No tab order, shortcut, modal, storage, consent, restore, checkpoint, approval or export behavior is added.

## Checks and limits

All 26 existing recovery model/controller checks pass. The original three-action browser reproduction now retains useful focus. A focused Chromium journey also passes actual Enter/Space/Tab through enable, pause, deletion, cancelled deletion, comparison and cancelled/successful restore. It checks original writing and approval preservation, restore approval clearing and a previous-writing checkpoint. Background saving and a real cross-tab storage notification retain editor focus. Delaying the genuine Web Lock request checks both continued keyboard editing and pointer movement before completion. The actual lock and storage operations still execute; no provider/API request is made.

The initial new fixture incorrectly expected successful restore to focus a recovery button. Source inspection showed the existing restore intentionally focuses the restored article. The assertion now checks that useful existing behavior. The delayed-lock fixture starts completion without waiting for a writer's intentionally held lock to be released. Preliminary incomplete runs are not acceptance passes. The complete stable-source gate, including the existing competing-tab refusal checks and 1440/390/320 layouts, is required before merge.

This is local Chromium keyboard evidence, not a real screen-reader, physical-device or all-browser acceptance session. WordPress serialization is unchanged; this cycle does not claim fresh destination acceptance. PR #81 retains the latest ten genuine local WordPress save/reopen cases. The native Cloudflare Git integration remains the release path. No Actions, cron, fees, dependencies, tracking, provider activation or outreach is introduced.
