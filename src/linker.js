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
