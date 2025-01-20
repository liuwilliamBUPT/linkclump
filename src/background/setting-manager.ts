import type { Settings, Action } from './types';
import { CURRENT_VERSION } from './constants';

class SettingManager {
  private static instance: SettingManager;
  private settings: Settings | null = null;

  private constructor() {}

  private getDefaultSettings(): Settings {
    return {
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

  async init() {
    try {
      const data = await chrome.storage.local.get(['settings', 'version']);
      if (data.settings) {
        this.settings = JSON.parse(data.settings);
      } else {
        this.settings = this.getDefaultSettings();
        await chrome.storage.local.set({
          settings: JSON.stringify(this.settings),
          version: CURRENT_VERSION
        });
      }
      return this.settings;
    } catch (error) {
      console.error('Error initializing settings:', error);
      this.settings = this.getDefaultSettings();
      await chrome.storage.local.set({
        settings: JSON.stringify(this.settings),
        version: CURRENT_VERSION
      });
      return this.settings;
    }
  }

  async getSettings() {
    if (!this.settings) {
      return this.init();
    }
    return this.settings;
  }

  async saveAction(actionId: string, action: Action) {
    if (!this.settings) {
      await this.init();
    }

    if (this.settings) {
      this.settings.actions[actionId] = action;
      await chrome.storage.local.set({
        settings: JSON.stringify(this.settings),
        version: CURRENT_VERSION
      });
    }
  }

  async isInitialized() {
    const data = await chrome.storage.local.get('version');
    return data.version !== undefined;
  }

  async isLatestVersion() {
    const data = await chrome.storage.local.get('version');
    return data.version === CURRENT_VERSION;
  }

  static getInstance(): SettingManager {
    if (!SettingManager.instance) {
      SettingManager.instance = new SettingManager();
    }
    return SettingManager.instance;
  }
}

export default SettingManager;
