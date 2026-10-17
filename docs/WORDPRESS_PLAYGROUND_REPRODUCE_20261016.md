# Reproducing the local WordPress Media Library acceptance

This manual setup is for Ubuntu 24.04 or a disposable Linux preview build without browser libraries. It is not a production build, scheduled task, GitHub Action or hosted WordPress connection. Skip installation if compatible test tools are already present.

## Pinned tools

For the test tools, use Node.js **24.18.0 or newer**, npm **11.16.0 or newer**, WordPress Playground CLI **3.1.58**, Python Playwright **1.57.0**, and its Chromium browser. The pinned Playground dependencies declare those Node/npm minimums; the public site's own Node requirement is separate. The acceptance runner starts WordPress **7.1.3**, PHP **8.3** and SQLite, and verifies those versions and its unprivileged Author role.

From the Draft to Page repository root, in an isolated network-enabled test workspace:

~~~sh
npm install --no-save --no-package-lock --no-audit --no-fund '@wp-playground/cli@3.1.58'
python3 -m venv /tmp/drafttopage-wp-test-python
/tmp/drafttopage-wp-test-python/bin/python -m pip install 'playwright==1.57.0'
/tmp/drafttopage-wp-test-python/bin/python -m playwright install chromium
~~~

These steps fetch external public test packages, and must be deliberately invoked. The production site never performs them.

## Optional rootless Chromium dependencies on Ubuntu 24.04

If the browser fails to start because of missing shared libraries and root privileges are unavailable, the isolated 2026-10-16 acceptance used these standard Ubuntu binary packages, extracted into a temporary directory:

~~~sh
DRAFTTOPAGE_BROWSER_LIB_ROOT=/tmp/drafttopage-browser-libs
mkdir -p "$DRAFTTOPAGE_BROWSER_LIB_ROOT"/lists/partial "$DRAFTTOPAGE_BROWSER_LIB_ROOT"/archives/partial "$DRAFTTOPAGE_BROWSER_LIB_ROOT"/packages "$DRAFTTOPAGE_BROWSER_LIB_ROOT"/extracted

apt-get update \
  -o 'APT::Sandbox::User=' \
  -o "Dir::State::lists=$DRAFTTOPAGE_BROWSER_LIB_ROOT/lists" \
  -o "Dir::Cache::archives=$DRAFTTOPAGE_BROWSER_LIB_ROOT/archives" \
  -o 'APT::Get::List-Cleanup=0'

cd "$DRAFTTOPAGE_BROWSER_LIB_ROOT/packages"
apt-get download -o 'APT::Sandbox::User=' \
  -o "Dir::State::lists=$DRAFTTOPAGE_BROWSER_LIB_ROOT/lists" \
  libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxkbcommon0 \
  libasound2t64 libxi6

for package in ./*.deb; do dpkg-deb -x "$package" "$DRAFTTOPAGE_BROWSER_LIB_ROOT/extracted"; done
export LD_LIBRARY_PATH="$DRAFTTOPAGE_BROWSER_LIB_ROOT/extracted/usr/lib/x86_64-linux-gnu:$DRAFTTOPAGE_BROWSER_LIB_ROOT/extracted/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH"
~~~

Return to the repository root before testing. These are not universal Linux requirements. Do not override system libraries on production servers. If your installed browser works, do not change its library path.

## Execute and bind acceptance evidence to source

~~~sh
export DRAFTTOPAGE_WORDPRESS_CLI="$PWD/node_modules/@wp-playground/cli/cli.js"
export DRAFTTOPAGE_BROWSER_PYTHON=/tmp/drafttopage-wp-test-python/bin/python

npm run build
"$DRAFTTOPAGE_BROWSER_PYTHON" scripts/wordpress_roundtrip.py
npm run verify:wordpress:receipt
~~~

Run `npm run build` first to generate the public pages served by the test, including `public/word-to-wordpress/index.html`. These generated files are not stored in Git and are absent from a fresh checkout; the WordPress runner does not build them.

The WordPress runner must exit successfully and create a fresh file at **test-results/wordpress-results.json**. The receipt command then verifies the result against the current Git HEAD and complete source snapshot, the pinned local WordPress configuration, all 13 retained cases, and the separate two-upload/three-image Media Library fixture. It rejects stale or incomplete reports. A passing Cloudflare build without the report is not enough.

The runner starts a disposable WordPress site on **127.0.0.1:41865**, creates an unprivileged Author account, uploads two fictional PNG/JPEG files and saves unpublished drafts, then stops the server. No production WordPress account is used. Its HTTPS media alias maps to original bytes retrieved from the local uploaded Media Library files.

## Limits

These checks use fictional source documents, not real author articles. They do not establish physical-device compatibility, current Microsoft Word clipboard behavior, hosted WordPress plugin/theme support, image-privacy suitability, unassisted human completion, saved time, repeat use or commercial demand. The human paired study remains NOT_RUN.
