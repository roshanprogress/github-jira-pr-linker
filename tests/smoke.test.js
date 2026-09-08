test('jsdom test environment provides a document', () => {
  document.body.innerHTML = '<div id="hello">world</div>';
  expect(document.getElementById('hello').textContent).toBe('world');
});
