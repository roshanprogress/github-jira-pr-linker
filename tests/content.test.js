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

  test('rebuilds existing links when the base URL changes to a different non-null value', () => {
    const chromeMock = createChromeMock('https://old.atlassian.net');

    JiraPRLinker.init({ document, chrome: chromeMock });
    jest.advanceTimersByTime(250);

    const beforeLinks = document.querySelectorAll('a.jira-pr-linker-link');
    expect(beforeLinks.length).toBeGreaterThan(0);
    beforeLinks.forEach((link) => {
      expect(link.getAttribute('href')).toMatch(/^https:\/\/old\.atlassian\.net\/browse\//);
    });

    chromeMock.__triggerChange('https://progresssoftware.atlassian.net');
    jest.advanceTimersByTime(250);

    const afterLinks = document.querySelectorAll('a.jira-pr-linker-link');
    expect(afterLinks.length).toBe(beforeLinks.length);
    afterLinks.forEach((link) => {
      expect(link.getAttribute('href')).toMatch(
        /^https:\/\/progresssoftware\.atlassian\.net\/browse\//
      );
    });
  });

  test('an onChanged event that arrives before the initial storage.get() callback is not clobbered', () => {
    let resolveGet;
    const listeners = [];
    const chromeMock = {
      storage: {
        sync: {
          get: jest.fn((keys, callback) => {
            resolveGet = () => callback({ jiraBaseUrl: 'https://old.atlassian.net' });
          }),
        },
        onChanged: {
          addListener: jest.fn((cb) => listeners.push(cb)),
        },
      },
    };

    JiraPRLinker.init({ document, chrome: chromeMock });

    listeners.forEach((cb) =>
      cb({ jiraBaseUrl: { newValue: 'https://progresssoftware.atlassian.net' } }, 'sync')
    );
    jest.advanceTimersByTime(250);

    resolveGet();
    jest.advanceTimersByTime(250);

    const links = document.querySelectorAll('a.jira-pr-linker-link');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link.getAttribute('href')).toMatch(
        /^https:\/\/progresssoftware\.atlassian\.net\/browse\//
      );
    });
  });

  test('does nothing when chrome.storage is unavailable', () => {
    JiraPRLinker.init({ document, chrome: {} });
    jest.advanceTimersByTime(250);

    expect(document.querySelectorAll('a.jira-pr-linker-link')).toHaveLength(0);
  });
});
