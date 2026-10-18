# Turn 11 safety review remediation

Turn 10 independent review found a substantive study decision gap: the global stop did not include three incident types required by the public alpha protocol. Records now use nullable, explicit boolean fields for unintended_persistence, unintended_publication and unexpected_external_request.

Unintended persistence means writing or private data was kept despite the observed choice. Unintended publication means content became public without deliberate approval. Unexpected external request means a workflow made an unwanted network request or sent source material to an unapproved destination. Intentional unpublished WordPress drafts, explicitly enabled local recovery and authorized copies are not automatically incidents.

A true outcome for any of these or writing loss, private material in export or missing ending triggers STOP_FOR_SAFETY for all human observations, including unqualified people. Missing observations hold expansion instead of counting as false. Older version-2 private records without the new flags stay readable but are safety-incomplete until an observer can reconcile original evidence.

The Turn 10 review also flagged an outdated incomplete-target issue already fixed by the later commit and user-facing DraftToPage-first wording, now revised to Draft to Page first. No tester observations were created. The study remains NOT_RUN and release/invitation approval remains BLOCKED.
