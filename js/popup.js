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

  // Theme Elements
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const selectThemeSetting = document.getElementById('select-theme-setting');
  const iconSun = btnThemeToggle ? btnThemeToggle.querySelector('.icon-sun') : null;
  const iconMoon = btnThemeToggle ? btnThemeToggle.querySelector('.icon-moon') : null;

  // State
  let accounts = [];
  let currentFilter = '';
  let pendingDeleteId = null;
  let toastTimeout = null;
  let currentTheme = 'light';
  let currentThemeColor = 'green';
  let codeCache = {}; // { [accountId]: { code: string, epochWindow: number } }

  /**
   * Initialize Application
   */
  async function init() {
    await initTheme();
    await initSyncSetting();
    setupEventListeners();
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
        if (!!a.pinned !== !!b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

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

    // Build markup for accounts
    accountListEl.innerHTML = filtered.map(acc => {
      const brand = T68kAuthCrypto.getIssuerBrandInfo(acc.issuer || 'Account');
      const cached = codeCache[acc.id] ? codeCache[acc.id].code : '------';
      const formattedCode = T68kAuthCrypto.formatCode(cached);

      return `
        <div class="totp-card ${acc.pinned ? 'pinned' : ''}" data-id="${acc.id}" tabindex="0">
          <div class="card-header">
            <div class="account-info">
              <div class="account-avatar" style="background: ${brand.color}">
                ${brand.initial}
              </div>
              <div class="account-meta">
                <span class="account-issuer">${escapeHtml(acc.issuer || 'Account')}</span>
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
              <button class="btn-card-action btn-pin ${acc.pinned ? 'active' : ''}" data-action="pin" data-id="${acc.id}" title="${acc.pinned ? 'Unpin account' : 'Pin to top'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${acc.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </button>
              <button class="btn-card-action btn-copy" data-action="copy" data-id="${acc.id}" title="Copy code">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button class="btn-card-action btn-delete" data-action="delete" data-id="${acc.id}" title="Delete account">
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
      const pinBtn = e.target.closest('[data-action="pin"]');
      const copyBtn = e.target.closest('[data-action="copy"]');
      const deleteBtn = e.target.closest('[data-action="delete"]');
      const card = e.target.closest('.totp-card');

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
        copyAccountCode(card.dataset.id);
      }
    });

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

    btnExportBackup.addEventListener('click', async () => {
      const backupJson = await T68kAuthStorage.exportBackup();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `t68k-authenticator-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup downloaded!');
    });

    btnImportBackup.addEventListener('click', () => backupFileInput.click());
    backupFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const result = await T68kAuthStorage.importBackup(evt.target.result);
          await loadAccounts();
          closeModal(settingsModal);
          showToast(`Imported ${result.importedCount} accounts!`);
        } catch (err) {
          showToast(`Import failed: ${err.message}`);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
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
    [addModal, deleteModal, settingsModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal(modal);
        }
      });
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
