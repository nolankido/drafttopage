# Strikethrough fidelity

Status: implementation in progress. Starting main: `09b263993c7d851aa89746a82ee6bbc8451e5744`. Do not duplicate this active work. No preservation or release acceptance is claimed yet.

The pinned Word fixture currently simplifies a struck-through menu item to plain text with a warning. This bounded cycle will preserve single-line ordinary strikethrough across supported Word/HTML import, nested article Markdown, inert preview, HTML/Word/WordPress output and source review. It must keep literal clipboard escaping, existing parser depth/work bounds and safe code/link handling. Unsupported double strike, underline and vertical alignment must retain truthful handling.

A complete release requires focused regression cases, the existing real document corpus, the full stable-source local release gate and genuine local WordPress save/reopen evidence that checks the formatting itself. Native Cloudflare Git deployment is preserved. No paid service, provider activation, tracking, outreach, Actions or cron is added.
