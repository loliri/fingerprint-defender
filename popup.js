// Popup script with auto-reload

// Function to get WebGL info and fingerprint hash from active tab
function updateFingerprintInfo() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        world: 'MAIN',  // Execute in MAIN world to get spoofed values
        func: () => {
          try {
            // Get WebGL renderer (this will return the spoofed value)
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            let renderer = '不可用';

            if (gl) {
              const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
              if (debugInfo) {
                renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
              } else {
                renderer = gl.getParameter(gl.RENDERER) || '未知';
              }
            }

            // Calculate fingerprint hash (simple implementation)
            const fingerprintData = {
              userAgent: navigator.userAgent,
              language: navigator.language,
              platform: navigator.platform,
              renderer: renderer,
              vendor: gl ? gl.getParameter(gl.VENDOR) : '',
              hardwareConcurrency: navigator.hardwareConcurrency,
              deviceMemory: navigator.deviceMemory,
              screenResolution: `${screen.width}x${screen.height}`,
              colorDepth: screen.colorDepth,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };

            // Simple hash function
            const hashString = JSON.stringify(fingerprintData);
            let hash = 0;
            for (let i = 0; i < hashString.length; i++) {
              const chr = hashString.charCodeAt(i);
              hash = ((hash << 5) - hash) + chr;
              hash |= 0;
            }
            const hashHex = (hash >>> 0).toString(16).padStart(8, '0');

            return { renderer, hash: hashHex };
          } catch (e) {
            return { renderer: '获取失败', hash: '计算失败' };
          }
        }
      }, (results) => {
        if (chrome.runtime.lastError) {
          // Handle error (e.g., chrome:// pages where scripts can't run)
          document.getElementById('webglRenderer').textContent = '无法访问';
          document.getElementById('fingerprintHash').textContent = 'N/A';
          return;
        }

        if (results && results[0] && results[0].result) {
          const { renderer, hash } = results[0].result;
          document.getElementById('webglRenderer').textContent = renderer;
          document.getElementById('fingerprintHash').textContent = hash;
        } else {
          document.getElementById('webglRenderer').textContent = '无法获取';
          document.getElementById('fingerprintHash').textContent = '无法计算';
        }
      });
    } else {
      document.getElementById('webglRenderer').textContent = '无活动标签页';
      document.getElementById('fingerprintHash').textContent = 'N/A';
    }
  });
}

// Update fingerprint info when popup opens
updateFingerprintInfo();

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
