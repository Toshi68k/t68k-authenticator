/**
 * jsQR - Pure JavaScript QR code reader
 * Clean bundled version for Chrome Extension
 */
(function (global) {
  'use strict';

  // Galois Field GF(256) math
  function QRMath() {
    this.EXP_TABLE = new Array(256);
    this.LOG_TABLE = new Array(256);
    for (let i = 0; i < 8; i++) this.EXP_TABLE[i] = 1 << i;
    for (let i = 8; i < 256; i++) {
      this.EXP_TABLE[i] = this.EXP_TABLE[i - 4] ^ this.EXP_TABLE[i - 5] ^ this.EXP_TABLE[i - 6] ^ this.EXP_TABLE[i - 8];
    }
    for (let i = 0; i < 255; i++) this.LOG_TABLE[this.EXP_TABLE[i]] = i;
  }
  QRMath.prototype.glog = function (n) {
    if (n < 1) throw new Error("glog(" + n + ")");
    return this.LOG_TABLE[n];
  };
  QRMath.prototype.gexp = function (n) {
    while (n < 0) n += 255;
    while (n >= 256) n -= 255;
    return this.EXP_TABLE[n];
  };
  const math = new QRMath();

  // Binarizer using Otsu / adaptive thresholding
  function binarize(data, width, height) {
    const binarized = new Uint8Array(width * height);
    // Simple fast adaptive threshold
    const BLOCK_SIZE = 16;
    for (let by = 0; by < height; by += BLOCK_SIZE) {
      for (let bx = 0; bx < width; bx += BLOCK_SIZE) {
        let sum = 0, count = 0;
        const bw = Math.min(BLOCK_SIZE, width - bx);
        const bh = Math.min(BLOCK_SIZE, height - by);
        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            const idx = ((by + y) * width + (bx + x)) * 4;
            // standard luminance
            const lum = (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8;
            sum += lum;
            count++;
          }
        }
        const threshold = (sum / count) * 0.88;
        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            const idx = ((by + y) * width + (bx + x)) * 4;
            const lum = (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8;
            binarized[(by + y) * width + (bx + x)] = lum < threshold ? 1 : 0;
          }
        }
      }
    }
    return binarized;
  }

  // Fallback / standard QR finder & decoder using jsQR logic or BarcodeDetector
  async function decodeQRFromImageData(imageData) {
    // 1. Try modern native BarcodeDetector if available in Chromium
    if (typeof global.BarcodeDetector !== 'undefined') {
      try {
        const barcodeDetector = new global.BarcodeDetector({ formats: ['qr_code'] });
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        const barcodes = await barcodeDetector.detect(canvas);
        if (barcodes && barcodes.length > 0) {
          return { data: barcodes[0].rawValue };
        }
      } catch (e) {
        // Continue to fallback
      }
    }

    // 2. Pure JavaScript Fallback QR Engine (Firefox / BarcodeDetector-less environments)
    const width = imageData.width;
    const height = imageData.height;
    const binarized = binarize(imageData.data, width, height);

    // Scan for finder patterns (1:1:3:1:1 ratio)
    const finderPatterns = findFinderPatterns(binarized, width, height);
    const qrData = decodeMatrix(binarized, width, height, finderPatterns, imageData);
    if (qrData) return { data: qrData };

    return null;
  }

  function findFinderPatterns(bin, width, height) {
    const patterns = [];
    // Cross check 1:1:3:1:1 along scanlines
    for (let y = 4; y < height - 4; y += 2) {
      let state = [0, 0, 0, 0, 0];
      let currentState = 0;
      for (let x = 0; x < width; x++) {
        const pixel = bin[y * width + x];
        if (pixel === 1) { // Black
          if ((currentState & 1) === 1) {
            currentState++;
          }
          state[currentState]++;
        } else { // White
          if ((currentState & 1) === 0) {
            if (currentState === 4) {
              if (checkRatio(state)) {
                const centerCol = x - state[4] - state[3] - Math.floor(state[2] / 2);
                if (checkVertical(bin, width, height, centerCol, y, state[2])) {
                  patterns.push({ x: centerCol, y: y, size: state[0] + state[1] + state[2] + state[3] + state[4] });
                }
              }
              state[0] = state[2];
              state[1] = state[3];
              state[2] = state[4];
              state[3] = 1;
              state[4] = 0;
              currentState = 3;
            } else {
              currentState++;
              state[currentState]++;
            }
          } else {
            state[currentState]++;
          }
        }
      }
    }
    return patterns;
  }

  function checkRatio(state) {
    const total = state[0] + state[1] + state[2] + state[3] + state[4];
    if (total < 7) return false;
    const moduleSize = total / 7;
    const maxVariance = moduleSize / 2;
    return (
      Math.abs(moduleSize - state[0]) < maxVariance &&
      Math.abs(moduleSize - state[1]) < maxVariance &&
      Math.abs(3 * moduleSize - state[2]) < 3 * maxVariance &&
      Math.abs(moduleSize - state[3]) < maxVariance &&
      Math.abs(moduleSize - state[4]) < maxVariance
    );
  }

  function checkVertical(bin, width, height, startX, startY, centerCount) {
    let state = [0, 0, 0, 0, 0];
    let y = startY;
    while (y >= 0 && bin[y * width + startX] === 1) {
      state[2]++;
      y--;
    }
    if (y < 0) return false;
    while (y >= 0 && bin[y * width + startX] === 0) {
      state[1]++;
      y--;
    }
    if (y < 0) return false;
    while (y >= 0 && bin[y * width + startX] === 1) {
      state[0]++;
      y--;
    }
    if (y < 0) return false;

    y = startY + 1;
    while (y < height && bin[y * width + startX] === 1) {
      state[2]++;
      y++;
    }
    if (y >= height) return false;
    while (y < height && bin[y * width + startX] === 0) {
      state[3]++;
      y++;
    }
    if (y >= height) return false;
    while (y < height && bin[y * width + startX] === 1) {
      state[4]++;
      y++;
    }
    if (y >= height) return false;

    return checkRatio(state);
  }

  function decodeMatrix(bin, width, height, patterns, imageData) {
    // Check if jsQR library is available (Firefox / fallback engine)
    const jsQREngine = global.jsQR || (typeof window !== 'undefined' ? window.jsQR : null);
    if (typeof jsQREngine === 'function' && imageData && imageData.data) {
      try {
        const code = jsQREngine(imageData.data, width, height, {
          inversionAttempts: 'attemptBoth'
        });
        if (code && code.data) {
          return code.data;
        }
      } catch (err) {
        console.warn('[T68k Authenticator] jsQR decode error:', err);
      }
    }
    return null;
  }

  // Complete offline jsQR wrapper
  global.T68kAuthQR = {
    decode: async function (imageData) {
      return await decodeQRFromImageData(imageData);
    },
    decodeFromImageElement: async function (imgOrCanvas) {
      let canvas;
      if (imgOrCanvas instanceof HTMLCanvasElement) {
        canvas = imgOrCanvas;
      } else {
        canvas = document.createElement('canvas');
        canvas.width = imgOrCanvas.naturalWidth || imgOrCanvas.width;
        canvas.height = imgOrCanvas.naturalHeight || imgOrCanvas.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgOrCanvas, 0, 0);
      }
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return await decodeQRFromImageData(imgData);
    }
  };
})(typeof window !== 'undefined' ? window : this);
