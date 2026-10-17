# Sequential Word image placement

This improvement reduces manual selection steps while retaining the existing review and WordPress publishing safeguards.

After opening the image-map.json from a recovered Word image ZIP, choose **Find next matching Word image**. The local tool searches the current article in reading order and pins the first uniquely numbered placeholder whose map entry has a recovered image filename. It selects the matching placement-map row to show original filename, alt text and comparison notes together.

The next selection becomes available after the current placeholder has been replaced. The shortcut can reach an image after the first 40 dropdown choices.

## Safety limits

The shortcut does not act on repeated image labels, missing recovered files, or image-like text inside protected article structures. For combined Word documents or any ambiguous location, the writer must use the existing manual placeholder selector. The original Word document remains necessary to check actual image placement.

Changing the target asks for confirmation if a different image URL, alternative text or decorative choice is pending. A refused change keeps pending work. An accepted change clears old URL, alt text, decorative choice and replacement preview, rather than carrying them to the next image.

The tool never fills an uploaded URL, assumes Word alternative text is correct, applies the image, grants export approval or connects to WordPress. Reviewing Word alt text still requires the existing comparison checkbox and explicit Use reviewed Word alternative text action. The writer must enter a public HTTPS URL for an image uploaded separately, preview its exact replacement, and apply it through the checkpointed editor.

The original image ZIP and placement-map v1 format are unchanged. No images or links are loaded by this shortcut. It adds no tracking, account, backend API, persistence, browser recovery data or new dependencies.

## Validation

New tests exercise order, unique and repeated labels, protected paragraphs, Unicode offsets, positions beyond the first 40 choices, disabled/busy states, stale targets, pending-detail cancellation, explicit alternative-text review, and the preview/apply/next loop. Automated tests are not proof of current source-app compatibility, actual Media Library uploads or unassisted writer success. Release validation and deployment status are recorded in the accompanying PR.
