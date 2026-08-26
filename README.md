# T68k Authenticator - Simple 2FA Authenticator

[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen.svg)]()
[![Security](https://img.shields.io/badge/Security-Local%20Web%20Crypto-success.svg)]()
[![Theme](https://img.shields.io/badge/Theme-Light%20%7C%20Dark-orange.svg)]()

**T68k Authenticator** is a sleek, private, and secure two-factor authentication (2FA) manager built as a lightweight Manifest V3 Chrome Extension. It generates standard time-based one-time passwords (TOTP) compliant with RFC 6238 and RFC 4226 with instant screen QR scanning, file import, and zero telemetry.

---

## ✨ Features

- 🔒 **Zero Telemetry & 100% Private**: All cryptographic operations execute locally using the browser's native **Web Crypto API** (`crypto.subtle`). No remote tracking, no analytics, no external servers.
- 📸 **Instant Screen QR Scanner**: Automatically scans the active tab for two-factor QR codes using `chrome.tabs.captureVisibleTab` with zero manual typing.
- 📁 **QR Image Drag & Drop**: Drop screenshot files or QR image uploads directly into the extension for immediate parsing.
- ⚙️ **Full RFC 6238 / RFC 4226 Compliance**:
  - Hash Algorithms: `SHA-1`, `SHA-256`, `SHA-512`
  - Digits: 6 or 8 digits
  - Configurable Time Steps: Custom period (default 30s)
  - Full `otpauth://totp/...` URI parsing and validation
- 🎨 **Modern Aesthetics & Configurable Colors**:
  - Polished Light and Dark modes
  - 6 selectable theme accent colors (Emerald Green, Sapphire Blue, Royal Purple, Cyan Teal, Sunset Amber, Ruby Rose)
  - Real-time animated circular countdown rings and global timer sync bar
  - One-click copy with toast feedback
- 📌 **Account Organization**:
  - Instant real-time fuzzy search and filtering
  - Pin favorite accounts to the top of your list
  - Automatic brand color matching
- 💾 **Data Portability & Sync**:
  - Local-first security by default (`chrome.storage.local`); optional Chrome Cloud Sync (`chrome.storage.sync`) can be enabled with automatic bidirectional migration (local ↔ cloud)
  - Full JSON backup export and import functionality

---

## 🚀 Installation & Setup

Since T68k Authenticator is built as a standard Manifest V3 extension, you can easily load it into any Chromium-based browser (Google Chrome, Brave, Microsoft Edge, Arc, Opera, Vivaldi) and Firefox:

0. **Clone or Download** this repository:
   ```bash
   git clone https://codeberg.org/Toshi68k/t68k-authenticator.git
   ```

### Chromium-based browsers

1. Open your browser and navigate to the Extensions page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `t68k-authenticator` project folder.
5. Pin **T68k Authenticator** to your browser toolbar for quick access!

### 🦊 Firefox

1. Open your browser and navigate the Debugging page:
   - `about:debugging#/runtime/this-firefox`
2. Click **Load temporary add-on...**.
3. Select the `manifest.json` file in the project folder.
4. Pin **T68k Authenticator** to your browser toolbar for quick access!

---

## 📖 How to Use

### Adding an Account

1. **Scan Screen**: Click the **Scan Screen** quick button or modal tab while on a 2FA setup page to instantly capture and parse the QR code.
2. **Upload QR File**: Switch to the **QR File** tab and drop a QR code image (PNG, JPG, WebP) or click to browse.
3. **Manual Entry**: Switch to the **Manual** tab to paste an `otpauth://` URI or raw Base32 secret key, customize issuer/account labels, and configure digits, periods, or algorithms.

### Managing Codes

- **Copy Code**: Click anywhere on an account card or the copy button to copy the active 6-digit or 8-digit code to your clipboard.
- **Pin to Top**: Click the star/pin icon to keep frequently used accounts pinned at the top.
- **Search**: Use the top search bar to filter accounts by service name or username in real time.
- **Delete**: Click the trash icon on a card and confirm deletion in the safety modal.

### Backup & Restore

1. Click the **Settings (⚙️)** icon in the top header.
2. Click **Export JSON** to download an encrypted/raw backup file containing your tokens.
3. Click **Import JSON** to restore or merge tokens from a previously exported backup file.

---

## 📂 Project Structure

```text
t68k-authenticator/
├── manifest.json        # Extension Manifest V3 configuration
├── popup.html           # Main extension popup interface
├── css/
│   └── popup.css        # Modern responsive design tokens, glassmorphism & themes
├── js/
│   ├── crypto.js        # RFC 6238 TOTP engine, Base32 codec & URI parser (Web Crypto API)
│   ├── storage.js       # chrome.storage.sync / local persistence & backup manager
│   ├── jsqr.lib.js      # Bundled pure JS QR decoding engine (jsQR library)
│   ├── jsqr.js          # QR wrapper & fallback decoder bridge (window.T68kAuthQR)
│   └── popup.js         # UI controller, countdown timers, event listeners & modal flows
└── icons/
    ├── icon16.png       # 16x16 toolbar icon
    ├── icon32.png       # 32x32 display icon
    ├── icon48.png       # 48x48 extension management icon
    └── icon128.png      # 128x128 store & high-res icon
```

---

## 📚 Third-Party Libraries & Acknowledgements

- **[jsQR](https://github.com/cozmo/jsQR)** (Apache 2.0) — Standalone pure JavaScript QR code decoding library used in [`js/jsqr.lib.js`](js/jsqr.lib.js) to power client-side QR code matrix scanning for Firefox and environments without native `BarcodeDetector` support.

---

## 🛡️ Security & Privacy

- **No Remote Network Requests**: T68k Authenticator has no network permissions (`http://*` or `https://*` are deliberately omitted from permissions). It cannot transmit your secret keys over the internet.
- **Cryptographic Security**: HMAC-SHA1, HMAC-SHA256, and HMAC-SHA512 calculations use the browser's hardware-accelerated, cryptographically secure `window.crypto.subtle`.
- **Active Tab Permission**: The `activeTab` permission is strictly used to capture the visual screenshot of the current tab on user demand when clicking "Scan QR from Screen".

---

## 🛠️ Development & Contributing

This simple extension was written out of my own need for a simple 2FA authenticator to enable
easy testing and debugging of a 2FA server backend. It was not intended for production use. It 
is provided as-is for educational and testing purposes only.

But... contributions are welcome! Please ensure all code changes maintain:
- Zero external build tooling requirements (must run directly as native vanilla HTML/CSS/JS).
- Manifest V3 compatibility and strict Content Security Policy (no inline `eval` or remote scripts).
- Proper input validation and Base32 sanitization.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

