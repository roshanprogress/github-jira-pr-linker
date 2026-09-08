(function (global) {
  const JiraPRLinker = global.JiraPRLinker || {};

  const TITLE_SELECTORS = [
    'bdi.js-issue-title',
    '.js-issue-title',
    '[data-testid="issue-title"]',
    '.markdown-title',
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
