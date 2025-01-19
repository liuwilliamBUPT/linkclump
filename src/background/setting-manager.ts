import type { Settings } from './types';
import { CURRENT_VERSION } from './constants';

class SettingManager {
  private static instance: SettingManager;
  private settings: Settings | undefined;

  constructor() {
    if (SettingManager.instance == null) {
      SettingManager.instance = this;
      this.init();
    } else {
      return SettingManager.instance;
    }
  }

  async init() {
    chrome.storage.local
      .get('settings')
      .then((data) => {
        if (data.settings) {
          this.settings = data.settings;
        } else {
          this.settings = {
            actions: {
              '101': {
                mouse: 0, // left mouse button
                key: 90, // z key
                type: 'tabs',
                action: 'tabs',
                color: '#FFA500',
                options: {
                  smart: 0,
                  ignore: [0],
                  delay: 0,
                  close: 0,
                  block: true,
                  reverse: false,
                  end: false,
                },
              },
            },
            blocked: [],
          };
        }
      })
      .catch((error) => {
        this.settings = {
          actions: {
            '101': {
              mouse: 0, // left mouse button
              key: 90, // z key
              type: 'tabs',
              action: 'tabs',
              color: '#FFA500',
              options: {
                smart: 0,
                ignore: [0],
                delay: 0,
                close: 0,
                block: true,
                reverse: false,
                end: false,
              },
            },
          },
          blocked: [],
        };
        this.settings.error = 'Error loading settings : ' + error;
        chrome.storage.local.set({ settings: this.settings });
        chrome.storage.local.set({ version: CURRENT_VERSION });
      });
  }

  getSettings() {
    return this.settings;
  }

  saveSettings() {
    if (this.settings?.error !== undefined) {
      delete this.settings.error;
    }
    chrome.storage.local.set({ settings: this.settings });
  }

  async isInitialized() {
    const data = await chrome.storage.local.get('version');
    return data.version !== undefined;
  }

  async isLatestVersion() {
    const data = await chrome.storage.local.get('version');
    return data.version === CURRENT_VERSION;
  }

  async updateSettings() {
    if (!this.isInitialized()) {
      this.init();
    }
  }

  static getInstance() {
    if (SettingManager.instance == null) {
      SettingManager.instance = new SettingManager();
    }
    return SettingManager.instance;
  }
}

export default SettingManager;
