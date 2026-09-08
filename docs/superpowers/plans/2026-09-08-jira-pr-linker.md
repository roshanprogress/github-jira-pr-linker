# Jira PR Linker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension that turns Jira ticket keys (e.g. `SFBILLING-336`) found in a GitHub PR's title and description into clickable links to a user-configured Jira instance.

**Architecture:** Two pure, testable DOM modules (`linker.js` for regex-matching/wrapping, `selectors.js` for locating the title/description elements with selector fallbacks) are combined by a content script (`content.js`) that reads config from `chrome.storage.sync`, does an initial scan, and re-scans on GitHub's SPA navigation via a debounced `MutationObserver`. An options page (`options.html` + `options.js`) lets the user set the Jira base URL. All logic modules use a dual CommonJS/browser-global export pattern so they run unmodified as Chrome content scripts (loaded via plain `<script>`-style manifest entries, no bundler) and are unit-testable with Jest + jsdom.

**Tech Stack:** Vanilla JavaScript (no framework, no bundler), Chrome Extension Manifest V3 APIs (`chrome.storage.sync`), Jest + jest-environment-jsdom for unit tests.

## Global Constraints

- Ticket key pattern is the hardcoded regex `[A-Z]+-\d+` (spec: "Ticket key pattern is a hardcoded generic regex").
- Jira base URL is configured via the extension's Options page and persisted with `chrome.storage.sync` (spec: "configurable via an extension Options page").
- Content script only runs on `https://github.com/*/pull/*` (spec: "Scope").
- Only the PR **title** and PR **description** (original post body, not comments) are scanned (spec: "Scope").
- Every occurrence of a matching ticket key is wrapped as a clickable link, not just one badge (spec: "Every matching occurrence... is wrapped in place").
- Links open in a new tab: `target="_blank" rel="noopener noreferrer"` (spec: "Links open the Jira ticket in a new tab").
- If no base URL is configured, the extension must silently do nothing on the GitHub page — no error banner injected into GitHub (spec: "Error Handling").
- Re-scans (via MutationObserver) must never wrap text that is already inside a `.jira-pr-linker-link` anchor (spec: "Double-wrapping protection").
- Manifest version is 3 (spec: "Architecture").

---

### Task 1: Project scaffolding and test harness

**Files:**
- Create: `package.json`
- Create: `manifest.json`
- Create: `.gitignore`
- Test: `tests/smoke.test.js`

**Interfaces:**
- Produces: a working `npm test` command (Jest + jsdom) that later tasks' tests will run under.
- Produces: `manifest.json` referencing `src/linker.js`, `src/selectors.js`, `src/content.js`, `options.html` — these files are created in later tasks but the manifest can reference their final paths now.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "jira-pr-linker",
  "version": "1.0.0",
  "private": true,
  "description": "Chrome extension that links Jira ticket keys found in GitHub PR titles and descriptions.",
  "scripts": {
    "test": "jest"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0"
  },
  "jest": {
    "testEnvironment": "jsdom"
  }
}
```

- [ ] **Step 2: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Jira PR Linker",
  "version": "1.0.0",
  "description": "Turns Jira ticket keys in GitHub PR titles and descriptions into clickable links.",
  "permissions": ["storage"],
  "options_page": "options.html",
  "content_scripts": [
    {
      "matches": ["https://github.com/*/pull/*"],
      "js": ["src/linker.js", "src/selectors.js", "src/content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 5: Write a smoke test**

Create `tests/smoke.test.js`:

```js
test('jsdom test environment provides a document', () => {
  document.body.innerHTML = '<div id="hello">world</div>';
  expect(document.getElementById('hello').textContent).toBe('world');
});
```

- [ ] **Step 6: Run the smoke test to verify the harness works**

Run: `npx jest tests/smoke.test.js -v`
Expected: PASS — 1 test passed.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json manifest.json .gitignore tests/smoke.test.js
git commit -m "chore: scaffold Jira PR Linker extension project and test harness"
```

---

### Task 2: Ticket-linking core (`linker.js`)

**Files:**
- Create: `src/linker.js`
- Test: `tests/linker.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `scanAndLink(rootElement, jiraBaseUrl, doc)` → returns `number` (count of links created). Wraps every `[A-Z]+-\d+` match inside `rootElement`'s text in an `<a class="jira-pr-linker-link" href="{base}/browse/{KEY}" target="_blank" rel="noopener noreferrer">{KEY}</a>`. No-ops (returns `0`) when `jiraBaseUrl` is falsy. Skips text nodes already inside a `.jira-pr-linker-link` element. Also exports `buildJiraUrl(baseUrl, ticketKey)` → `string`, `TICKET_PATTERN` (RegExp), and `LINK_CLASS` (string `"jira-pr-linker-link"`). Available both as CommonJS export (`module.exports`) and as `window.JiraPRLinker.scanAndLink` / `.buildJiraUrl` / `.TICKET_PATTERN` / `.LINK_CLASS`.

- [ ] **Step 1: Write the failing tests**

Create `tests/linker.test.js`:

```js
describe('scanAndLink', () => {
  let JiraPRLinker;

  beforeEach(() => {
    jest.resetModules();
    delete window.JiraPRLinker;
    JiraPRLinker = require('../src/linker.js');
  });

  test('wraps a single ticket key match in a link', () => {
    document.body.innerHTML = '<div id="root">Fixes SFBILLING-336 today</div>';
    const root = document.getElementById('root');

    const count = JiraPRLinker.scanAndLink(
      root,
      'https://progresssoftware.atlassian.net',
      document
    );

    expect(count).toBe(1);
    const link = root.querySelector('a.jira-pr-linker-link');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe(
      'https://progresssoftware.atlassian.net/browse/SFBILLING-336'
    );
    expect(link.textContent).toBe('SFBILLING-336');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  test('wraps multiple ticket keys in the same text node', () => {
    document.body.innerHTML = '<div id="root">SFBILLING-336 and SFCL-12 both apply</div>';
    const root = document.getElementById('root');

    const count = JiraPRLinker.scanAndLink(
      root,
      'https://progresssoftware.atlassian.net',
      document
    );

    expect(count).toBe(2);
    const links = root.querySelectorAll('a.jira-pr-linker-link');
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe('SFBILLING-336');
    expect(links[1].textContent).toBe('SFCL-12');
  });

  test('does nothing when no jiraBaseUrl is provided', () => {
    document.body.innerHTML = '<div id="root">SFBILLING-336</div>';
    const root = document.getElementById('root');

    const count = JiraPRLinker.scanAndLink(root, null, document);

    expect(count).toBe(0);
    expect(root.querySelector('a')).toBeNull();
  });

  test('does not re-wrap text already inside a jira-pr-linker-link', () => {
    document.body.innerHTML =
      '<div id="root"><a class="jira-pr-linker-link" href="x">SFBILLING-336</a></div>';
    const root = document.getElementById('root');

    const count = JiraPRLinker.scanAndLink(
      root,
      'https://progresssoftware.atlassian.net',
      document
    );

    expect(count).toBe(0);
    expect(root.querySelectorAll('a')).toHaveLength(1);
  });

  test('buildJiraUrl trims trailing slashes from the base URL', () => {
    expect(
      JiraPRLinker.buildJiraUrl('https://progresssoftware.atlassian.net/', 'SFBILLING-336')
    ).toBe('https://progresssoftware.atlassian.net/browse/SFBILLING-336');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/linker.test.js -v`
Expected: FAIL — `Cannot find module '../src/linker.js'`

- [ ] **Step 3: Write the implementation**

Create `src/linker.js`:

```js
(function (global) {
  const JiraPRLinker = global.JiraPRLinker || {};
  const TICKET_PATTERN = /[A-Z]+-\d+/g;
  const LINK_CLASS = 'jira-pr-linker-link';

  function buildJiraUrl(baseUrl, ticketKey) {
    const trimmed = baseUrl.replace(/\/+$/, '');
    return `${trimmed}/browse/${ticketKey}`;
  }

  function isInsideLink(node) {
    let el = node.parentElement;
    while (el) {
      if (el.classList && el.classList.contains(LINK_CLASS)) return true;
      el = el.parentElement;
    }
    return false;
  }

  function scanAndLink(root, jiraBaseUrl, doc) {
    if (!root || !jiraBaseUrl) return 0;
    const documentRef = doc || root.ownerDocument || document;
    let linkCount = 0;
    const textNodes = [];

    const walker = documentRef.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        TICKET_PATTERN.lastIndex = 0;
        if (!node.nodeValue || !TICKET_PATTERN.test(node.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (isInsideLink(node)) return NodeFilter.FILTER_REJECT;
        const parentTag = node.parentElement && node.parentElement.tagName;
        if (parentTag === 'SCRIPT' || parentTag === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let current;
    while ((current = walker.nextNode())) {
      textNodes.push(current);
    }

    textNodes.forEach((textNode) => {
      const text = textNode.nodeValue;
      TICKET_PATTERN.lastIndex = 0;
      const fragment = documentRef.createDocumentFragment();
      let lastIndex = 0;
      let match;
      let matchedAny = false;

      while ((match = TICKET_PATTERN.exec(text)) !== null) {
        matchedAny = true;
        const ticketKey = match[0];
        const matchStart = match.index;
        const matchEnd = matchStart + ticketKey.length;

        if (matchStart > lastIndex) {
          fragment.appendChild(documentRef.createTextNode(text.slice(lastIndex, matchStart)));
        }

        const anchor = documentRef.createElement('a');
        anchor.className = LINK_CLASS;
        anchor.href = buildJiraUrl(jiraBaseUrl, ticketKey);
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = ticketKey;
        fragment.appendChild(anchor);
        linkCount += 1;

        lastIndex = matchEnd;
      }

      if (!matchedAny) return;

      if (lastIndex < text.length) {
        fragment.appendChild(documentRef.createTextNode(text.slice(lastIndex)));
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    });

    return linkCount;
  }

  JiraPRLinker.scanAndLink = scanAndLink;
  JiraPRLinker.buildJiraUrl = buildJiraUrl;
  JiraPRLinker.TICKET_PATTERN = TICKET_PATTERN;
  JiraPRLinker.LINK_CLASS = LINK_CLASS;
  global.JiraPRLinker = JiraPRLinker;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { scanAndLink, buildJiraUrl, TICKET_PATTERN, LINK_CLASS };
  }
})(typeof window !== 'undefined' ? window : global);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/linker.test.js -v`
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/linker.js tests/linker.test.js
git commit -m "feat: add regex-based ticket-linking core module"
```

---

### Task 3: DOM selectors with fallback (`selectors.js`)

**Files:**
- Create: `src/selectors.js`
- Test: `tests/selectors.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `findTitleElement(doc)` → `Element|null`, `findDescriptionElement(doc)` → `Element|null`. Both try an ordered list of CSS selectors and return the first element in `doc` that matches any of them, or `null` if none match. Available both as CommonJS export and as `window.JiraPRLinker.findTitleElement` / `.findDescriptionElement`.

- [ ] **Step 1: Write the failing tests**

Create `tests/selectors.test.js`:

```js
describe('DOM selectors', () => {
  let JiraPRLinker;

  beforeEach(() => {
    jest.resetModules();
    delete window.JiraPRLinker;
    JiraPRLinker = require('../src/selectors.js');
  });

  test('finds the title element using the primary selector', () => {
    document.body.innerHTML = '<h1><bdi class="js-issue-title">SFBILLING-336 fix</bdi></h1>';
    const el = JiraPRLinker.findTitleElement(document);
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('SFBILLING-336 fix');
  });

  test('falls back to the secondary title selector', () => {
    document.body.innerHTML = '<h1><span class="js-issue-title">SFBILLING-336 fix</span></h1>';
    const el = JiraPRLinker.findTitleElement(document);
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('SFBILLING-336 fix');
  });

  test('returns null when no title selector matches', () => {
    document.body.innerHTML = '<h1><span class="something-else">no match</span></h1>';
    const el = JiraPRLinker.findTitleElement(document);
    expect(el).toBeNull();
  });

  test('finds the description element using the primary selector', () => {
    document.body.innerHTML =
      '<div class="timeline-comment-wrapper"><div class="comment-body">See SFCL-12</div></div>';
    const el = JiraPRLinker.findDescriptionElement(document);
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('See SFCL-12');
  });

  test('returns null when no description selector matches', () => {
    document.body.innerHTML = '<div class="something-else">no match</div>';
    const el = JiraPRLinker.findDescriptionElement(document);
    expect(el).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/selectors.test.js -v`
Expected: FAIL — `Cannot find module '../src/selectors.js'`

- [ ] **Step 3: Write the implementation**

Create `src/selectors.js`:

```js
(function (global) {
  const JiraPRLinker = global.JiraPRLinker || {};

  const TITLE_SELECTORS = [
    'bdi.js-issue-title',
    '.js-issue-title',
    '[data-testid="issue-title"]',
  ];

  const DESCRIPTION_SELECTORS = [
    '.timeline-comment-wrapper .comment-body',
    '.js-comment-body',
    '[data-testid="markdown-body"]',
  ];

  function findFirstMatch(doc, selectors) {
    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function findTitleElement(doc) {
    return findFirstMatch(doc, TITLE_SELECTORS);
  }

  function findDescriptionElement(doc) {
    return findFirstMatch(doc, DESCRIPTION_SELECTORS);
  }

  JiraPRLinker.findTitleElement = findTitleElement;
  JiraPRLinker.findDescriptionElement = findDescriptionElement;
  JiraPRLinker.TITLE_SELECTORS = TITLE_SELECTORS;
  JiraPRLinker.DESCRIPTION_SELECTORS = DESCRIPTION_SELECTORS;
  global.JiraPRLinker = JiraPRLinker;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      findTitleElement,
      findDescriptionElement,
      TITLE_SELECTORS,
      DESCRIPTION_SELECTORS,
    };
  }
})(typeof window !== 'undefined' ? window : global);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/selectors.test.js -v`
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/selectors.js tests/selectors.test.js
git commit -m "feat: add title/description selector lookup with fallbacks"
```

---

### Task 4: Content script orchestration with debounced MutationObserver (`content.js`)

**Files:**
- Create: `src/content.js`
- Test: `tests/content.test.js`

**Interfaces:**
- Consumes: `JiraPRLinker.scanAndLink(root, baseUrl, doc)` and `JiraPRLinker.findTitleElement(doc)` / `.findDescriptionElement(doc)` from Task 2 and Task 3 (same `window.JiraPRLinker` namespace object, populated because `manifest.json` loads `linker.js` then `selectors.js` then `content.js` in order into the same execution context).
- Produces: `init(options)` where `options` is `{ document, chrome, MutationObserver }` (all optional, defaulting to the real globals). Reads `jiraBaseUrl` from `chrome.storage.sync`, performs an initial scan of the title and description elements, sets up a debounced (200ms) `MutationObserver` on `document.body` that re-scans on DOM mutations, and listens for `chrome.storage.onChanged` to pick up a new base URL without a page reload. Also exports `runScan(doc)` and `scheduleScan(doc)` for direct testing. Available both as CommonJS export and as `window.JiraPRLinker.init` / `.runScan` / `.scheduleScan`. Auto-calls `init()` on load in a real browser, but skips auto-init when `window.__JIRA_PR_LINKER_TEST__` is truthy (set by tests before requiring the module).

- [ ] **Step 1: Write the failing tests**

Create `tests/content.test.js`:

```js
describe('content script init', () => {
  let JiraPRLinker;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    document.body.innerHTML =
      '<h1><bdi class="js-issue-title">SFBILLING-336 fix</bdi></h1>' +
      '<div class="timeline-comment-wrapper"><div class="comment-body">See SFCL-12</div></div>';

    window.__JIRA_PR_LINKER_TEST__ = true;
    delete window.JiraPRLinker;

    require('../src/linker.js');
    require('../src/selectors.js');
    JiraPRLinker = require('../src/content.js');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createChromeMock(initialUrl) {
    const listeners = [];
    return {
      storage: {
        sync: {
          get: jest.fn((keys, callback) => callback({ jiraBaseUrl: initialUrl })),
        },
        onChanged: {
          addListener: jest.fn((cb) => listeners.push(cb)),
        },
      },
      __triggerChange(newValue) {
        listeners.forEach((cb) => cb({ jiraBaseUrl: { newValue } }, 'sync'));
      },
    };
  }

  test('links tickets on init using the stored base URL', () => {
    const chromeMock = createChromeMock('https://progresssoftware.atlassian.net');

    JiraPRLinker.init({ document, chrome: chromeMock });
    jest.advanceTimersByTime(250);

    const links = document.querySelectorAll('a.jira-pr-linker-link');
    expect(links).toHaveLength(2);
  });

  test('does nothing when no base URL is stored', () => {
    const chromeMock = createChromeMock(null);

    JiraPRLinker.init({ document, chrome: chromeMock });
    jest.advanceTimersByTime(250);

    expect(document.querySelectorAll('a.jira-pr-linker-link')).toHaveLength(0);
  });

  test('re-scans after a storage change with the new base URL', () => {
    const chromeMock = createChromeMock(null);
    JiraPRLinker.init({ document, chrome: chromeMock });
    jest.advanceTimersByTime(250);
    expect(document.querySelectorAll('a.jira-pr-linker-link')).toHaveLength(0);

    chromeMock.__triggerChange('https://progresssoftware.atlassian.net');
    jest.advanceTimersByTime(250);

    expect(document.querySelectorAll('a.jira-pr-linker-link')).toHaveLength(2);
  });

  test('does nothing when chrome.storage is unavailable', () => {
    JiraPRLinker.init({ document, chrome: {} });
    jest.advanceTimersByTime(250);

    expect(document.querySelectorAll('a.jira-pr-linker-link')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/content.test.js -v`
Expected: FAIL — `Cannot find module '../src/content.js'`

- [ ] **Step 3: Write the implementation**

Create `src/content.js`:

```js
(function (global) {
  const JiraPRLinker = global.JiraPRLinker || {};

  const DEBOUNCE_MS = 200;
  let debounceTimer = null;
  let cachedBaseUrl = null;

  function runScan(doc) {
    const documentRef = doc || document;
    if (!cachedBaseUrl) return;
    const titleEl = JiraPRLinker.findTitleElement(documentRef);
    const descEl = JiraPRLinker.findDescriptionElement(documentRef);
    if (titleEl) JiraPRLinker.scanAndLink(titleEl, cachedBaseUrl, documentRef);
    if (descEl) JiraPRLinker.scanAndLink(descEl, cachedBaseUrl, documentRef);
  }

  function scheduleScan(doc) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runScan(doc), DEBOUNCE_MS);
  }

  function loadBaseUrlAndScan(storageArea, doc) {
    storageArea.get(['jiraBaseUrl'], (result) => {
      cachedBaseUrl = (result && result.jiraBaseUrl) || null;
      runScan(doc);
    });
  }

  function observeMutations(doc, observerCtor) {
    const ObserverImpl = observerCtor || global.MutationObserver;
    if (!ObserverImpl) return null;
    const observer = new ObserverImpl(() => scheduleScan(doc));
    observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
    return observer;
  }

  function init(options) {
    const opts = options || {};
    const doc = opts.document || document;
    const chromeRef = opts.chrome || global.chrome;

    if (!chromeRef || !chromeRef.storage || !chromeRef.storage.sync) return;

    loadBaseUrlAndScan(chromeRef.storage.sync, doc);
    observeMutations(doc, opts.MutationObserver);

    if (chromeRef.storage.onChanged) {
      chromeRef.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync' || !changes.jiraBaseUrl) return;
        cachedBaseUrl = changes.jiraBaseUrl.newValue || null;
        scheduleScan(doc);
      });
    }
  }

  JiraPRLinker.init = init;
  JiraPRLinker.runScan = runScan;
  JiraPRLinker.scheduleScan = scheduleScan;
  global.JiraPRLinker = JiraPRLinker;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { init, runScan, scheduleScan };
  }

  if (typeof window !== 'undefined' && !global.__JIRA_PR_LINKER_TEST__) {
    init();
  }
})(typeof window !== 'undefined' ? window : global);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/content.test.js -v`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/content.js tests/content.test.js
git commit -m "feat: wire up content script with debounced MutationObserver and storage sync"
```

---

### Task 5: Options page (`options.html` + `options.js`)

**Files:**
- Create: `options.html`
- Create: `src/options.js`
- Test: `tests/options.test.js`

**Interfaces:**
- Consumes: nothing from other tasks (standalone page).
- Produces: `initOptionsPage(doc, chromeRef)` which wires up the `#jiraBaseUrl` input and `#save` button to `chrome.storage.sync`. Also exports `loadSavedUrl(storageArea, inputEl)` and `saveUrl(storageArea, inputEl, statusEl)`. Available both as CommonJS export and as `window.JiraPRLinkerOptions`. Auto-runs `initOptionsPage(document, window.chrome)` on `DOMContentLoaded` in a real browser, but skips auto-run when `window.__JIRA_PR_LINKER_TEST__` is truthy.

- [ ] **Step 1: Write the failing tests**

Create `tests/options.test.js`:

```js
describe('options page', () => {
  let OptionsPage;

  beforeEach(() => {
    jest.resetModules();
    window.__JIRA_PR_LINKER_TEST__ = true;
    document.body.innerHTML = `
      <input type="text" id="jiraBaseUrl" />
      <button id="save">Save</button>
      <div id="status"></div>
    `;
    OptionsPage = require('../src/options.js');
  });

  function createChromeMock(storedUrl) {
    const store = { jiraBaseUrl: storedUrl };
    return {
      storage: {
        sync: {
          get: jest.fn((keys, callback) => callback({ jiraBaseUrl: store.jiraBaseUrl })),
          set: jest.fn((values, callback) => {
            store.jiraBaseUrl = values.jiraBaseUrl;
            if (callback) callback();
          }),
        },
      },
      __store: store,
    };
  }

  test('loads the saved URL into the input field', () => {
    const chromeMock = createChromeMock('https://progresssoftware.atlassian.net');
    OptionsPage.initOptionsPage(document, chromeMock);

    expect(document.getElementById('jiraBaseUrl').value).toBe(
      'https://progresssoftware.atlassian.net'
    );
  });

  test('leaves the input empty when nothing is saved yet', () => {
    const chromeMock = createChromeMock(null);
    OptionsPage.initOptionsPage(document, chromeMock);

    expect(document.getElementById('jiraBaseUrl').value).toBe('');
  });

  test('saves the trimmed URL when Save is clicked', () => {
    const chromeMock = createChromeMock('');
    OptionsPage.initOptionsPage(document, chromeMock);

    const input = document.getElementById('jiraBaseUrl');
    input.value = 'https://progresssoftware.atlassian.net/';
    document.getElementById('save').click();

    expect(chromeMock.__store.jiraBaseUrl).toBe('https://progresssoftware.atlassian.net');
    expect(document.getElementById('status').textContent).toBe('Saved!');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/options.test.js -v`
Expected: FAIL — `Cannot find module '../src/options.js'`

- [ ] **Step 3: Write the implementation**

Create `src/options.js`:

```js
(function (global) {
  function loadSavedUrl(storageArea, inputEl) {
    storageArea.get(['jiraBaseUrl'], (result) => {
      inputEl.value = (result && result.jiraBaseUrl) || '';
    });
  }

  function saveUrl(storageArea, inputEl, statusEl) {
    const value = inputEl.value.trim().replace(/\/+$/, '');
    storageArea.set({ jiraBaseUrl: value }, () => {
      statusEl.textContent = 'Saved!';
      setTimeout(() => {
        statusEl.textContent = '';
      }, 1500);
    });
  }

  function initOptionsPage(doc, chromeRef) {
    const inputEl = doc.getElementById('jiraBaseUrl');
    const saveButton = doc.getElementById('save');
    const statusEl = doc.getElementById('status');

    loadSavedUrl(chromeRef.storage.sync, inputEl);

    saveButton.addEventListener('click', () => {
      saveUrl(chromeRef.storage.sync, inputEl, statusEl);
    });
  }

  const OptionsPage = { loadSavedUrl, saveUrl, initOptionsPage };
  global.JiraPRLinkerOptions = OptionsPage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptionsPage;
  }

  if (typeof document !== 'undefined' && !global.__JIRA_PR_LINKER_TEST__) {
    document.addEventListener('DOMContentLoaded', () => {
      initOptionsPage(document, global.chrome);
    });
  }
})(typeof window !== 'undefined' ? window : global);
```

- [ ] **Step 4: Create `options.html`**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Jira PR Linker Options</title>
    <style>
      body { font-family: sans-serif; padding: 16px; width: 320px; }
      label { display: block; margin-bottom: 4px; font-weight: bold; }
      input[type="text"] { width: 100%; padding: 6px; box-sizing: border-box; }
      button { margin-top: 12px; padding: 6px 12px; }
      #status { margin-top: 8px; color: green; font-size: 12px; }
    </style>
  </head>
  <body>
    <label for="jiraBaseUrl">Jira base URL</label>
    <input type="text" id="jiraBaseUrl" placeholder="https://progresssoftware.atlassian.net" />
    <button id="save">Save</button>
    <div id="status"></div>
    <script src="src/options.js"></script>
  </body>
</html>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest tests/options.test.js -v`
Expected: PASS — 3 tests passed.

- [ ] **Step 6: Commit**

```bash
git add options.html src/options.js tests/options.test.js
git commit -m "feat: add options page for configuring the Jira base URL"
```

---

### Task 6: Full test suite, README, and manual browser verification

**Files:**
- Create: `README.md`
- Modify: none (verification only)

**Interfaces:**
- Consumes: the complete extension from Tasks 1–5.
- Produces: a `README.md` with load-and-configure instructions for a human tester, and a manual verification pass confirming the extension behaves correctly in real Chrome (something a unit test cannot cover).

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: PASS — all suites (`smoke`, `linker`, `selectors`, `content`, `options`) pass, 0 failures.

- [ ] **Step 2: Write `README.md`**

```markdown
# Jira PR Linker

Chrome extension that turns Jira ticket keys (e.g. `SFBILLING-336`) in a
GitHub pull request's title and description into clickable links to your
Jira instance.

## Load the extension in Chrome

1. Run `npm install` then `npm test` to confirm all tests pass.
2. Open `chrome://extensions` in Chrome.
3. Enable "Developer mode" (top-right toggle).
4. Click "Load unpacked" and select this project's root folder.

## Configure your Jira base URL

1. On `chrome://extensions`, find "Jira PR Linker" and click "Details".
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
```

- [ ] **Step 3: Manually verify in Chrome**

Follow the steps in `README.md` against a real GitHub PR (e.g. the one
from the screenshot: `github.com/sharefile-org/ecommerce-api/pull/825`,
title `SFBILLING-336`). Confirm:
- The title's `SFBILLING-336` becomes a clickable link.
- Any ticket keys in the description become clickable links.
- Clicking a link opens the correct Jira URL in a new tab.
- Navigating to another PR (SPA navigation, no full reload) still links
  correctly.
- Changing the base URL in Options updates links without a manual reload.

Expected: all checks pass. If a selector doesn't match GitHub's current
markup, add the observed selector to `TITLE_SELECTORS` or
`DESCRIPTION_SELECTORS` in `src/selectors.js`, add a regression test in
`tests/selectors.test.js` for that markup shape, and re-run `npm test`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with load and verification instructions"
```
