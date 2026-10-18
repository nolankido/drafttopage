# Device, keyboard and accessibility acceptance | Draft to Page alpha

Status: **NOT_RUN on physical devices and assistive technologies**. Source regression cases and emulated browser widths do not establish actual device support. Do not invite a device cohort on the strength of this document alone.

## Initial proposed support matrix

| Configuration | Alpha role | Actual full task | Notes |
| --- | --- | --- | --- |
| Windows 11, current Chrome, keyboard only | Target desktop | NOT_RUN | Test file picker, Enter/Space on approval and recovery actions, Tab order, copy denial and manual fallback |
| Windows 11, current Edge, NVDA | Target desktop screen reader | NOT_RUN | Verify one spoken paste-error announcement, preview heading focus and field messages |
| macOS, current Safari, VoiceOver | Target desktop screen reader | NOT_RUN | File picker, focus transition, copy fallback, paragraph/heading navigation |
| iPhone, current iOS Safari with VoiceOver | Target mobile | NOT_RUN | Native Paste and beforeinput, text selection, file picker, ZIP download, virtual keyboard and VoiceOver focus |
| Android, current Chrome with TalkBack | Target mobile | NOT_RUN | Native Paste and clipboard permissions, responsive actions, file picker and TalkBack |
| Browser at 320 CSS px, 200% text zoom | Supplemental emulation | NOT_RUN in this turn | Emulated viewport is not phone acceptance; inspect all major controls and no document-level sideways scrolling |

The owner should limit the supported first cohort to configurations actually exercised. Record OS and exact browser/AT versions at the session, not guessed versions in this matrix.

## Repeatable whole-task script

1. Start on the Word or Google Docs converter. Navigate by Tab/Shift+Tab and screen reader headings; a complete description should accompany each input.
2. Choose a **fictional** source file using the actual picker, or paste a formatted selection copied from an ordinary source app. On a phone, use the native Paste menu. Confirm no silently clipped ending. A mobile \`paste\` followed by \`beforeinput\` without transfer bytes must preserve an already validated paste; an unverified paste must still be refused.
3. Review the staging summary, warnings, unmapped fields, image handling choices, exact-source disclosure and deliberate acknowledgement. Confirm preview does not mutate current writing.
4. Apply the import. Keyboard focus must land in the article or export path as stated; Enter/Space activation must not insert stray newlines or duplicate a restore.
5. Fix one ordinary heading or link, then review and approve the export. Verify the changed article clears export approval.
6. Deny clipboard permission when using Copy WordPress blocks. The approved exact block source must become visible and keyboard reachable, with download available. Confirm no auto-copy or publish is claimed.
7. Save a private backup; close/reopen; inspect staged recovery and deliberately restore. Make sure the original writing was checkpointed, approval resets, and pressing Enter does not edit restored text.
8. On physical mobile, open the software keyboard near the bottom of the page and confirm the needed Apply/Continue/Download controls remain reachable by scrolling. At 200% text zoom check action wrapping and horizontal overflow.

For every configuration record: exact versions, source route, use of assistive technology, outcome per step, whether any writing or unique ending was lost, focus location after each transition, repeated/silent spoken status, whether source was pasted only after a verified gesture, and any workaround. Do not save real authors' raw source, screenshots with identifiable content, passwords, site URLs, or clipboard bytes in the public repo. Store consented observations in private alpha study records.

**Hard stop**: lost writing, missing ending, content copied without approval, unconsented private export, wrong restored workspace, unrecoverable source, or repeated accidental activation prevents declaring the device configuration supported.

## Turn 7 implementation boundary

The paste guard accepts a single already-checked native clipboard payload across the browser's paired \`paste\` and data-less \`beforeinput\` events, rejecting unmatched or unverified payloads. The WordPress clipboard failure fallback opens the approved exact-source disclosure and focuses its summary, without moving focus into an editable source. Paste errors are announced through the global live status and described beside the affected field without repeating the same live announcement.

These changes do not certify mobile WebKit, TalkBack, VoiceOver or NVDA, or guarantee platform file downloads. Human/device verification remains NOT_RUN until exercised.
