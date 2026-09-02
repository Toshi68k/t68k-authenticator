/**
 * T68k Authenticator - UI Controller & Event Handlers
 */

(function() {
  'use strict';

  // DOM Elements
  const accountListEl = document.getElementById('account-list');
  const emptyStateEl = document.getElementById('empty-state');
  const searchInputEl = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const globalTimerFillEl = document.getElementById('global-timer-fill');

  // Modals
  const addModal = document.getElementById('add-modal');
  const deleteModal = document.getElementById('delete-modal');
  const settingsModal = document.getElementById('settings-modal');
  const shortcutsModal = document.getElementById('shortcuts-modal');
  const toastEl = document.getElementById('toast');
  const toastMsgEl = document.getElementById('toast-message');

  // Add Modal Elements
  const btnOpenAddModal = document.getElementById('btn-open-add-modal');
  const btnEmptyAdd = document.getElementById('btn-empty-add');
  const btnCloseAddModal = document.getElementById('btn-close-add-modal');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // QR & Manual Form Elements
  const btnScanScreenQuick = document.getElementById('btn-scan-screen-quick');
  const btnScanTabAction = document.getElementById('btn-scan-tab-action');
  const dropZoneQr = document.getElementById('drop-zone-qr');
  const qrFileInput = document.getElementById('qr-file-input');
  const formAddManual = document.getElementById('form-add-manual');
  const inputUriSecret = document.getElementById('input-uri-secret');
  const inputIssuer = document.getElementById('input-issuer');
  const inputAccount = document.getElementById('input-account');
  const selectAlgorithm = document.getElementById('select-algorithm');
  const selectDigits = document.getElementById('select-digits');
  const inputPeriod = document.getElementById('input-period');

  // Delete Modal Elements
  const deleteTargetNameEl = document.getElementById('delete-target-name');
  const btnCancelDelete = document.getElementById('btn-cancel-delete');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');

  // Settings & Backup Elements
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnExportBackup = document.getElementById('btn-export-backup');
  const btnImportBackup = document.getElementById('btn-import-backup');
  const backupFileInput = document.getElementById('backup-file-input');
  const toggleCloudSync = document.getElementById('toggle-cloud-sync');

  // Shortcuts & Keymap Modal Elements
  const btnOpenShortcuts = document.getElementById('btn-open-shortcuts');
  const btnSettingsShortcuts = document.getElementById('btn-settings-shortcuts');
  const rowOpenShortcuts = document.getElementById('row-open-shortcuts');
  const btnCloseShortcutsModal = document.getElementById('btn-close-shortcuts-modal');
  const selectKeymapSetting = document.getElementById('select-keymap-setting');
  const btnHeaderKeymap = document.getElementById('btn-header-keymap');
  const headerKeymapText = document.getElementById('header-keymap-text');
  const shortcutsModalPill = document.getElementById('shortcuts-modal-pill');
  const shortcutsModalTitle = document.getElementById('shortcuts-modal-title');
  const helixLeaderHud = document.getElementById('helix-leader-hud');
  const tabKeymapHelix = document.getElementById('tab-keymap-helix');
  const tabKeymapVim = document.getElementById('tab-keymap-vim');
  const shortcutsContentHelix = document.getElementById('shortcuts-content-helix');
  const shortcutsContentVim = document.getElementById('shortcuts-content-vim');
  const searchKbdHint = document.getElementById('search-kbd-hint');
  const settingShortcutsDesc = document.getElementById('setting-shortcuts-desc');

  // Export Modal Elements
  const exportModal = document.getElementById('export-modal');
  const btnCloseExportModal = document.getElementById('btn-close-export-modal');
  const btnCancelExport = document.getElementById('btn-cancel-export');
  const formExportBackup = document.getElementById('form-export-backup');
  const inputExportPassword = document.getElementById('input-export-password');
  const inputExportPasswordConfirm = document.getElementById('input-export-password-confirm');
  const exportConfirmGroup = document.getElementById('export-confirm-group');

  // Decrypt Modal Elements
  const decryptModal = document.getElementById('decrypt-modal');
  const btnCloseDecryptModal = document.getElementById('btn-close-decrypt-modal');
  const btnCancelDecrypt = document.getElementById('btn-cancel-decrypt');
  const formDecryptImport = document.getElementById('form-decrypt-import');
  const inputDecryptPassword = document.getElementById('input-decrypt-password');

  // Theme Elements
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const selectThemeSetting = document.getElementById('select-theme-setting');
  const iconSun = btnThemeToggle ? btnThemeToggle.querySelector('.icon-sun') : null;
  const iconMoon = btnThemeToggle ? btnThemeToggle.querySelector('.icon-moon') : null;

  // State
  let accounts = [];
  let currentFilter = '';
  let pendingDeleteId = null;
  let pendingEncryptedBackupContent = null;
  let toastTimeout = null;
  let currentTheme = 'light';
  let currentThemeColor = 'green';
  let codeCache = {}; // { [accountId]: { code: string, epochWindow: number } }

  // Active Tab & Browser Integration State
  let activeTabDomain = '';
  let activeTabUrl = '';
  let activeTabId = null;

  // Keymap Mode & Selection State
  let currentKeymapMode = 'helix';
  let selectedVimIndex = 0;
  let currentDisplayedAccounts = [];
  let gKeyPressTimer = null;
  let dKeyPressTimer = null;
  let spaceLeaderActive = false;
  let spaceLeaderTimeout = null;
  let helixGPrefixActive = false;
  let helixGPrefixTimeout = null;

  /**
   * Initialize Application
   */
  async function init() {
    await fetchActiveTabInfo();
    await initTheme();
    await initKeymapSetting();
    await initSyncSetting();
    setupEventListeners();
    setupKeybindings();
    await loadAccounts();
    startTimerTicker();
  }

  /**
   * Initialize and apply saved theme and color
   */
  async function initTheme() {
    currentTheme = await T68kAuthStorage.getTheme();
    currentThemeColor = await T68kAuthStorage.getThemeColor();
    applyTheme(currentTheme, false);
    applyThemeColor(currentThemeColor, false);
  }

  /**
   * Initialize cloud sync checkbox state
   */
  async function initSyncSetting() {
    if (toggleCloudSync) {
      const isSync = await T68kAuthStorage.getSyncEnabled();
      toggleCloudSync.checked = isSync;
    }
  }

  /**
   * Initialize keymap setting from storage
   */
  async function initKeymapSetting() {
    currentKeymapMode = await T68kAuthStorage.getKeymapMode();
    applyKeymapMode(currentKeymapMode, false);
  }

  /**
   * Applies the keymap mode to state, UI elements, badges and storage
   */
  function applyKeymapMode(mode, save = true) {
    currentKeymapMode = mode;
    if (selectKeymapSetting) {
      selectKeymapSetting.value = mode;
    }

    if (headerKeymapText) {
      if (mode === 'helix') {
        headerKeymapText.textContent = 'HELIX';
      } else if (mode === 'vim') {
        headerKeymapText.textContent = 'VIM';
      } else {
        headerKeymapText.textContent = 'OFF';
      }
    }

    if (btnHeaderKeymap) {
      btnHeaderKeymap.className = 'keymap-badge-btn ' + mode;
      btnHeaderKeymap.title = `Current Keymap: ${mode.toUpperCase()} (Click to toggle)`;
    }

    if (shortcutsModalPill) {
      if (mode === 'helix') {
        shortcutsModalPill.textContent = 'HELIX';
        shortcutsModalPill.className = 'keymap-pill helix';
      } else if (mode === 'vim') {
        shortcutsModalPill.textContent = 'VIM';
        shortcutsModalPill.className = 'keymap-pill vim';
      } else {
        shortcutsModalPill.textContent = 'OFF';
        shortcutsModalPill.className = 'keymap-pill disabled';
      }
    }

    if (searchKbdHint) {
      if (mode === 'disabled') {
        searchKbdHint.style.display = 'none';
      } else {
        searchKbdHint.style.display = 'inline-block';
        searchKbdHint.textContent = '/';
        searchKbdHint.title = mode === 'helix' ? 'Press / or Space f to search' : 'Press / to search';
      }
    }

    if (settingShortcutsDesc) {
      if (mode === 'helix') {
        settingShortcutsDesc.textContent = 'Helix keybindings & quick actions cheat sheet';
      } else if (mode === 'vim') {
        settingShortcutsDesc.textContent = 'Vim keybindings & quick actions cheat sheet';
      } else {
        settingShortcutsDesc.textContent = 'Keyboard navigation cheat sheet';
      }
    }

    // Switch cheat sheet tab to match active mode
    switchShortcutsTab(mode === 'vim' ? 'vim' : 'helix');

    if (save) {
      T68kAuthStorage.setKeymapMode(mode);
    }
  }

  /**
   * Switches active tab inside the Shortcuts Modal
   */
  function switchShortcutsTab(tabName) {
    if (!tabKeymapHelix || !tabKeymapVim || !shortcutsContentHelix || !shortcutsContentVim) return;

    if (tabName === 'vim') {
      tabKeymapVim.classList.add('active');
      tabKeymapHelix.classList.remove('active');
      shortcutsContentVim.style.display = 'flex';
      shortcutsContentHelix.style.display = 'none';
      if (shortcutsModalTitle) shortcutsModalTitle.textContent = 'Vim Shortcuts';
      if (shortcutsModalPill) {
        shortcutsModalPill.textContent = 'VIM';
        shortcutsModalPill.className = 'keymap-pill vim';
      }
    } else {
      tabKeymapHelix.classList.add('active');
      tabKeymapVim.classList.remove('active');
      shortcutsContentHelix.style.display = 'flex';
      shortcutsContentVim.style.display = 'none';
      if (shortcutsModalTitle) shortcutsModalTitle.textContent = 'Helix Shortcuts';
      if (shortcutsModalPill) {
        shortcutsModalPill.textContent = 'HELIX';
        shortcutsModalPill.className = 'keymap-pill helix';
      }
    }
  }

  /**
   * Activates Helix Space Leader HUD overlay
   */
  function activateSpaceLeader() {
    spaceLeaderActive = true;
    if (helixLeaderHud) {
      helixLeaderHud.classList.add('active');
    }
    if (spaceLeaderTimeout) clearTimeout(spaceLeaderTimeout);
    spaceLeaderTimeout = setTimeout(() => {
      deactivateSpaceLeader();
    }, 3500);
  }

  /**
   * Deactivates Helix Space Leader HUD overlay
   */
  function deactivateSpaceLeader() {
    spaceLeaderActive = false;
    if (helixLeaderHud) {
      helixLeaderHud.classList.remove('active');
    }
    if (spaceLeaderTimeout) {
      clearTimeout(spaceLeaderTimeout);
      spaceLeaderTimeout = null;
    }
  }

  /**
   * Applies the theme to DOM and syncs UI icons/select
   */
  function applyTheme(theme, save = true) {
    currentTheme = theme;
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
      document.body.classList.add('theme-light');
      if (iconSun) iconSun.style.display = 'none';
      if (iconMoon) iconMoon.style.display = 'block';
    } else {
      document.documentElement.classList.remove('theme-light');
      document.body.classList.remove('theme-light');
      if (iconSun) iconSun.style.display = 'block';
      if (iconMoon) iconMoon.style.display = 'none';
    }

    if (selectThemeSetting) {
      selectThemeSetting.value = theme;
    }

    if (save) {
      T68kAuthStorage.setTheme(theme);
    }
  }

  /**
   * Applies the theme accent color to DOM and syncs active swatches
   */
  function applyThemeColor(color, save = true) {
    const validColors = ['green', 'blue', 'purple', 'cyan', 'orange', 'rose'];
    currentThemeColor = validColors.includes(color) ? color : 'green';

    document.documentElement.setAttribute('data-color', currentThemeColor);
    document.body.setAttribute('data-color', currentThemeColor);

    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
      if (swatch.getAttribute('data-color') === currentThemeColor) {
        swatch.classList.add('active');
      } else {
        swatch.classList.remove('active');
      }
    });

    if (save) {
      T68kAuthStorage.setThemeColor(currentThemeColor);
    }
  }

  /**
   * Toggles between dark and light themes
   */
  function toggleTheme() {
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme, true);
    showToast(`${nextTheme === 'light' ? 'Light' : 'Dark'} theme activated`);
  }

  /**
   * Retrieves active tab info (URL and ID) for smart domain matching & autofill
   */
  async function fetchActiveTabInfo() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      try {
        const tabs = await new Promise((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, resolve);
        });
        if (tabs && tabs[0]) {
          activeTabId = tabs[0].id;
          activeTabUrl = tabs[0].url || '';
          if (activeTabUrl) {
            try {
              const urlObj = new URL(activeTabUrl);
              activeTabDomain = urlObj.hostname.toLowerCase();
            } catch {
              activeTabDomain = '';
            }
          }
        }
      } catch (err) {
        console.warn('Could not query active tab:', err);
      }
    }
  }

  /**
   * Normalizes a hostname or service name for matching
   */
  function normalizeDomainKeyword(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^(www|login|auth|sso|id|accounts|app|my|signin|api)\./g, '')
      .replace(/\.(com|org|net|io|co|dev|app|ai|me|cc|gov|edu)(\.[a-z]{2})?$/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Checks if an account matches the active tab's domain
   */
  function isAccountMatchedToDomain(acc, domain) {
    if (!domain || !acc) return false;
    const domainKeyword = normalizeDomainKeyword(domain);
    if (!domainKeyword || domainKeyword.length < 2) return false;

    const issuerKeyword = normalizeDomainKeyword(acc.issuer || '');
    const accountKeyword = normalizeDomainKeyword(acc.account || '');

    if (issuerKeyword && (domainKeyword.includes(issuerKeyword) || issuerKeyword.includes(domainKeyword))) {
      return true;
    }
    if (accountKeyword && accountKeyword.length >= 3 && domainKeyword.includes(accountKeyword)) {
      return true;
    }
    if (acc.issuer && domain.includes(acc.issuer.toLowerCase())) {
      return true;
    }
    return false;
  }

  /**
   * Loads accounts from persistent storage
   */
  async function loadAccounts() {
    accounts = await T68kAuthStorage.getAccounts();
    renderAccounts();
  }

  /**
   * Renders the account list based on filter
   */
  async function renderAccounts() {
    const filter = currentFilter.trim().toLowerCase();
    const filtered = accounts
      .filter(acc => {
        if (!filter) return true;
        return (acc.issuer && acc.issuer.toLowerCase().includes(filter)) ||
               (acc.account && acc.account.toLowerCase().includes(filter));
      })
      .sort((a, b) => {
        const aMatched = !filter && isAccountMatchedToDomain(a, activeTabDomain);
        const bMatched = !filter && isAccountMatchedToDomain(b, activeTabDomain);

        if (aMatched !== bMatched) {
          return aMatched ? -1 : 1;
        }

        if (!!a.pinned !== !!b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

    currentDisplayedAccounts = filtered;

    if (filtered.length === 0) {
      accountListEl.innerHTML = '';
      emptyStateEl.style.display = 'flex';
      if (currentFilter) {
        emptyStateEl.querySelector('.empty-title').textContent = 'No Matches Found';
        emptyStateEl.querySelector('.empty-desc').textContent = `No accounts matching "${currentFilter}"`;
      } else {
        emptyStateEl.querySelector('.empty-title').textContent = 'No 2FA Codes Yet';
        emptyStateEl.querySelector('.empty-desc').textContent = 'Scan a QR code from your screen or enter your secret key to start protecting your accounts.';
      }
      return;
    }

    emptyStateEl.style.display = 'none';

    // Clamp Vim selected index within bounds
    if (selectedVimIndex < 0) selectedVimIndex = 0;
    if (selectedVimIndex >= filtered.length) selectedVimIndex = filtered.length - 1;

    // Build markup for accounts
    accountListEl.innerHTML = filtered.map((acc, idx) => {
      const isMatched = !filter && isAccountMatchedToDomain(acc, activeTabDomain);
      const isVimSelected = idx === selectedVimIndex;
      const brand = T68kAuthCrypto.getIssuerBrandInfo(acc.issuer || 'Account');
      const cached = codeCache[acc.id] ? codeCache[acc.id].code : '------';
      const formattedCode = T68kAuthCrypto.formatCode(cached);
      const keyHint = idx < 9 ? `<span class="card-index-hint" title="Press ${idx + 1} to copy">${idx + 1}</span>` : '';

      return `
        <div class="totp-card ${acc.pinned ? 'pinned' : ''} ${isMatched ? 'suggested-site' : ''} ${isVimSelected ? 'vim-selected' : ''}" data-id="${acc.id}" data-index="${idx}" tabindex="0">
          <div class="card-header">
            <div class="account-info">
              <div class="account-avatar" style="background: ${brand.color}">
                ${brand.initial}
              </div>
              <div class="account-meta">
                <div style="display: flex; align-items: center; gap: 5px;">
                  <span class="account-issuer">${escapeHtml(acc.issuer || 'Account')}</span>
                  ${isMatched ? `<span class="badge-suggested">✨ Suggested</span>` : ''}
                  ${keyHint}
                </div>
                ${acc.account ? `<span class="account-name">${escapeHtml(acc.account)}</span>` : ''}
              </div>
            </div>

            <!-- Circular Progress Indicator -->
            <div class="timer-gauge-wrapper" title="Remaining validity">
              <svg class="timer-svg" viewBox="0 0 36 36">
                <circle class="timer-circle-bg" cx="18" cy="18" r="14" fill="none" />
                <circle class="timer-circle-fill" id="gauge-${acc.id}" cx="18" cy="18" r="14" fill="none" />
              </svg>
              <span class="timer-seconds-label" id="sec-${acc.id}">30</span>
            </div>
          </div>

          <div class="card-body">
            <div class="totp-code" id="code-${acc.id}">${formattedCode}</div>
            <div class="card-actions">
              <button class="btn-card-action btn-autofill" data-action="autofill" data-id="${acc.id}" title="Autofill code into web page (f)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </button>
              <button class="btn-card-action btn-pin ${acc.pinned ? 'active' : ''}" data-action="pin" data-id="${acc.id}" title="${acc.pinned ? 'Unpin account' : 'Pin to top (p)'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${acc.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </button>
              <button class="btn-card-action btn-copy" data-action="copy" data-id="${acc.id}" title="Copy code (y / Enter)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button class="btn-card-action btn-delete" data-action="delete" data-id="${acc.id}" title="Delete account (dd)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Update codes and gauges immediately
    await updateAllCodesAndGauges();
  }

  /**
   * Updates TOTP codes & circular gauges
   */
  async function updateAllCodesAndGauges() {
    const now = Math.floor(Date.now() / 1000);
    const CIRCUMFERENCE = 88; // 2 * pi * 14

    for (const acc of accounts) {
      const period = acc.period || 30;
      const currentWindow = Math.floor(now / period);
      const remaining = period - (now % period);
      const progress = remaining / period; // 1.0 down to 0.0

      // Recompute TOTP if window changed or not cached
      if (!codeCache[acc.id] || codeCache[acc.id].epochWindow !== currentWindow) {
        try {
          const rawCode = await T68kAuthCrypto.generateTOTP(acc.secret, {
            algorithm: acc.algorithm,
            digits: acc.digits,
            period: acc.period,
            epoch: now
          });
          codeCache[acc.id] = { code: rawCode, epochWindow: currentWindow };
          const codeEl = document.getElementById(`code-${acc.id}`);
          if (codeEl) {
            codeEl.textContent = T68kAuthCrypto.formatCode(rawCode);
          }
        } catch (err) {
          console.error(`Failed to generate TOTP for ${acc.issuer}:`, err);
        }
      }

      // Update Gauge SVG
      const gaugeEl = document.getElementById(`gauge-${acc.id}`);
      const secEl = document.getElementById(`sec-${acc.id}`);
      if (gaugeEl && secEl) {
        const offset = CIRCUMFERENCE * (1 - progress);
        gaugeEl.style.strokeDashoffset = offset;
        secEl.textContent = remaining;

        // Visual Urgency Classes
        gaugeEl.classList.remove('warning', 'danger');
        if (remaining <= 5) {
          gaugeEl.classList.add('danger');
          secEl.style.color = 'var(--accent-rose)';
        } else if (remaining <= 10) {
          gaugeEl.classList.add('warning');
          secEl.style.color = 'var(--accent-amber)';
        } else {
          secEl.style.color = 'var(--text-secondary)';
        }
      }
    }

    // Update Global Master Sync Bar (based on default 30s period)
    const masterPeriod = 30;
    const masterRemaining = masterPeriod - (now % masterPeriod);
    const masterPercent = (masterRemaining / masterPeriod) * 100;
    if (globalTimerFillEl) {
      globalTimerFillEl.style.width = `${masterPercent}%`;
      globalTimerFillEl.classList.remove('warning', 'danger');
      if (masterRemaining <= 5) {
        globalTimerFillEl.classList.add('danger');
      } else if (masterRemaining <= 10) {
        globalTimerFillEl.classList.add('warning');
      }
    }
  }

  /**
   * Continuous ticker loop
   */
  function startTimerTicker() {
    updateAllCodesAndGauges();
    setInterval(updateAllCodesAndGauges, 1000);
  }

  /**
   * Copy Code to Clipboard with Feedback
   */
  async function copyAccountCode(accId) {
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return;

    let code = codeCache[acc.id] ? codeCache[acc.id].code : null;
    if (!code) {
      code = await T68kAuthCrypto.generateTOTP(acc.secret, {
        algorithm: acc.algorithm,
        digits: acc.digits,
        period: acc.period
      });
    }

    try {
      await navigator.clipboard.writeText(code);
      showToast(`Copied ${T68kAuthCrypto.formatCode(code)}!`);
    } catch (e) {
      // Fallback
      const tempInput = document.createElement('input');
      tempInput.value = code;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      showToast(`Copied ${T68kAuthCrypto.formatCode(code)}!`);
    }
  }

  /**
   * Autofills 2FA TOTP code directly into the active browser tab
   */
  async function autofillAccount(accId) {
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return;

    let code = codeCache[acc.id] ? codeCache[acc.id].code : null;
    if (!code) {
      code = await T68kAuthCrypto.generateTOTP(acc.secret, {
        algorithm: acc.algorithm,
        digits: acc.digits,
        period: acc.period
      });
    }

    const formattedCode = T68kAuthCrypto.formatCode(code);

    // Also copy to clipboard for convenience
    try {
      await navigator.clipboard.writeText(code);
    } catch (e) {
      const tempInput = document.createElement('input');
      tempInput.value = code;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
    }

    if (typeof chrome === 'undefined' || !chrome.scripting || !activeTabId) {
      showToast(`Copied ${formattedCode} to clipboard!`);
      return;
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        func: (otpCode) => {
          function fillInput(el, val) {
            el.focus();
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: val.slice(-1) }));
            // Flash subtle green border highlight
            const origTransition = el.style.transition;
            const origBoxShadow = el.style.boxShadow;
            const origBorder = el.style.border;
            el.style.transition = 'all 0.3s ease';
            el.style.boxShadow = '0 0 12px #10b981, 0 0 0 2px #10b981';
            el.style.borderColor = '#10b981';
            setTimeout(() => {
              el.style.transition = origTransition;
              el.style.boxShadow = origBoxShadow;
              el.style.borderColor = origBorder;
            }, 1800);
          }

          // 1. Look for segmented multi-box inputs (e.g. 6 separate input boxes)
          const segmentedInputs = Array.from(
            document.querySelectorAll(
              'input[type="text"][maxlength="1"], input[type="tel"][maxlength="1"], input[type="number"][maxlength="1"], input[data-index], input[name*="code"][maxlength="1"], input[id*="code"][maxlength="1"], input[class*="pin"][maxlength="1"], input[class*="digit"][maxlength="1"], input[class*="otp"][maxlength="1"], input[autocomplete="one-time-code"][maxlength="1"]'
            )
          ).filter(el => el.offsetParent !== null && !el.disabled && !el.readOnly);

          if (segmentedInputs.length >= 4 && segmentedInputs.length <= 8) {
            const digits = otpCode.split('');
            for (let i = 0; i < Math.min(digits.length, segmentedInputs.length); i++) {
              fillInput(segmentedInputs[i], digits[i]);
            }
            return { success: true, count: segmentedInputs.length, type: 'segmented' };
          }

          // 2. Look for single dedicated 2FA inputs
          const selectors = [
            'input[autocomplete="one-time-code"]',
            'input[autocomplete="2fa"]',
            'input[name*="otp" i]',
            'input[name*="totp" i]',
            'input[name*="2fa" i]',
            'input[name*="two_factor" i]',
            'input[name*="token" i]',
            'input[name*="auth_code" i]',
            'input[name*="verification" i]',
            'input[id*="otp" i]',
            'input[id*="totp" i]',
            'input[id*="2fa" i]',
            'input[id*="token" i]',
            'input[id*="verification" i]',
            'input[placeholder*="code" i]',
            'input[placeholder*="6-digit" i]',
            'input[placeholder*="2fa" i]',
            'input[placeholder*="authenticator" i]',
            'input[aria-label*="code" i]',
            'input[aria-label*="2fa" i]',
            'input[aria-label*="verification" i]',
            'input[inputmode="numeric"]'
          ];

          for (const selector of selectors) {
            const inputs = Array.from(document.querySelectorAll(selector))
              .filter(el => el.offsetParent !== null && !el.disabled && !el.readOnly && el.type !== 'hidden');
            if (inputs.length > 0) {
              const target = inputs[0];
              fillInput(target, otpCode);
              return { success: true, type: 'single' };
            }
          }

          // 3. Fallback to active focused element if it is an input
          const activeEl = document.activeElement;
          if (activeEl && activeEl.tagName === 'INPUT' && activeEl.type !== 'hidden' && !activeEl.disabled && !activeEl.readOnly) {
            fillInput(activeEl, otpCode);
            return { success: true, type: 'focused' };
          }

          return { success: false };
        },
        args: [code]
      });

      if (results && results[0] && results[0].result && results[0].result.success) {
        showToast(`⚡ Autofilled ${formattedCode} into page!`);
      } else {
        showToast(`Copied ${formattedCode} to clipboard (no 2FA field found)`);
      }
    } catch (err) {
      console.warn('Autofill injection warning:', err);
      showToast(`Copied ${formattedCode} to clipboard!`);
    }
  }

  /**
   * Updates Vim selected index visual outline & scrolls into view
   */
  function updateVimSelectionVisual() {
    const cards = accountListEl.querySelectorAll('.totp-card');
    cards.forEach((card, idx) => {
      if (idx === selectedVimIndex) {
        card.classList.add('vim-selected');
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        card.classList.remove('vim-selected');
      }
    });
  }

  /**
   * Moves Vim selection by delta (+1 down, -1 up)
   */
  function moveVimSelection(delta) {
    if (currentDisplayedAccounts.length === 0) return;
    selectedVimIndex = (selectedVimIndex + delta + currentDisplayedAccounts.length) % currentDisplayedAccounts.length;
    updateVimSelectionVisual();
  }

  /**
   * Sets Vim selection to a specific index
   */
  function setVimSelection(index) {
    if (currentDisplayedAccounts.length === 0) return;
    selectedVimIndex = Math.max(0, Math.min(index, currentDisplayedAccounts.length - 1));
    updateVimSelectionVisual();
  }

  /**
   * Setup Modal Keyboard Navigation & Action Keybindings (Helix / Vim / Standard)
   */
  function setupKeybindings() {
    document.addEventListener('keydown', (e) => {
      // Check if any modal is open
      const openModals = [addModal, deleteModal, settingsModal, exportModal, decryptModal, shortcutsModal]
        .filter(m => m && m.classList.contains('active'));

      if (e.key === 'Escape') {
        if (spaceLeaderActive) {
          deactivateSpaceLeader();
          e.preventDefault();
          return;
        }

        if (helixGPrefixActive) {
          helixGPrefixActive = false;
          if (helixGPrefixTimeout) clearTimeout(helixGPrefixTimeout);
          e.preventDefault();
          return;
        }

        if (openModals.length > 0) {
          openModals.forEach(m => closeModal(m));
          e.preventDefault();
          return;
        }

        if (document.activeElement === searchInputEl) {
          searchInputEl.blur();
          e.preventDefault();
          return;
        }

        if (currentFilter) {
          searchInputEl.value = '';
          currentFilter = '';
          searchClearBtn.classList.remove('active');
          renderAccounts();
          e.preventDefault();
          return;
        }
      }

      // If a modal is open, let standard modal typing/tabbing proceed
      if (openModals.length > 0) {
        return;
      }

      // Check if user is typing inside an input/textarea/select
      const activeEl = document.activeElement;
      const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

      if (isTyping) {
        if (activeEl === searchInputEl && e.key === 'Enter') {
          searchInputEl.blur();
          if (currentDisplayedAccounts.length > 0) {
            selectedVimIndex = 0;
            updateVimSelectionVisual();
          }
          e.preventDefault();
        }
        return;
      }

      // Global Help shortcut available in all modes
      if (e.key === '?') {
        e.preventDefault();
        openModal(shortcutsModal);
        return;
      }

      // Global Search shortcut
      if (e.key === '/') {
        e.preventDefault();
        searchInputEl.focus();
        searchInputEl.select();
        return;
      }

      // If keymap is disabled, don't intercept normal editor keys
      if (currentKeymapMode === 'disabled') {
        return;
      }

      // ==========================================
      // HELIX KEYMAP MODE (Selection -> Action)
      // ==========================================
      if (currentKeymapMode === 'helix') {
        // 1. Space Leader Mode
        if (spaceLeaderActive) {
          e.preventDefault();
          const key = e.key;
          deactivateSpaceLeader();

          if (key === 'f') {
            searchInputEl.focus();
            searchInputEl.select();
          } else if (key === 'y') {
            if (currentDisplayedAccounts.length > 0 && selectedVimIndex >= 0 && selectedVimIndex < currentDisplayedAccounts.length) {
              copyAccountCode(currentDisplayedAccounts[selectedVimIndex].id);
            }
          } else if (key === 'a') {
            if (currentDisplayedAccounts.length > 0 && selectedVimIndex >= 0 && selectedVimIndex < currentDisplayedAccounts.length) {
              autofillAccount(currentDisplayedAccounts[selectedVimIndex].id);
            }
          } else if (key === 'n' || key === 'o') {
            openModal(addModal);
          } else if (key === 's') {
            scanCurrentTabScreen();
          } else if (key === 'p') {
            if (currentDisplayedAccounts.length > 0 && selectedVimIndex >= 0 && selectedVimIndex < currentDisplayedAccounts.length) {
              togglePinAccount(currentDisplayedAccounts[selectedVimIndex].id);
            }
          } else if (key === 'd') {
            if (currentDisplayedAccounts.length > 0 && selectedVimIndex >= 0 && selectedVimIndex < currentDisplayedAccounts.length) {
              openDeleteModal(currentDisplayedAccounts[selectedVimIndex].id);
            }
          } else if (key === 't') {
            toggleTheme();
          } else if (key === '?' || key === 'h') {
            openModal(shortcutsModal);
          }
          return;
        }

        // 2. Helix 'g' Goto Prefix
        if (helixGPrefixActive) {
          e.preventDefault();
          helixGPrefixActive = false;
          if (helixGPrefixTimeout) {
            clearTimeout(helixGPrefixTimeout);
            helixGPrefixTimeout = null;
          }

          if (e.key === 'g' || e.key === 'h') {
            // Helix goto top / start
            setVimSelection(0);
          } else if (e.key === 'e' || e.key === 'l') {
            // Helix goto bottom / end
            setVimSelection(currentDisplayedAccounts.length - 1);
          }
          return;
        }

        // 3. Space Leader Trigger
        if (e.key === ' ') {
          e.preventDefault();
          activateSpaceLeader();
          return;
        }

        // 4. Navigation
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          moveVimSelection(1);
          return;
        }

        if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          moveVimSelection(-1);
          return;
        }

        if (e.key === 'g') {
          e.preventDefault();
          helixGPrefixActive = true;
          helixGPrefixTimeout = setTimeout(() => {
            helixGPrefixActive = false;
          }, 450);
          return;
        }

        if (e.key === 'G') {
          e.preventDefault();
          setVimSelection(currentDisplayedAccounts.length - 1);
          return;
        }

        // 5. Select / Highlight card: 'x'
        if (e.key === 'x') {
          e.preventDefault();
          updateVimSelectionVisual();
          return;
        }

        // 6. Number jump (1-9)
        if (/^[1-9]$/.test(e.key)) {
          const numIdx = parseInt(e.key, 10) - 1;
          if (numIdx >= 0 && numIdx < currentDisplayedAccounts.length) {
            e.preventDefault();
            selectedVimIndex = numIdx;
            updateVimSelectionVisual();
            if (e.shiftKey) {
              autofillAccount(currentDisplayedAccounts[numIdx].id);
            } else {
              copyAccountCode(currentDisplayedAccounts[numIdx].id);
            }
          }
          return;
        }

        // 7. Actions on Selection
        // Yank: 'y', 'c', 'Enter'
        if (e.key === 'y' || e.key === 'c' || e.key === 'Enter') {
          if (currentDisplayedAccounts.length > 0 && selectedVimIndex >= 0 && selectedVimIndex < currentDisplayedAccounts.length) {
            e.preventDefault();
            if (e.shiftKey && e.key === 'Enter') {
              autofillAccount(currentDisplayedAccounts[selectedVimIndex].id);
            } else {
              copyAccountCode(currentDisplayedAccounts[selectedVimIndex].id);
            }
          }
          return;
        }

        // Autofill: 'a' or 'f'
        if (e.key === 'a' || e.key === 'f') {
          if (currentDisplayedAccounts.length > 0 && selectedVimIndex >= 0 && selectedVimIndex < currentDisplayedAccounts.length) {
            e.preventDefault();
            autofillAccount(currentDisplayedAccounts[selectedVimIndex].id);
          }
          return;
        }

        // Delete selection directly: 'd' (Helix Selection-first paradigm)
        if (e.key === 'd') {
          if (currentDisplayedAccounts.length > 0 && selectedVimIndex >= 0 && selectedVimIndex < currentDisplayedAccounts.length) {
            e.preventDefault();
            openDeleteModal(currentDisplayedAccounts[selectedVimIndex].id);
          }
          return;
        }

        // Toggle Pin: 'p'
        if (e.key === 'p') {
          if (currentDisplayedAccounts.length > 0 && selectedVimIndex >= 0 && selectedVimIndex < currentDisplayedAccounts.length) {
            e.preventDefault();
            togglePinAccount(currentDisplayedAccounts[selectedVimIndex].id);
          }
          return;
        }

        // Global actions: Add ('o' / 'n'), Scan ('s'), Theme ('t')
        if (e.key === 'o' || e.key === 'n') {
          e.preventDefault();
          openModal(addModal);
          return;
        }

        if (e.key === 's') {
          e.preventDefault();
          scanCurrentTabScreen();
          return;
        }

        if (e.key === 't') {
          e.preventDefault();
          toggleTheme();
          return;
        }

        return;
      }

      // ==========================================
      // VIM KEYMAP MODE
      // ==========================================
      if (currentKeymapMode === 'vim') {
        // Quick Number Shortcuts (1-9)
        if (/^[1-9]$/.test(e.key)) {
          const numIdx = parseInt(e.key, 10) - 1;
          if (numIdx >= 0 && numIdx < currentDisplayedAccounts.length) {
            e.preventDefault();
            selectedVimIndex = numIdx;
            updateVimSelectionVisual();
            if (e.shiftKey) {
              autofillAccount(currentDisplayedAccounts[numIdx].id);
            } else {
              copyAccountCode(currentDisplayedAccounts[numIdx].id);
            }
          }
          return;
        }

        // Down: 'j' or ArrowDown
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          moveVimSelection(1);
          return;
        }

        // Up: 'k' or ArrowUp
        if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          moveVimSelection(-1);
          return;
        }

        // Top: 'gg'
        if (e.key === 'g') {
          if (gKeyPressTimer) {
            clearTimeout(gKeyPressTimer);
            gKeyPressTimer = null;
            e.preventDefault();
            setVimSelection(0);
          } else {
            gKeyPressTimer = setTimeout(() => {
              gKeyPressTimer = null;
            }, 400);
          }
          return;
        }

        // Bottom: 'G'
        if (e.key === 'G') {
          e.preventDefault();
          setVimSelection(currentDisplayedAccounts.length - 1);
          return;
        }

        // Yank / Copy: 'y', 'c', or 'Enter'
        if (e.key === 'y' || e.key === 'c' || e.key === 'Enter') {
          if (currentDisplayedAccounts.length > 0 && selectedVimIndex >= 0 && selectedVimIndex < currentDisplayedAccounts.length) {
            e.preventDefault();
            if (e.shiftKey && e.key === 'Enter') {
              autofillAccount(currentDisplayedAccounts[selectedVimIndex].id);
            } else {
              copyAccountCode(currentDisplayedAccounts[selectedVimIndex].id);
            }
          }
          return;
        }

        // Autofill: 'f' or 'a'
        if (e.key === 'f' || e.key === 'a') {
          if (currentDisplayedAccounts.length > 0 && selectedVimIndex >= 0 && selectedVimIndex < currentDisplayedAccounts.length) {
            e.preventDefault();
            autofillAccount(currentDisplayedAccounts[selectedVimIndex].id);
          }
          return;
        }

        // Pin / Unpin: 'p'
        if (e.key === 'p') {
          if (currentDisplayedAccounts.length > 0 && selectedVimIndex >= 0 && selectedVimIndex < currentDisplayedAccounts.length) {
            e.preventDefault();
            togglePinAccount(currentDisplayedAccounts[selectedVimIndex].id);
          }
          return;
        }

        // Delete: 'dd'
        if (e.key === 'd') {
          if (dKeyPressTimer) {
            clearTimeout(dKeyPressTimer);
            dKeyPressTimer = null;
            if (currentDisplayedAccounts.length > 0 && selectedVimIndex >= 0 && selectedVimIndex < currentDisplayedAccounts.length) {
              e.preventDefault();
              openDeleteModal(currentDisplayedAccounts[selectedVimIndex].id);
            }
          } else {
            dKeyPressTimer = setTimeout(() => {
              dKeyPressTimer = null;
            }, 400);
          }
          return;
        }

        // New / Add: 'o' or 'n'
        if (e.key === 'o' || e.key === 'n') {
          e.preventDefault();
          openModal(addModal);
          return;
        }

        // Screen Scan: 's'
        if (e.key === 's') {
          e.preventDefault();
          scanCurrentTabScreen();
          return;
        }

        // Theme Toggle: 't'
        if (e.key === 't') {
          e.preventDefault();
          toggleTheme();
          return;
        }
      }
    });
  }

  /**
   * Show Toast Notification
   */
  function showToast(message) {
    toastMsgEl.textContent = message;
    toastEl.classList.add('active');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove('active');
    }, 2200);
  }

  /**
   * Toggles pinned status for an account
   */
  async function togglePinAccount(accId) {
    const isPinned = await T68kAuthStorage.togglePin(accId);
    const acc = accounts.find(a => a.id === accId);
    if (acc) {
      acc.pinned = isPinned;
    }
    await renderAccounts();
    showToast(isPinned ? 'Pinned to top' : 'Account unpinned');
  }

  /**
   * Setup Event Listeners
   */
  function setupEventListeners() {
    // Search input
    searchInputEl.addEventListener('input', (e) => {
      currentFilter = e.target.value;
      searchClearBtn.classList.toggle('active', currentFilter.length > 0);
      renderAccounts();
    });

    searchClearBtn.addEventListener('click', () => {
      searchInputEl.value = '';
      currentFilter = '';
      searchClearBtn.classList.remove('active');
      renderAccounts();
      searchInputEl.focus();
    });

    // Account List Clicks (Delegation)
    accountListEl.addEventListener('click', (e) => {
      const autofillBtn = e.target.closest('[data-action="autofill"]');
      const pinBtn = e.target.closest('[data-action="pin"]');
      const copyBtn = e.target.closest('[data-action="copy"]');
      const deleteBtn = e.target.closest('[data-action="delete"]');
      const card = e.target.closest('.totp-card');

      if (autofillBtn) {
        e.stopPropagation();
        autofillAccount(autofillBtn.dataset.id);
        return;
      }

      if (pinBtn) {
        e.stopPropagation();
        togglePinAccount(pinBtn.dataset.id);
        return;
      }

      if (deleteBtn) {
        e.stopPropagation();
        openDeleteModal(deleteBtn.dataset.id);
        return;
      }

      if (copyBtn) {
        e.stopPropagation();
        copyAccountCode(copyBtn.dataset.id);
        return;
      }

      if (card) {
        const cardIndex = parseInt(card.dataset.index, 10);
        if (!isNaN(cardIndex)) {
          selectedVimIndex = cardIndex;
          updateVimSelectionVisual();
        }
        copyAccountCode(card.dataset.id);
      }
    });

    // Open Shortcuts Modal
    if (btnOpenShortcuts) {
      btnOpenShortcuts.addEventListener('click', () => openModal(shortcutsModal));
    }
    if (btnSettingsShortcuts) {
      btnSettingsShortcuts.addEventListener('click', () => {
        closeModal(settingsModal);
        openModal(shortcutsModal);
      });
    }
    if (rowOpenShortcuts) {
      rowOpenShortcuts.addEventListener('click', () => {
        closeModal(settingsModal);
        openModal(shortcutsModal);
      });
    }
    if (btnCloseShortcutsModal) {
      btnCloseShortcutsModal.addEventListener('click', () => closeModal(shortcutsModal));
    }

    // Open Add Modal
    btnOpenAddModal.addEventListener('click', () => openModal(addModal));
    btnEmptyAdd.addEventListener('click', () => openModal(addModal));
    btnCloseAddModal.addEventListener('click', () => closeModal(addModal));

    // Tab switching in Add Modal
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if (target) target.classList.add('active');
      });
    });

    // Manual Form: Auto-detect URI pasted into secret field
    inputUriSecret.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val.toLowerCase().startsWith('otpauth://')) {
        try {
          const parsed = T68kAuthCrypto.parseOTPAuthURI(val);
          inputIssuer.value = parsed.issuer || '';
          inputAccount.value = parsed.account || '';
          selectAlgorithm.value = parsed.algorithm || 'SHA-1';
          selectDigits.value = parsed.digits ? parsed.digits.toString() : '6';
          inputPeriod.value = parsed.period ? parsed.period.toString() : '30';
          inputUriSecret.value = parsed.secret;
          showToast('OTP Auth URI parsed successfully!');
        } catch (err) {
          console.warn('URI parse error:', err);
        }
      }
    });

    // Manual Form Submit
    formAddManual.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const rawSecret = inputUriSecret.value.trim();
        if (!T68kAuthCrypto.isValidBase32(rawSecret)) {
          showToast('Invalid Base32 secret key');
          return;
        }

        const newAcc = await T68kAuthStorage.addAccount({
          secret: rawSecret,
          issuer: inputIssuer.value.trim() || 'Account',
          account: inputAccount.value.trim(),
          algorithm: selectAlgorithm.value,
          digits: selectDigits.value,
          period: inputPeriod.value
        });

        formAddManual.reset();
        closeModal(addModal);
        await loadAccounts();
        showToast(`Added ${newAcc.issuer}!`);
      } catch (err) {
        showToast(`Error: ${err.message}`);
      }
    });

    // Screen Scan Action (from header or modal)
    btnScanScreenQuick.addEventListener('click', scanCurrentTabScreen);
    btnScanTabAction.addEventListener('click', scanCurrentTabScreen);

    // QR Image File Dropzone
    dropZoneQr.addEventListener('click', () => qrFileInput.click());
    qrFileInput.addEventListener('change', handleQrFileSelected);

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZoneQr.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneQr.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZoneQr.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneQr.classList.remove('drag-over');
      });
    });

    dropZoneQr.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processQrImageFile(files[0]);
      }
    });

    // Delete Modal Actions
    btnCancelDelete.addEventListener('click', () => closeModal(deleteModal));
    btnConfirmDelete.addEventListener('click', async () => {
      if (pendingDeleteId) {
        const deleted = await T68kAuthStorage.deleteAccount(pendingDeleteId);
        pendingDeleteId = null;
        closeModal(deleteModal);
        await loadAccounts();
        showToast(`Deleted ${deleted && deleted.issuer ? deleted.issuer : 'account'}`);
      }
    });

    // Settings Modal
    btnOpenSettings.addEventListener('click', () => openModal(settingsModal));
    btnCloseSettings.addEventListener('click', () => closeModal(settingsModal));

    // Export Backup Flow
    btnExportBackup.addEventListener('click', () => {
      if (inputExportPassword) inputExportPassword.value = '';
      if (inputExportPasswordConfirm) inputExportPasswordConfirm.value = '';
      if (exportConfirmGroup) exportConfirmGroup.style.display = 'none';
      openModal(exportModal);
      if (inputExportPassword) inputExportPassword.focus();
    });

    if (btnCloseExportModal) {
      btnCloseExportModal.addEventListener('click', () => closeModal(exportModal));
    }
    if (btnCancelExport) {
      btnCancelExport.addEventListener('click', () => closeModal(exportModal));
    }

    if (inputExportPassword && exportConfirmGroup) {
      inputExportPassword.addEventListener('input', () => {
        const hasText = inputExportPassword.value.length > 0;
        exportConfirmGroup.style.display = hasText ? 'block' : 'none';
        if (inputExportPasswordConfirm) {
          inputExportPasswordConfirm.required = hasText;
        }
      });
    }

    if (formExportBackup) {
      formExportBackup.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = inputExportPassword ? inputExportPassword.value : '';
        const confirm = inputExportPasswordConfirm ? inputExportPasswordConfirm.value : '';

        if (password) {
          if (password !== confirm) {
            showToast('Passwords do not match');
            if (inputExportPasswordConfirm) inputExportPasswordConfirm.focus();
            return;
          }
        }

        try {
          const backupJson = await T68kAuthStorage.exportBackup(password || null);
          const blob = new Blob([backupJson], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const ext = password ? 'enc.json' : 'json';
          a.download = `t68k-authenticator-backup-${new Date().toISOString().slice(0, 10)}.${ext}`;
          a.click();
          URL.revokeObjectURL(url);
          closeModal(exportModal);
          showToast(password ? '🔒 Encrypted backup downloaded!' : 'Backup downloaded!');
        } catch (err) {
          showToast(`Export failed: ${err.message}`);
        }
      });
    }

    // Import Backup Flow
    btnImportBackup.addEventListener('click', () => backupFileInput.click());
    backupFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const fileContent = evt.target.result;
        try {
          const result = await T68kAuthStorage.importBackup(fileContent);
          await loadAccounts();
          closeModal(settingsModal);
          showToast(`Imported ${result.importedCount} accounts!`);
        } catch (err) {
          if (err.isEncrypted) {
            // Prompt for password via Decrypt Modal
            pendingEncryptedBackupContent = fileContent;
            if (inputDecryptPassword) inputDecryptPassword.value = '';
            closeModal(settingsModal);
            openModal(decryptModal);
            if (inputDecryptPassword) inputDecryptPassword.focus();
          } else {
            showToast(`Import failed: ${err.message}`);
          }
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Decrypt & Import Flow
    if (btnCloseDecryptModal) {
      btnCloseDecryptModal.addEventListener('click', () => {
        pendingEncryptedBackupContent = null;
        closeModal(decryptModal);
      });
    }
    if (btnCancelDecrypt) {
      btnCancelDecrypt.addEventListener('click', () => {
        pendingEncryptedBackupContent = null;
        closeModal(decryptModal);
      });
    }

    if (formDecryptImport) {
      formDecryptImport.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!pendingEncryptedBackupContent) {
          closeModal(decryptModal);
          return;
        }

        const password = inputDecryptPassword ? inputDecryptPassword.value : '';
        try {
          const result = await T68kAuthStorage.importBackup(pendingEncryptedBackupContent, password);
          pendingEncryptedBackupContent = null;
          closeModal(decryptModal);
          await loadAccounts();
          showToast(`🔓 Decrypted and imported ${result.importedCount} accounts!`);
        } catch (err) {
          showToast(err.message || 'Incorrect password');
          if (inputDecryptPassword) {
            inputDecryptPassword.select();
            inputDecryptPassword.focus();
          }
        }
      });
    }

    // Keyboard navigation (Escape to close modals, Enter/Space on cards)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModals = document.querySelectorAll('.modal-overlay.active');
        activeModals.forEach(m => closeModal(m));
      }
    });

    accountListEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.totp-card');
        if (card && (e.target === card || !e.target.closest('button'))) {
          e.preventDefault();
          copyAccountCode(card.dataset.id);
        }
      }
    });

    // Theme Controls
    if (btnThemeToggle) {
      btnThemeToggle.addEventListener('click', toggleTheme);
    }

    if (selectThemeSetting) {
      selectThemeSetting.addEventListener('change', (e) => {
        applyTheme(e.target.value, true);
        showToast(`${e.target.value === 'light' ? 'Light' : 'Dark'} theme activated`);
      });
    }

    // Keymap Mode Setting
    if (selectKeymapSetting) {
      selectKeymapSetting.addEventListener('change', (e) => {
        applyKeymapMode(e.target.value, true);
        const nameMap = { helix: '🧬 Helix Mode', vim: '🟩 Vim Mode', disabled: '🚫 Keymap Disabled' };
        showToast(`${nameMap[e.target.value] || e.target.value} active`);
      });
    }

    // Header Keymap Toggle Button
    if (btnHeaderKeymap) {
      btnHeaderKeymap.addEventListener('click', () => {
        const nextMode = currentKeymapMode === 'helix' ? 'vim' : (currentKeymapMode === 'vim' ? 'disabled' : 'helix');
        applyKeymapMode(nextMode, true);
        const nameMap = { helix: '🧬 Helix Mode', vim: '🟩 Vim Mode', disabled: '🚫 Keymap Disabled' };
        showToast(`${nameMap[nextMode] || nextMode} active`);
      });
    }

    // Shortcuts Modal Keymap Tabs
    if (tabKeymapHelix) {
      tabKeymapHelix.addEventListener('click', () => switchShortcutsTab('helix'));
    }
    if (tabKeymapVim) {
      tabKeymapVim.addEventListener('click', () => switchShortcutsTab('vim'));
    }

    // Theme Color Swatches
    const colorSwatches = document.querySelectorAll('.color-swatch');
    colorSwatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.getAttribute('data-color');
        if (color && color !== currentThemeColor) {
          applyThemeColor(color, true);
          const nameMap = {
            green: 'Emerald Green',
            blue: 'Sapphire Blue',
            purple: 'Royal Purple',
            cyan: 'Cyan Teal',
            orange: 'Sunset Amber',
            rose: 'Ruby Rose'
          };
          showToast(`${nameMap[color] || color} accent active`);
        }
      });
    });

    if (toggleCloudSync) {
      toggleCloudSync.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        try {
          await T68kAuthStorage.setSyncEnabled(enabled);
          await loadAccounts();
          showToast(enabled ? 'Cloud Sync enabled (migrated to cloud)' : 'Local storage only (cloud data deleted)');
        } catch (err) {
          console.error('Failed to change sync mode:', err);
          showToast(`Sync error: ${err.message}`);
          toggleCloudSync.checked = !enabled;
        }
      });
    }

    // Close modals on overlay backdrop click
    [addModal, deleteModal, settingsModal, exportModal, decryptModal, shortcutsModal].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            closeModal(modal);
          }
        });
      }
    });
  }

  /**
   * Scan QR from Active Tab
   */
  async function scanCurrentTabScreen() {
    showToast('Scanning active tab for QR codes...');

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.captureVisibleTab) {
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, async (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          showToast('Could not capture tab. Please use file upload.');
          return;
        }

        const img = new Image();
        img.onload = async () => {
          const res = await T68kAuthQR.decodeFromImageElement(img);
          if (res && res.data) {
            handleDecodedQRData(res.data);
          } else {
            showToast('No QR code detected on active screen.');
          }
        };
        img.src = dataUrl;
      });
    } else {
      showToast('Screen scan available inside Chrome extension.');
    }
  }

  /**
   * Handle QR image file selection
   */
  function handleQrFileSelected(e) {
    const file = e.target.files[0];
    if (file) {
      processQrImageFile(file);
    }
    e.target.value = '';
  }

  /**
   * Process QR image file from upload / drop
   */
  function processQrImageFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const res = await T68kAuthQR.decodeFromImageElement(img);
        if (res && res.data) {
          handleDecodedQRData(res.data);
        } else {
          showToast('Could not find QR code in this image.');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Handles decoded QR text (otpauth URI or plain secret)
   */
  async function handleDecodedQRData(qrText) {
    try {
      if (qrText.toLowerCase().startsWith('otpauth://')) {
        const parsed = T68kAuthCrypto.parseOTPAuthURI(qrText);
        const newAcc = await T68kAuthStorage.addAccount(parsed);
        closeModal(addModal);
        await loadAccounts();
        showToast(`Added ${newAcc.issuer}!`);
      } else if (T68kAuthCrypto.isValidBase32(qrText)) {
        const newAcc = await T68kAuthStorage.addAccount({
          secret: qrText,
          issuer: 'Scanned Account',
          account: ''
        });
        closeModal(addModal);
        await loadAccounts();
        showToast(`Added ${newAcc.issuer}!`);
      } else {
        // Switch to manual tab and fill in
        openModal(addModal);
        const manualTab = document.querySelector('[data-tab="tab-manual"]');
        if (manualTab) manualTab.click();
        inputUriSecret.value = qrText;
        showToast('Decoded text placed in manual form.');
      }
    } catch (err) {
      showToast(`Scan error: ${err.message}`);
    }
  }

  /**
   * Opens delete confirmation modal
   */
  function openDeleteModal(accId) {
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return;
    pendingDeleteId = accId;
    deleteTargetNameEl.textContent = acc.issuer + (acc.account ? ` (${acc.account})` : '');
    openModal(deleteModal);
  }

  function openModal(modal) {
    modal.classList.add('active');
  }

  function closeModal(modal) {
    modal.classList.remove('active');
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }

  // Start app on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
