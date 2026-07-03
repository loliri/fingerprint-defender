// Isolated world script to sync settings and seed to sessionStorage

// Sync or generate seed for this domain (only in top frame to avoid race conditions)
(function () {
  const domain = window.location.hostname;
  const isTopFrame = window === window.top;

  if (isTopFrame) {
    // Top frame: generate seed if needed
    chrome.storage.local.get(['domainSeeds'], (result) => {
      let domainSeeds = result.domainSeeds || {};

      if (!domainSeeds[domain]) {
        domainSeeds[domain] = Math.floor(Math.random() * 4294967296);
        chrome.storage.local.set({ domainSeeds }, () => {
          dispatchSeedReady(domainSeeds[domain]);
        });
      } else {
        dispatchSeedReady(domainSeeds[domain]);
      }
    });
  } else {
    // iframe: just read existing seed
    chrome.storage.local.get(['domainSeeds'], (result) => {
      let domainSeeds = result.domainSeeds || {};
      if (domainSeeds[domain]) {
        dispatchSeedReady(domainSeeds[domain]);
      }
    });
  }

  function dispatchSeedReady(seed) {
    try {
      sessionStorage.setItem('fpDefenderSeed', seed.toString());
    } catch (e) {
      // sessionStorage might not be available
    }

    // Dispatch custom event to notify MAIN world
    document.documentElement.setAttribute('data-fp-seed', seed.toString());
    document.documentElement.dispatchEvent(new CustomEvent('fpDefenderSeedReady', {
      detail: { seed: seed }
    }));
  }
})();

// Sync settings
chrome.storage.local.get({
  canvas: true,
  font: false,
  audioContext: true,
  webgl: true,
  webgpu: false,
  clientRects: false
}, (settings) => {
  try {
    sessionStorage.setItem('fpDefenderSettings', JSON.stringify(settings));
  } catch (e) {
    // sessionStorage might not be available
  }

  // Dispatch settings ready event
  document.documentElement.setAttribute('data-fp-settings', JSON.stringify(settings));
  document.documentElement.dispatchEvent(new CustomEvent('fpDefenderSettingsReady', {
    detail: { settings: settings }
  }));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    chrome.storage.local.get({
      canvas: true,
      font: false,
      audioContext: true,
      webgl: true,
      webgpu: false,
      clientRects: false
    }, (settings) => {
      try {
        sessionStorage.setItem('fpDefenderSettings', JSON.stringify(settings));
      } catch (e) {
        // sessionStorage might not be available
      }

      // Update data attribute for future access
      document.documentElement.setAttribute('data-fp-settings', JSON.stringify(settings));
    });
  }
});
