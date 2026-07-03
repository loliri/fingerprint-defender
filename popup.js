// Popup script with auto-reload

// Load current settings
chrome.storage.local.get({
  canvas: true,
  font: false,
  audioContext: true,
  webgl: true,
  webgpu: false,
  clientRects: false
}, (settings) => {
  document.getElementById('canvas').checked = settings.canvas;
  document.getElementById('font').checked = settings.font;
  document.getElementById('audioContext').checked = settings.audioContext;
  document.getElementById('webgl').checked = settings.webgl;
  document.getElementById('webgpu').checked = settings.webgpu;
  document.getElementById('clientRects').checked = settings.clientRects;
});

// Save settings and reload active tab when toggles change
const toggles = ['canvas', 'font', 'audioContext', 'webgl', 'webgpu', 'clientRects'];

toggles.forEach(id => {
  document.getElementById(id).addEventListener('change', (e) => {
    // Save the new setting
    chrome.storage.local.set({
      [id]: e.target.checked
    }, () => {
      // Reload the active tab after setting is saved
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
    });
  });
});

// Reset Defaults button - sets to default values
document.getElementById('resetBtn').addEventListener('click', () => {
  const defaultSettings = {
    canvas: true,
    font: false,
    audioContext: true,
    webgl: true,
    webgpu: false,
    clientRects: false
  };

  // Update checkboxes
  document.getElementById('canvas').checked = defaultSettings.canvas;
  document.getElementById('font').checked = defaultSettings.font;
  document.getElementById('audioContext').checked = defaultSettings.audioContext;
  document.getElementById('webgl').checked = defaultSettings.webgl;
  document.getElementById('webgpu').checked = defaultSettings.webgpu;
  document.getElementById('clientRects').checked = defaultSettings.clientRects;

  // Save settings
  chrome.storage.local.set(defaultSettings, () => {
    // Reload active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  });
});

// Test Protection button - opens browserleaks.com
document.getElementById('testBtn').addEventListener('click', () => {
  chrome.tabs.create({
    url: 'https://browserleaks.com'
  });
});

// Refresh Seed button - deletes seed for current domain
document.getElementById('refreshSeedBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      try {
        const url = new URL(tabs[0].url);
        const domain = url.hostname;

        // Send message to background to delete this domain's seed
        chrome.runtime.sendMessage({
          action: 'refreshSeed',
          domain: domain
        }, (response) => {
          if (response && response.success) {
            // Show success message or just close popup
            window.close();
          }
        });
      } catch (e) {
        console.error('Cannot refresh seed for this page:', e);
      }
    }
  });
});
