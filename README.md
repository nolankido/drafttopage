# Draft to Page

Your ideas. Ready for your website.

Draft to Page is an early-stage publishing-assistant project for independent website owners. The planned workflow turns owner-supplied notes into editable articles for human review and export.

- Domain: `drafttopage.com`
- Repository: `nolankido/drafttopage`
- Intended hosting: Cloudflare Workers with static assets
- Current stage: repository initialization; the starter website will be proposed in a pull request

## Development workflow

Use a focused feature branch and pull request for website changes. Review before merging into `main`. After the Cloudflare Git integration is configured, `main` is the intended production branch.

Keep secrets, unpublished source notes, customer information, and unrelated project files out of this public repository. Do not claim that the drafting application, customer accounts, payments, or AI integration are available until they are implemented and verified.

The domain's registration and DNS settings are managed outside this repository. Do not enable GitHub Pages for this project.
