# Jira PR Linker — Chrome Extension Design

## Purpose

GitHub PR titles and descriptions often contain Jira ticket keys (e.g.
`SFBILLING-336`) as plain text. This extension automatically turns those
keys into clickable links to the corresponding Jira ticket, using a
user-configured Jira base URL.

## Scope

- Detects ticket keys in the PR **title** and PR **description** (the
  original post body, not comments) on `github.com/*/pull/*` pages.
- Ticket key pattern is a hardcoded generic regex: `[A-Z]+-\d+`
  (matches any Jira project key, e.g. `SFBILLING-336`, `SFCL-12`).
- Jira base URL is configurable via an extension Options page and
  persisted with `chrome.storage.sync`.
- Every matching occurrence of the pattern is wrapped in place as a
  clickable link (not just a single badge).
- Links open the Jira ticket in a new tab.
- Out of scope (for this version): issues pages, PR comments, commit
  messages, branch names, other Git hosts.

## Architecture

Manifest V3 Chrome extension with three pieces:

1. **Content script (`content.js`)**
   - Injected on `https://github.com/*/pull/*`.
   - Reads `jiraBaseUrl` from `chrome.storage.sync` on load.
   - Locates the PR title node and the PR description body node using a
     primary CSS selector with a small list of fallback selectors (to
     tolerate minor GitHub markup changes).
   - Walks the text nodes within those containers, applies the regex,
     and replaces each match with an `<a class="jira-pr-linker-link">`
     pointing to `{jiraBaseUrl}/browse/{TICKET-KEY}`, `target="_blank"`,
     `rel="noopener noreferrer"`.
   - Skips text nodes that are already inside a
     `.jira-pr-linker-link` element, so re-scans don't double-wrap.
   - If `jiraBaseUrl` is not configured, the script does nothing (no
     links are created; no error shown on the GitHub page itself).

2. **MutationObserver**
   - GitHub is a single-page app (Turbo/PJAX navigation), so the
     extension observes `document.body` for subtree mutations.
   - On mutation, re-runs the scan-and-wrap routine (debounced ~200ms)
     so it also works after client-side navigation between PRs, and
     after the description is edited/re-rendered.
   - Observer is disconnected and content is fully re-scanned only for
     relevant containers to avoid unnecessary work; the double-wrap
     guard keeps re-scans idempotent.

3. **Options page (`options.html` + `options.js`)**
   - Single text input for the Jira base URL (e.g.
     `https://progresssoftware.atlassian.net`).
   - "Save" button persists the value via `chrome.storage.sync.set`.
   - Content script listens for `chrome.storage.onChanged` and re-scans
     immediately when the base URL changes, without requiring a page
     reload.

4. **Manifest (`manifest.json`)**
   - `manifest_version: 3`
   - `permissions: ["storage"]`
   - `content_scripts`: matches `https://github.com/*/pull/*`
   - `options_page: "options.html"`

## Data Flow

1. User opens/navigates to a GitHub PR page.
2. Content script loads, reads `jiraBaseUrl` from storage.
3. Script finds title/description containers, scans text nodes for
   `[A-Z]+-\d+` matches, and replaces matches with clickable anchors.
4. MutationObserver watches for further DOM changes (SPA navigation,
   description edits) and re-runs the scan, skipping already-linked
   text.
5. User clicks a link → Jira ticket opens in a new tab.
6. If the user updates the Jira base URL in Options, the content
   script re-scans using the new URL (existing links get rebuilt with
   the new base).

## Error Handling

- **No base URL configured:** skip linking entirely; nothing is
  broken on the GitHub page. (No inline error banner on GitHub itself,
  to avoid visual noise — the absence of links is the signal.)
- **Selector drift** (GitHub changes class names): content script tries
  a small ordered list of fallback selectors for the title and
  description containers; if none match, it silently no-ops for that
  page load rather than throwing.
- **No network calls** are made by the extension itself (it just
  constructs a URL), so there are no network failure modes to handle.
- **Double-wrapping protection:** any text node already inside a
  `.jira-pr-linker-link` anchor is skipped during re-scans.

## Testing

- Manual testing: load the extension unpacked in Chrome
  (`chrome://extensions` → "Load unpacked"), configure a Jira base URL
  in Options, and visit a real GitHub PR (e.g. the one in the
  screenshot: `github.com/sharefile-org/ecommerce-api/pull/825`) to
  confirm the title and description ticket keys become clickable links
  opening the correct Jira URL in a new tab.
- Local static fixtures: one or two small local HTML files that mimic
  GitHub's PR title/description DOM structure, used to quickly verify
  the regex-matching and text-node-wrapping logic without needing to
  load real GitHub pages for every change.
- Manual regression check for the MutationObserver: navigate between
  two different PRs within the same tab (simulating SPA navigation) and
  confirm links still appear correctly and are not duplicated.

## File Layout

```
jira-pr-linker/
├── manifest.json
├── content.js
├── options.html
├── options.js
├── icons/ (optional, can be added later)
└── docs/superpowers/specs/2026-09-08-jira-pr-linker-design.md
```
