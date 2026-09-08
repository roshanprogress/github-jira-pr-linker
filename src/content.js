(function (global) {
  console.log('[GitHub Jira PR Linker] content script loaded');
  const JiraPRLinker = global.JiraPRLinker || {};
  const previousState = global.__JIRA_PR_LINKER_STATE__;

  if (previousState) {
    if (previousState.debounceTimer) {
      clearTimeout(previousState.debounceTimer);
    }
    if (previousState.observer && typeof previousState.observer.disconnect === 'function') {
      previousState.observer.disconnect();
    }
  }

  const state = {
    debounceTimer: null,
    observer: null,
    initialLoadPending: false,
  };
  global.__JIRA_PR_LINKER_STATE__ = state;

  const DEBOUNCE_MS = 200;
  let cachedBaseUrl = null;

  function refreshExistingLinks(root, baseUrl) {
    if (!root || !baseUrl) return;

    const anchors = root.querySelectorAll('a.' + JiraPRLinker.LINK_CLASS);
    anchors.forEach((anchor) => {
      anchor.href = JiraPRLinker.buildJiraUrl(baseUrl, anchor.textContent);
    });
  }

  const OBSERVER_OPTIONS = {
    childList: true,
    subtree: true,
    characterData: true,
  };

  // GitHub's own JS (relative timestamps, reactions, lazy-loaded widgets)
  // mutates large parts of the page continuously. Observing the whole
  // <body> means every one of those unrelated changes triggers a rescan.
  // Once we know where the title/description live, narrow observation to
  // their common container so unrelated page churn is ignored.
  function closestCommonAncestor(nodeA, nodeB) {
    const ancestors = new Set();
    for (let el = nodeA; el; el = el.parentElement) {
      ancestors.add(el);
    }
    for (let el = nodeB; el; el = el.parentElement) {
      if (ancestors.has(el)) return el;
    }
    return null;
  }

  function findScanRoot(documentRef, titleEl, descriptionEl) {
    if (titleEl && descriptionEl) {
      const common = closestCommonAncestor(titleEl, descriptionEl);
      if (common) return common;
    }
    return titleEl || descriptionEl || documentRef.body;
  }

  function runScan(doc) {
    const documentRef = doc || document;
    if (!cachedBaseUrl) {
      console.log('[GitHub Jira PR Linker] runScan skipped: no jiraBaseUrl configured (check options page)');
      return;
    }

    const titleEl = JiraPRLinker.findTitleElement(documentRef);
    const descriptionEl = JiraPRLinker.findDescriptionElement(documentRef);

    // Our own DOM edits below (wrapping ticket text in <a> tags) would
    // otherwise re-trigger the MutationObserver and cause a scan loop.
    // Pause observation while we mutate, then resume on a narrower root.
    if (state.observer) {
      state.observer.disconnect();
    }

    let titleCount = 0;
    let descriptionCount = 0;

    if (titleEl) {
      refreshExistingLinks(titleEl, cachedBaseUrl);
      titleCount = JiraPRLinker.scanAndLink(titleEl, cachedBaseUrl, documentRef);
    }

    if (descriptionEl) {
      refreshExistingLinks(descriptionEl, cachedBaseUrl);
      descriptionCount = JiraPRLinker.scanAndLink(descriptionEl, cachedBaseUrl, documentRef);
    }

    if (titleCount > 0 || descriptionCount > 0) {
      console.log('[GitHub Jira PR Linker] scan complete', {
        baseUrl: cachedBaseUrl,
        titleFound: !!titleEl,
        descriptionFound: !!descriptionEl,
        titleLinksAdded: titleCount,
        descriptionLinksAdded: descriptionCount,
      });
    }

    if (state.observer) {
      const root = findScanRoot(documentRef, titleEl, descriptionEl);
      if (root) {
        state.observer.observe(root, OBSERVER_OPTIONS);
      }
    }
  }

  function scheduleScan(doc) {
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }

    state.debounceTimer = setTimeout(() => {
      state.debounceTimer = null;
      runScan(doc);
    }, DEBOUNCE_MS);
  }

  function loadBaseUrlAndScan(storageArea, doc) {
    storageArea.get(['jiraBaseUrl'], (result) => {
      if (state.initialLoadPending) {
        cachedBaseUrl = (result && result.jiraBaseUrl) || null;
      }
      state.initialLoadPending = false;
      runScan(doc);
    });
  }

  function observeMutations(doc, ObserverCtor) {
    const ObserverImpl = ObserverCtor || global.MutationObserver;
    if (!ObserverImpl || !doc.body) return null;

    const observer = new ObserverImpl(() => scheduleScan(doc));
    observer.observe(doc.body, OBSERVER_OPTIONS);

    state.observer = observer;

    return observer;
  }

  function init(options) {
    const opts = options || {};
    const doc = opts.document || document;
    const chromeRef = opts.chrome || global.chrome;

    if (!chromeRef || !chromeRef.storage || !chromeRef.storage.sync) return;

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }
    if (state.observer && typeof state.observer.disconnect === 'function') {
      state.observer.disconnect();
      state.observer = null;
    }

    state.initialLoadPending = true;
    loadBaseUrlAndScan(chromeRef.storage.sync, doc);
    observeMutations(doc, opts.MutationObserver);

    if (chromeRef.storage.onChanged && typeof chromeRef.storage.onChanged.addListener === 'function') {
      chromeRef.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync' || !changes || !changes.jiraBaseUrl) return;
        cachedBaseUrl = changes.jiraBaseUrl.newValue || null;
        state.initialLoadPending = false;
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
