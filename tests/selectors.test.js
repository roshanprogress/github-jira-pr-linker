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
