/**
 * T68k Authenticator - Storage & Persistence Engine
 * Handles chrome.storage.local / sync with fallback to localStorage
 */

(function(global) {
  'use strict';

  const STORAGE_KEY = 't68k_auth_accounts_v1';
  const SETTINGS_KEY = 't68k_auth_settings_v1';

  // Check storage capabilities
  const isChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const isChromeSync = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;

  /**
   * Generates a random UUID-like ID
   */
  function generateId() {
    return 'totp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Retrieves extension settings from local storage
   */
  async function getSettings() {
    return new Promise((resolve) => {
      if (isChromeStorage) {
        chrome.storage.local.get([SETTINGS_KEY], (res) => {
          resolve(res && res[SETTINGS_KEY] ? res[SETTINGS_KEY] : { theme: 'light', themeColor: 'green', syncEnabled: false });
        });
      } else {
        try {
          const raw = localStorage.getItem(SETTINGS_KEY);
          resolve(raw ? JSON.parse(raw) : { theme: 'light', themeColor: 'green', syncEnabled: false });
        } catch {
          resolve({ theme: 'light', themeColor: 'green', syncEnabled: false });
        }
      }
    });
  }

  /**
   * Updates settings object in local storage
   */
  async function saveSettings(updates) {
    const current = await getSettings();
    const merged = { ...current, ...updates };
    return new Promise((resolve) => {
      if (isChromeStorage) {
        chrome.storage.local.set({ [SETTINGS_KEY]: merged }, () => resolve(merged));
      } else {
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
        } catch {
          // ignore
        }
        resolve(merged);
      }
    });
  }

  /**
   * Merges two account lists deduplicating by id and secret
   */
  function mergeAccountLists(primary, secondary) {
    const result = [...primary];
    for (const item of secondary) {
      if (!item) continue;
      const exists = result.some(a => a.id === item.id || (a.secret && a.secret === item.secret));
      if (!exists) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Reads raw accounts directly from local storage (bypassing sync flag)
   */
  async function getLocalAccounts() {
    return new Promise((resolve) => {
      if (isChromeStorage) {
        chrome.storage.local.get([STORAGE_KEY], (res) => {
          resolve(res[STORAGE_KEY] || []);
        });
      } else {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          resolve(raw ? JSON.parse(raw) : []);
        } catch {
          resolve([]);
        }
      }
    });
  }

  /**
   * Reads raw accounts directly from cloud sync storage
   */
  async function getSyncAccounts() {
    return new Promise((resolve) => {
      if (isChromeSync) {
        chrome.storage.sync.get([STORAGE_KEY], (res) => {
          if (chrome.runtime.lastError) {
            resolve([]);
          } else {
            resolve(res[STORAGE_KEY] || []);
          }
        });
      } else {
        resolve([]);
      }
    });
  }

  /**
   * Writes raw accounts directly to local storage
   */
  async function setLocalAccounts(accounts) {
    return new Promise((resolve, reject) => {
      if (isChromeStorage) {
        chrome.storage.local.set({ [STORAGE_KEY]: accounts }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(true);
        });
      } else {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
          resolve(true);
        } catch (e) {
          reject(e);
        }
      }
    });
  }

  /**
   * Writes raw accounts directly to cloud sync storage
   */
  async function setSyncAccounts(accounts) {
    return new Promise((resolve, reject) => {
      if (isChromeSync) {
        chrome.storage.sync.set({ [STORAGE_KEY]: accounts }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(true);
        });
      } else {
        resolve(true);
      }
    });
  }

  /**
   * Clears accounts data from cloud sync storage
   */
  async function clearSyncAccounts() {
    return new Promise((resolve) => {
      if (isChromeSync) {
        chrome.storage.sync.remove([STORAGE_KEY], () => {
          resolve(true);
        });
      } else {
        resolve(true);
      }
    });
  }

  /**
   * Checks if cloud sync via chrome.storage.sync is enabled (default: false)
   */
  async function isSyncEnabled() {
    const settings = await getSettings();
    return Boolean(settings.syncEnabled);
  }

  /**
   * Gets the current sync setting
   */
  async function getSyncEnabled() {
    return isSyncEnabled();
  }

  /**
   * Enables or disables cloud sync with automatic data migration:
   * - Enabling: copies / merges local accounts into Chrome Cloud Sync
   * - Disabling: copies / merges cloud accounts into local storage, then deletes cloud data
   */
  async function setSyncEnabled(enabled) {
    const isEnabling = Boolean(enabled);
    const localAccounts = await getLocalAccounts();
    const syncAccounts = await getSyncAccounts();

    if (isEnabling) {
      // Migrate / merge local accounts into cloud sync
      const mergedForSync = mergeAccountLists(syncAccounts, localAccounts);
      if (isChromeSync) {
        await setSyncAccounts(mergedForSync);
      }
    } else {
      // Migrate / merge cloud sync accounts back to local storage
      const mergedForLocal = mergeAccountLists(localAccounts, syncAccounts);
      await setLocalAccounts(mergedForLocal);
      // Delete cloud data from chrome.storage.sync for security
      await clearSyncAccounts();
    }

    await saveSettings({ syncEnabled: isEnabling });
    return isEnabling;
  }

  /**
   * Reads raw accounts from storage based on sync setting
   */
  async function getAccounts() {
    const sync = await isSyncEnabled();
    return new Promise((resolve) => {
      if (sync && isChromeSync) {
        chrome.storage.sync.get([STORAGE_KEY], (res) => {
          if (chrome.runtime.lastError) {
            // Fallback to local
            chrome.storage.local.get([STORAGE_KEY], (localRes) => {
              resolve(localRes[STORAGE_KEY] || []);
            });
          } else {
            resolve(res[STORAGE_KEY] || []);
          }
        });
      } else if (isChromeStorage) {
        chrome.storage.local.get([STORAGE_KEY], (localRes) => {
          resolve(localRes[STORAGE_KEY] || []);
        });
      } else {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          resolve(raw ? JSON.parse(raw) : []);
        } catch {
          resolve([]);
        }
      }
    });
  }

  /**
   * Saves raw accounts array into storage based on sync setting
   */
  async function saveAccounts(accounts) {
    const sync = await isSyncEnabled();
    return new Promise((resolve, reject) => {
      if (sync && isChromeSync) {
        chrome.storage.sync.set({ [STORAGE_KEY]: accounts }, () => {
          if (chrome.runtime.lastError) {
            // Fallback to local
            chrome.storage.local.set({ [STORAGE_KEY]: accounts }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(true);
              }
            });
          } else {
            resolve(true);
          }
        });
      } else if (isChromeStorage) {
        chrome.storage.local.set({ [STORAGE_KEY]: accounts }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(true);
          }
        });
      } else {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
          resolve(true);
        } catch (e) {
          reject(e);
        }
      }
    });
  }

  /**
   * Adds a single account
   */
  async function addAccount(accountData) {
    const accounts = await getAccounts();
    const newAcc = {
      id: generateId(),
      issuer: (accountData.issuer || 'Account').trim(),
      account: (accountData.account || '').trim(),
      secret: accountData.secret.replace(/\s+/g, '').toUpperCase(),
      algorithm: accountData.algorithm || 'SHA-1',
      digits: parseInt(accountData.digits, 10) || 6,
      period: parseInt(accountData.period, 10) || 30,
      pinned: !!accountData.pinned,
      createdAt: Date.now()
    };
    accounts.push(newAcc);
    await saveAccounts(accounts);
    return newAcc;
  }

  /**
   * Updates an existing account
   */
  async function updateAccount(id, updates) {
    const accounts = await getAccounts();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx === -1) return null;

    accounts[idx] = {
      ...accounts[idx],
      ...updates,
      id: accounts[idx].id // Protect ID immutability
    };
    await saveAccounts(accounts);
    return accounts[idx];
  }

  /**
   * Deletes an account by ID
   */
  async function deleteAccount(id) {
    const accounts = await getAccounts();
    const target = accounts.find(a => a.id === id);
    if (!target) return null;

    const filtered = accounts.filter(a => a.id !== id);
    await saveAccounts(filtered);
    return target;
  }

  /**
   * Toggles pinned state
   */
  async function togglePin(id) {
    const accounts = await getAccounts();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx === -1) return false;

    accounts[idx].pinned = !accounts[idx].pinned;
    await saveAccounts(accounts);
    return accounts[idx].pinned;
  }

  /**
   * Exports backup JSON string
   */
  async function exportBackup() {
    const accounts = await getAccounts();
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      generator: 'T68k Authenticator Chrome Extension',
      accounts: accounts.map(a => ({
        issuer: a.issuer,
        account: a.account,
        secret: a.secret,
        algorithm: a.algorithm,
        digits: a.digits,
        period: a.period,
        pinned: !!a.pinned
      }))
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Imports backup JSON string
   */
  async function importBackup(jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON format');
    }

    const incoming = Array.isArray(parsed) ? parsed : (parsed.accounts || []);
    if (!Array.isArray(incoming) || incoming.length === 0) {
      throw new Error('No valid accounts found in file');
    }

    const existing = await getAccounts();
    let importedCount = 0;

    for (const item of incoming) {
      if (item.secret) {
        // Prevent duplicate exact secrets if desired
        const exists = existing.some(e => e.secret === item.secret.replace(/\s+/g, '').toUpperCase());
        if (!exists) {
          existing.push({
            id: generateId(),
            issuer: (item.issuer || 'Account').trim(),
            account: (item.account || '').trim(),
            secret: item.secret.replace(/\s+/g, '').toUpperCase(),
            algorithm: item.algorithm || 'SHA-1',
            digits: parseInt(item.digits, 10) || 6,
            period: parseInt(item.period, 10) || 30,
            pinned: !!item.pinned,
            createdAt: Date.now()
          });
          importedCount++;
        }
      }
    }

    await saveAccounts(existing);
    return { importedCount, totalAccounts: existing.length };
  }

  /**
   * Retrieves user theme preference ('light' or 'dark')
   */
  async function getTheme() {
    const settings = await getSettings();
    return settings.theme || 'light';
  }

  /**
   * Saves user theme preference
   */
  async function setTheme(theme) {
    await saveSettings({ theme });
    return true;
  }

  /**
   * Retrieves user theme color preference ('green', 'blue', 'purple', 'cyan', 'orange', 'rose')
   */
  async function getThemeColor() {
    const settings = await getSettings();
    return settings.themeColor || 'green';
  }

  /**
   * Saves user theme color preference
   */
  async function setThemeColor(themeColor) {
    await saveSettings({ themeColor });
    return true;
  }

  global.T68kAuthStorage = {
    getAccounts,
    saveAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
    togglePin,
    exportBackup,
    importBackup,
    getTheme,
    setTheme,
    getThemeColor,
    setThemeColor,
    getSyncEnabled,
    setSyncEnabled
  };
})(typeof window !== 'undefined' ? window : this);
