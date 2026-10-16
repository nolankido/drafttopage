# Recovery keyboard continuity

Cycle 12 was released in [PR #82](https://github.com/nolankido/drafttopage/pull/82), merged as `b799f6a2144ef483a44418b4529722d379a72d88`, tree `0dbda7ff81b713b3ea1bb6ef9cafbd7c745183ad`. The complete stable-source gate passed 787 Node tests, 44 browser journeys, 283 layout checks and all 15 document cases. Source SHA-256: `407928e6562c0f48152bcb1686a6660a839c7520765f5ca630101712caf68439`. Native Cloudflare preview and production builds succeeded; production version `c9ab3b1d-6e1a-4adf-8165-f88031f0f49b`. Exact build IDs and environment scope are recorded in the PR.

## Reproduced problem and change

A local Chromium check activated recovery controls with Enter. Enabling, pausing and removing a browser recovery copy each left document.body focused after the initiating button became unavailable. Users then lost their useful keyboard position within the recovery controls.

Explicit recovery actions now retain a visible, enabled control when the initiating button remains available. Enable moves to Save recovery now, pause moves to Review saved browser copy, and deletion returns to the consent checkbox. Focus uses the browser's normal scrolling behavior so its target can come into view. The existing successful restore moves to the restored article and is respected. Cancelled or rejected actions keep their usable initiating control.

Each action's focus ownership ends when it settles. Focus or pointer movement elsewhere while a lock waits cancels that action's handoff. Closed recovery panels are not reopened. Programmatic activations without owned focus, autosaves and cross-tab storage notifications do not gain a new focus handoff. No tab order, shortcut, modal, storage, consent, restore, checkpoint, approval or export behavior is added.

## Checks and limits

All 26 existing recovery model/controller checks pass. The original three-action browser reproduction now retains useful focus. A focused Chromium journey also passes actual Enter/Space/Tab through enable, pause, deletion, cancelled deletion, comparison and cancelled/successful restore. It checks original writing and approval preservation, restore approval clearing and a previous-writing checkpoint. Background saving and a real cross-tab storage notification retain editor focus. Delaying the genuine Web Lock request checks both continued keyboard editing and pointer movement before completion. The actual lock and storage operations still execute; no provider/API request is made.

The initial new fixture incorrectly expected successful restore to focus a recovery button. Source inspection showed the existing restore intentionally focuses the restored article. The assertion now checks that useful existing behavior. The delayed-lock fixture starts completion without waiting for a writer's intentionally held lock to be released. Preliminary incomplete runs are not acceptance passes. The complete stable-source gate passed October 16, 2026, 11:29 UTC, including the existing competing-tab refusal focus checks, 1440/390/320 layouts and unchanged-source verification.

This is local Chromium keyboard evidence, not a real screen-reader, physical-device or all-browser acceptance session. WordPress serialization is unchanged; this cycle does not claim fresh destination acceptance. PR #81 retains the latest ten genuine local WordPress save/reopen cases. The native Cloudflare Git integration remains the release path. No Actions, cron, fees, dependencies, tracking, provider activation or outreach is introduced.
