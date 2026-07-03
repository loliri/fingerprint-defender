// Isolated world script to sync settings and seed to sessionStorage

// Sync settings
chrome.storage.local.get({
  canvas: true,
  font: true,
  audioContext: true,
  webgl: true,
  webgpu: true,
  clientRects: true
}, (settings) => {
  try {
    sessionStorage.setItem('fpDefenderSettings', JSON.stringify(settings));
  } catch (e) {
    // sessionStorage might not be available
  }
});

// Sync or generate seed for this domain (only in top frame to avoid race conditions)
(function () {
  const domain = window.location.hostname;

  // Only generate seed in the top-level frame to avoid race conditions
  const isTopFrame = window === window.top;

  if (isTopFrame) {
    // Top frame: generate seed if needed
    chrome.storage.local.get(['domainSeeds'], (result) => {
      let domainSeeds = result.domainSeeds || {};

      if (!domainSeeds[domain]) {
        domainSeeds[domain] = Math.floor(Math.random() * 4294967296);
        chrome.storage.local.set({ domainSeeds }, () => {
          try {
            sessionStorage.setItem('fpDefenderSeed', domainSeeds[domain].toString());
          } catch (e) {
            // sessionStorage might not be available
          }
        });
      } else {
        try {
          sessionStorage.setItem('fpDefenderSeed', domainSeeds[domain].toString());
        } catch (e) {
          // sessionStorage might not be available
        }
      }
    });
  } else {
    // iframe: just read existing seed
    chrome.storage.local.get(['domainSeeds'], (result) => {
      let domainSeeds = result.domainSeeds || {};
      if (domainSeeds[domain]) {
        try {
          sessionStorage.setItem('fpDefenderSeed', domainSeeds[domain].toString());
        } catch (e) {
          // sessionStorage might not be available
        }
      }
    });
  }
})();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    chrome.storage.local.get({
      canvas: true,
      font: true,
      audioContext: true,
      webgl: true,
      webgpu: true,
      clientRects: true
    }, (settings) => {
      try {
        sessionStorage.setItem('fpDefenderSettings', JSON.stringify(settings));
      } catch (e) {
        // sessionStorage might not be available
      }
    });
  }
});
