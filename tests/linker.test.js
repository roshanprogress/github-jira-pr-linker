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
