# GitHub Jira PR Linker

Chrome extension that turns Jira ticket keys (e.g. `SFBILLING-336`) in a
GitHub pull request's title and description into clickable links to your
Jira instance.

## Development setup

This project has no build step — the `src/` files run directly as Chrome
content scripts. Automated tests use Jest + jsdom.

```bash
npm install
npm test
```

### Note on `npm install` in registries with a release-age policy

If your npm registry enforces a minimum package release-age policy (some
corporate registries do), a fresh `npm install` may fail with `403
Forbidden` errors for a few of Jest's transitive dependencies (e.g.
`electron-to-chromium`, `browserslist`, `caniuse-lite`, `@types/node`),
because the newest semver-matching versions were published too recently.
This project's `package.json` already pins those specific transitive
dependencies to older, non-blocked versions via an `"overrides"` field.
If you hit a similar 403 for a different package in the future, check
`npm error` output for the offending package name and add (or bump) an
entry for it under `"overrides"`.

## Load the extension in Chrome

1. Run `npm install` then `npm test` to confirm all tests pass.
2. Open `chrome://extensions` in Chrome.
3. Enable "Developer mode" (top-right toggle).
4. Click "Load unpacked" and select this project's root folder.

## Configure your Jira base URL

1. On `chrome://extensions`, find "GitHub Jira PR Linker" and click "Details".
2. Click "Extension options".
3. Enter your Jira base URL, e.g. `https://progresssoftware.atlassian.net`.
4. Click "Save".

## Verify it works

1. Open a GitHub pull request whose title or description contains a ticket
   key, e.g. `https://github.com/sharefile-org/ecommerce-api/pull/825`
   (title: `SFBILLING-336`).
2. Confirm the ticket key in the title is now a clickable link.
3. Confirm any ticket keys in the description body are also clickable
   links.
4. Click a link and confirm it opens `https://<your-jira-base>/browse/<KEY>`
   in a new tab.
5. Navigate to a different PR without a full page reload (click another PR
   link from the PR list) and confirm linking still works on the new page.
6. Change the Jira base URL in the options page, return to an already-open
   PR tab, and confirm links update to the new base URL within ~1 second
   without needing a manual page refresh.

## Releasing

1. Bump the version (updates `package.json` and `manifest.json` together,
   and creates a git tag/commit):
   ```bash
   npm version patch   # or: minor / major
   ```
2. Build the release zip:
   ```bash
   npm run package
   ```
   This creates `dist/github-jira-pr-linker-<version>.zip` containing
   `manifest.json`, `options.html`, and `src/` (requires the system `zip`
   CLI, standard on macOS/Linux).
3. Distribute the zip:
   - **Chrome Web Store**: upload the zip via the
     [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
     and submit for review.
   - **Internal-only**: share the zip directly; teammates load it via
     "Load unpacked" (after unzipping) on `chrome://extensions`.

## Project layout

```
jira-pr-linker/
├── manifest.json          # Manifest V3 config
├── options.html           # Options page UI
├── src/
│   ├── linker.js          # Regex-based ticket-key detection and link wrapping
│   ├── selectors.js        # Locates the PR title/description elements (with fallbacks)
│   ├── content.js          # Content-script orchestration + MutationObserver
│   └── options.js          # Options page logic (load/save via chrome.storage.sync)
├── tests/                  # Jest + jsdom unit tests
└── docs/superpowers/        # Design spec and implementation plan
```

## Scope

- Only the PR **title** and PR **description** (original post body) are
  scanned — not comments, issues, or commit messages.
- The ticket key pattern is a hardcoded regex, `[A-Z]+-\d+` — not
  user-configurable.
- Only the Jira base URL is configurable, via the Options page.
