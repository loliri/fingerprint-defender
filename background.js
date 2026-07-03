// Background service worker for Fingerprint Defender

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    canvas: true,
    font: false,
    audioContext: true,
    webgl: true,
    webgpu: false,
    clientRects: false
  });

  // Create context menu for extension icon
  chrome.contextMenus.create({
    id: 'refreshFingerprint',
    title: '刷新指纹（需手动刷新页面）',
    contexts: ['action']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'refreshFingerprint' && tab) {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname;

      // Delete the seed for this domain
      chrome.storage.local.get(['domainSeeds'], (result) => {
        let domainSeeds = result.domainSeeds || {};

        if (domainSeeds[domain]) {
          delete domainSeeds[domain];
          chrome.storage.local.set({ domainSeeds });
        }
        // Don't auto-reload, let user refresh manually
      });
    } catch (e) {
      console.error('Cannot refresh fingerprint for this page:', e);
    }
  }
});

// Handle refresh seed requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'refreshSeed' && request.domain) {
    chrome.storage.local.get(['domainSeeds'], (result) => {
      let domainSeeds = result.domainSeeds || {};

      // Delete the seed for this domain
      if (domainSeeds[request.domain]) {
        delete domainSeeds[request.domain];
        chrome.storage.local.set({ domainSeeds }, () => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: true, message: 'No seed found for this domain' });
      }
    });

    // Return true to indicate async response
    return true;
  }
});
