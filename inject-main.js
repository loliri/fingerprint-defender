// Fingerprint Defender - Main Injection Script

(function () {
  let settings = {
    canvas: true,
    font: true,
    audioContext: true,
    webgl: true,
    webgpu: true,
    clientRects: true
  };

  try {
    const stored = sessionStorage.getItem('fpDefenderSettings');
    if (stored) {
      settings = JSON.parse(stored);
    }
  } catch (e) {
    // Use defaults
  }

  // Per-origin seed (falls back to a one-off random seed if not provided,
  // e.g. if isolated-world injection hasn't run yet for some reason).
  let seed = Math.floor(Math.random() * 4294967296);
  try {
    const storedSeed = sessionStorage.getItem('fpDefenderSeed');
    if (storedSeed !== null) {
      seed = parseInt(storedSeed, 10);
    }
  } catch (e) {
    // Use the one-off seed
  }

  // ============================================================================
  // SEEDED PRNG — deterministic per (seed, label) pair
  //
  // Rather than a single mutable random stream (which drifts out of sync the
  // moment call order/count differs between page loads — e.g. a canvas
  // resized, or two scripts racing to call getParameter in different orders),
  // each noised value derives its randomness from a hash of the seed plus a
  // label identifying *that specific value*. Same seed + same label always
  // gives the same number, regardless of when or how many times it's called.
  // ============================================================================
  function seededRandom(label) {
    // FNV-1a style string hash, mixed with the seed
    let h = (seed ^ 0x811c9dc5) >>> 0;
    const s = String(label);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    // Final avalanche mix, then map to [0, 1)
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 3266489917) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ============================================================================
  // CANVAS FINGERPRINT DEFENDER
  // ============================================================================
  if (settings.canvas) {
    const getImageData = CanvasRenderingContext2D.prototype.getImageData;

    const noisify = function (canvas, context) {
      if (context) {
        const shift = {
          'r': Math.floor(seededRandom('canvas-r') * 10) - 5,
          'g': Math.floor(seededRandom('canvas-g') * 10) - 5,
          'b': Math.floor(seededRandom('canvas-b') * 10) - 5,
          'a': Math.floor(seededRandom('canvas-a') * 10) - 5
        };

        const width = canvas.width;
        const height = canvas.height;

        if (width && height) {
          const imageData = getImageData.apply(context, [0, 0, width, height]);

          for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
              const n = ((i * (width * 4)) + (j * 4));
              imageData.data[n + 0] = imageData.data[n + 0] + shift.r;
              imageData.data[n + 1] = imageData.data[n + 1] + shift.g;
              imageData.data[n + 2] = imageData.data[n + 2] + shift.b;
              imageData.data[n + 3] = imageData.data[n + 3] + shift.a;
            }
          }

          context.putImageData(imageData, 0, 0);
        }
      }
    };

    HTMLCanvasElement.prototype.toBlob = new Proxy(HTMLCanvasElement.prototype.toBlob, {
      apply(target, self, args) {
        noisify(self, self.getContext("2d"));
        return Reflect.apply(target, self, args);
      }
    });

    HTMLCanvasElement.prototype.toDataURL = new Proxy(HTMLCanvasElement.prototype.toDataURL, {
      apply(target, self, args) {
        noisify(self, self.getContext("2d"));
        return Reflect.apply(target, self, args);
      }
    });

    CanvasRenderingContext2D.prototype.getImageData = new Proxy(CanvasRenderingContext2D.prototype.getImageData, {
      apply(target, self, args) {
        noisify(self.canvas, self);
        return Reflect.apply(target, self, args);
      }
    });
  }

  // ============================================================================
  // FONT FINGERPRINT DEFENDER
  // ============================================================================
  if (settings.font) {
    // Note: offset measurements are taken on arbitrary, unidentified elements,
    // so there's no stable "label" to seed against across page reloads the
    // way there is for named WebGL/WebGPU constants below. What we CAN make
    // stable is per-element-instance noise within a single page load — the
    // same element returns the same noised value every time it's measured,
    // which is what font-fingerprinting scripts actually check for (they
    // sample the same element repeatedly and look for jitter).
    const noiseCache = new WeakMap();

    const rand = {
      "noise": function (callIndex) {
        const a = seededRandom('font-noise-a-' + callIndex);
        const b = seededRandom('font-noise-b-' + callIndex);
        const SIGN = a < b ? -1 : 1;
        return Math.floor(b + SIGN * a);
      },
      "sign": function (callIndex) {
        const tmp = [-1, -1, -1, -1, -1, -1, +1, -1, -1, -1];
        const index = Math.floor(seededRandom('font-sign-' + callIndex) * tmp.length);
        return tmp[index];
      }
    };

    let callCounter = 0;
    function getOrCreateNoise(el, dimension) {
      let entry = noiseCache.get(el);
      if (!entry) {
        entry = {};
        noiseCache.set(el, entry);
      }
      if (!(dimension in entry)) {
        callCounter += 1;
        const valid = rand.sign(callCounter) === 1;
        entry[dimension] = valid ? rand.noise(callCounter) : 0;
      }
      return entry[dimension];
    }

    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      "get": new Proxy(Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight").get, {
        apply(target, self, args) {
          try {
            const height = Math.floor(self.getBoundingClientRect().height);
            const result = height ? height + getOrCreateNoise(self, 'h') : height;
            return result;
          } catch (e) {
            return Reflect.apply(target, self, args);
          }
        }
      })
    });

    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      "get": new Proxy(Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth").get, {
        apply(target, self, args) {
          const width = Math.floor(self.getBoundingClientRect().width);
          const result = width ? width + getOrCreateNoise(self, 'w') : width;
          return result;
        }
      })
    });
  }

  // ============================================================================
  // AUDIOCONTEXT FINGERPRINT DEFENDER
  // ============================================================================
  if (settings.audioContext) {
    const context = {
      "BUFFER": null,
      "getChannelData": function (e) {
        e.prototype.getChannelData = new Proxy(e.prototype.getChannelData, {
          apply(target, self, args) {
            const results_1 = Reflect.apply(target, self, args);

            if (context.BUFFER !== results_1) {
              context.BUFFER = results_1;

              for (let i = 0; i < results_1.length; i += 100) {
                const index = Math.floor(seededRandom('audio-channel-idx-' + i) * i);
                results_1[index] = results_1[index] + seededRandom('audio-channel-val-' + i) * 0.0000001;
              }
            }

            return results_1;
          }
        });
      },
      "createAnalyser": function (e) {
        e.prototype.__proto__.createAnalyser = new Proxy(e.prototype.__proto__.createAnalyser, {
          apply(target, self, args) {
            const results_2 = Reflect.apply(target, self, args);

            results_2.__proto__.getFloatFrequencyData = new Proxy(results_2.__proto__.getFloatFrequencyData, {
              apply(target, self, args) {
                const results_3 = Reflect.apply(target, self, args);

                for (let i = 0; i < arguments[0].length; i += 100) {
                  const index = Math.floor(seededRandom('audio-freq-idx-' + i) * i);
                  arguments[0][index] = arguments[0][index] + seededRandom('audio-freq-val-' + i) * 0.1;
                }

                return results_3;
              }
            });

            return results_2;
          }
        });
      }
    };

    context.getChannelData(AudioBuffer);
    context.createAnalyser(AudioContext);
    context.createAnalyser(OfflineAudioContext);
  }

  // ============================================================================
  // WEBGL FINGERPRINT DEFENDER (WITH ERROR FIX)
  // ============================================================================
  if (settings.webgl) {
    const config = {
      "random": {
        "value": function (label) {
          return label !== undefined ? seededRandom(label) : Math.random();
        },
        "item": function (e, label) {
          const rand = e.length * config.random.value(label);
          return e[Math.floor(rand)];
        },
        "number": function (power, label) {
          const tmp = [];
          for (let i = 0; i < power.length; i++) {
            tmp.push(Math.pow(2, power[i]));
          }
          return config.random.item(tmp, label);
        },
        "int": function (power, label) {
          const tmp = [];
          for (let i = 0; i < power.length; i++) {
            const n = Math.pow(2, power[i]);
            tmp.push(new Int32Array([n, n]));
          }
          return config.random.item(tmp, label);
        },
        "float": function (power, label) {
          const tmp = [];
          for (let i = 0; i < power.length; i++) {
            const n = Math.pow(2, power[i]);
            tmp.push(new Float32Array([1, n]));
          }
          return config.random.item(tmp, label);
        }
      },
      "spoof": {
        "webgl": {
          "buffer": function (target) {
            const proto = target.prototype ? target.prototype : target.__proto__;

            proto.bufferData = new Proxy(proto.bufferData, {
              apply(target, self, args) {
                try {
                  // No stable identity for an arbitrary buffer write, so we
                  // seed on the buffer length + a fixed call-site label —
                  // same-length buffers on the same origin get the same
                  // perturbation index/magnitude across reloads.
                  const baseLabel = 'webgl-buffer-' + (args[1] && args[1].length);
                  const index = Math.floor(seededRandom(baseLabel + '-idx') * args[1].length);
                  const noise = args[1][index] !== undefined ? 0.1 * seededRandom(baseLabel + '-val') * args[1][index] : 0;
                  args[1][index] = args[1][index] + noise;
                } catch (e) {
                  // Ignore errors in buffer manipulation
                }
                return Reflect.apply(target, self, args);
              }
            });
          },
          "parameter": function (target) {
            const proto = target.prototype ? target.prototype : target.__proto__;

            proto.getParameter = new Proxy(proto.getParameter, {
              apply(target, self, args) {
                try {
                  // Only spoof known fingerprinting parameters.
                  // Each branch's label is the constant ID itself, so the
                  // same parameter always resolves to the same spoofed
                  // value on a given origin until the seed is refreshed.
                  if (args[0] === 3415) return 0;
                  else if (args[0] === 3414) return 24;
                  else if (args[0] === 36348) return 30;
                  else if (args[0] === 7936) return "WebKit";
                  else if (args[0] === 37445) return "Google Inc.";
                  else if (args[0] === 7937) return "WebKit WebGL";
                  else if (args[0] === 3379) return config.random.number([14, 15], 'webgl-param-3379');
                  else if (args[0] === 36347) return config.random.number([12, 13], 'webgl-param-36347');
                  else if (args[0] === 34076) return config.random.number([14, 15], 'webgl-param-34076');
                  else if (args[0] === 34024) return config.random.number([14, 15], 'webgl-param-34024');
                  else if (args[0] === 3386) return config.random.int([13, 14, 15], 'webgl-param-3386');
                  else if (args[0] === 3413) return config.random.number([1, 2, 3, 4], 'webgl-param-3413');
                  else if (args[0] === 3412) return config.random.number([1, 2, 3, 4], 'webgl-param-3412');
                  else if (args[0] === 3411) return config.random.number([1, 2, 3, 4], 'webgl-param-3411');
                  else if (args[0] === 3410) return config.random.number([1, 2, 3, 4], 'webgl-param-3410');
                  else if (args[0] === 34047) return config.random.number([1, 2, 3, 4], 'webgl-param-34047');
                  else if (args[0] === 34930) return config.random.number([1, 2, 3, 4], 'webgl-param-34930');
                  else if (args[0] === 34921) return config.random.number([1, 2, 3, 4], 'webgl-param-34921');
                  else if (args[0] === 35660) return config.random.number([1, 2, 3, 4], 'webgl-param-35660');
                  else if (args[0] === 35661) return config.random.number([4, 5, 6, 7, 8], 'webgl-param-35661');
                  else if (args[0] === 36349) return config.random.number([10, 11, 12, 13], 'webgl-param-36349');
                  else if (args[0] === 33902) return config.random.float([0, 10, 11, 12, 13], 'webgl-param-33902');
                  else if (args[0] === 33901) return config.random.float([0, 10, 11, 12, 13], 'webgl-param-33901');
                  else if (args[0] === 37446) return config.random.item(["Graphics", "HD Graphics", "Intel(R) HD Graphics"], 'webgl-param-37446');
                  else if (args[0] === 7938) return config.random.item(["WebGL 1.0", "WebGL 1.0 (OpenGL)", "WebGL 1.0 (OpenGL Chromium)"], 'webgl-param-7938');
                  else if (args[0] === 35724) return config.random.item(["WebGL", "WebGL GLSL", "WebGL GLSL ES", "WebGL GLSL ES (OpenGL Chromium)"], 'webgl-param-35724');
                } catch (e) {
                  // If any error, fall through to original
                }

                // For all other parameters or on error, use original
                return Reflect.apply(target, self, args);
              }
            });
          }
        }
      }
    };

    config.spoof.webgl.buffer(WebGLRenderingContext);
    config.spoof.webgl.buffer(WebGL2RenderingContext);
    config.spoof.webgl.parameter(WebGLRenderingContext);
    config.spoof.webgl.parameter(WebGL2RenderingContext);
  }

  // ============================================================================
  // WEBGPU FINGERPRINT DEFENDER
  // ============================================================================
  if (settings.webgpu) {
    const config = {
      "noise": {
        "color": 0.01,
        "percent": 0.1,
        "buffer": 0.0001
      }
    };

    try {
      const _GPUAdapter = Object.getOwnPropertyDescriptor(GPUAdapter.prototype, "limits").get;
      Object.defineProperty(GPUAdapter.prototype, "_limits", { "configurable": true, get() { return _GPUAdapter.call(this) } });

      Object.defineProperty(GPUAdapter.prototype, "limits", {
        "get": new Proxy(_GPUAdapter, {
          apply(target, self, args) {
            const result = Reflect.apply(target, self, args);

            const _maxBufferSize = self._limits.maxBufferSize;
            const _maxUniformBufferBindingSize = self._limits.maxUniformBufferBindingSize;
            const _maxStorageBufferBindingSize = self._limits.maxStorageBufferBindingSize;
            const _maxComputeWorkgroupStorageSize = self._limits.maxComputeWorkgroupStorageSize;

            Object.defineProperty(result.__proto__, "maxBufferSize", { "configurable": true, get() { return _maxBufferSize + (seededRandom('gpuadapter-maxBufferSize') < 0.5 ? -1 : -2) } });
            Object.defineProperty(result.__proto__, "maxUniformBufferBindingSize", { "configurable": true, get() { return _maxUniformBufferBindingSize + (seededRandom('gpuadapter-maxUniformBufferBindingSize') < 0.5 ? -1 : -2) } });
            Object.defineProperty(result.__proto__, "maxStorageBufferBindingSize", { "configurable": true, get() { return _maxStorageBufferBindingSize + (seededRandom('gpuadapter-maxStorageBufferBindingSize') < 0.5 ? -1 : -2) } });
            Object.defineProperty(result.__proto__, "maxComputeWorkgroupStorageSize", { "configurable": true, get() { return _maxComputeWorkgroupStorageSize + (seededRandom('gpuadapter-maxComputeWorkgroupStorageSize') < 0.5 ? -1 : -2) } });

            return result;
          }
        })
      });
    } catch (e) { }

    try {
      const _GPUDevice = Object.getOwnPropertyDescriptor(GPUDevice.prototype, "limits").get;
      Object.defineProperty(GPUDevice.prototype, "_limits", { "configurable": true, get() { return _GPUDevice.call(this) } });

      Object.defineProperty(GPUDevice.prototype, "limits", {
        "get": new Proxy(_GPUDevice, {
          apply(target, self, args) {
            const result = Reflect.apply(target, self, args);

            const _maxBufferSize = self._limits.maxBufferSize;
            const _maxUniformBufferBindingSize = self._limits.maxUniformBufferBindingSize;
            const _maxStorageBufferBindingSize = self._limits.maxStorageBufferBindingSize;
            const _maxComputeWorkgroupStorageSize = self._limits.maxComputeWorkgroupStorageSize;

            Object.defineProperty(result.__proto__, "maxBufferSize", { "configurable": true, get() { return _maxBufferSize + (seededRandom('gpudevice-maxBufferSize') < 0.5 ? -1 : -2) } });
            Object.defineProperty(result.__proto__, "maxUniformBufferBindingSize", { "configurable": true, get() { return _maxUniformBufferBindingSize + (seededRandom('gpudevice-maxUniformBufferBindingSize') < 0.5 ? -1 : -2) } });
            Object.defineProperty(result.__proto__, "maxStorageBufferBindingSize", { "configurable": true, get() { return _maxStorageBufferBindingSize + (seededRandom('gpudevice-maxStorageBufferBindingSize') < 0.5 ? -1 : -2) } });
            Object.defineProperty(result.__proto__, "maxComputeWorkgroupStorageSize", { "configurable": true, get() { return _maxComputeWorkgroupStorageSize + (seededRandom('gpudevice-maxComputeWorkgroupStorageSize') < 0.5 ? -1 : -2) } });

            return result;
          }
        })
      });
    } catch (e) { }

    try {
      if (GPUCommandEncoder) {
        GPUCommandEncoder.prototype.beginRenderPass = new Proxy(GPUCommandEncoder.prototype.beginRenderPass, {
          apply(target, self, args) {
            if (args && args[0] && args[0].colorAttachments && args[0].colorAttachments[0] && args[0].colorAttachments[0].clearValue) {
              try {
                const metrics = args[0].colorAttachments[0].clearValue;
                for (let key in metrics) {
                  let value = metrics[key];
                  value = value + (seededRandom('gpu-clearvalue-' + key) < 0.5 ? -1 : -2) * config.noise.color * value;
                  value = (value < 0 ? -1 : +1) * value;
                  metrics[key] = value;
                }

                args[0].colorAttachments[0].clearValue = metrics;
              } catch (e) { }
            }

            return Reflect.apply(target, self, args);
          }
        });
      }
    } catch (e) { }

    try {
      if (GPUQueue) {
        GPUQueue.prototype.writeBuffer = new Proxy(GPUQueue.prototype.writeBuffer, {
          apply(target, self, args) {
            if (args && args[2]) {
              const flag = (args[2] instanceof ArrayBuffer) || (args[2] instanceof Float32Array);
              if (flag) {
                try {
                  const metrics = args[2];
                  const array = Array(metrics.length).fill(0).map((n, i) => n + i);
                  const count = Math.ceil(metrics.length * config.noise.percent);
                  const shuffled = array.sort(() => 0.5 - seededRandom('gpu-writebuffer-shuffle'));
                  const selected = [...shuffled.slice(0, count)];

                  for (let i = 0; i < selected.length; i++) {
                    const index = selected[i];
                    const value = metrics[index];
                    metrics[index] = value + (seededRandom('gpu-writebuffer-' + index) < 0.5 ? -config.noise.buffer * value : +config.noise.buffer * value);
                  }

                  args[2] = metrics;
                } catch (e) { }
              }
            }

            return Reflect.apply(target, self, args);
          }
        });
      }
    } catch (e) { }
  }

  // ============================================================================
  // CLIENTRECTS FINGERPRINT DEFENDER
  // ============================================================================
  if (settings.clientRects) {
    const config = {
      "noise": {
        "DOMRect": 0.00000001,
        "DOMRectReadOnly": 0.000001
      },
      "metrics": {
        "DOMRect": ['x', 'y', "width", "height"],
        "DOMRectReadOnly": ["top", "right", "bottom", "left"]
      },
      "method": {
        "DOMRect": function (e) {
          try {
            Object.defineProperty(DOMRect.prototype, e, {
              "get": new Proxy(Object.getOwnPropertyDescriptor(DOMRect.prototype, e).get, {
                apply(target, self, args) {
                  const result = Reflect.apply(target, self, args);
                  const _result = result * (1 + (seededRandom('domrect-' + e) < 0.5 ? -1 : +1) * config.noise.DOMRect);
                  return _result;
                }
              })
            });
          } catch (e) { }
        },
        "DOMRectReadOnly": function (e) {
          try {
            Object.defineProperty(DOMRectReadOnly.prototype, e, {
              "get": new Proxy(Object.getOwnPropertyDescriptor(DOMRectReadOnly.prototype, e).get, {
                apply(target, self, args) {
                  const result = Reflect.apply(target, self, args);
                  const _result = result * (1 + (seededRandom('domrectreadonly-' + e) < 0.5 ? -1 : +1) * config.noise.DOMRectReadOnly);
                  return _result;
                }
              })
            });
          } catch (e) { }
        }
      }
    };

    // Select metrics deterministically using seededRandom
    const domRectIndex = Math.floor(seededRandom('domrect-metric-select') * config.metrics.DOMRect.length);
    const domRectReadOnlyIndex = Math.floor(seededRandom('domrectreadonly-metric-select') * config.metrics.DOMRectReadOnly.length);

    config.method.DOMRect(config.metrics.DOMRect[domRectIndex]);
    config.method.DOMRectReadOnly(config.metrics.DOMRectReadOnly[domRectReadOnlyIndex]);
  }

})();
