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
