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
