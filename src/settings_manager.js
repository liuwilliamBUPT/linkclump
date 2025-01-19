const CURRENT_VERSION = '6';

class SettingsManager {
  load() {
    try {
      // Load data from local storage
      const data = chrome.storage.local['settings'];

      // Attempt to parse, if unable then make the assumption it has been corrupted
      return JSON.parse(data);
    } catch (error) {
      const settings = this.init();
      settings.error = `Error: ${error}`;
      return settings;
    }
  }

  save(settings) {
    // Remove any error messages from object (shouldn't be there)
    if (settings.error !== undefined) {
      delete settings.error;
    }

    chrome.storage.local['settings'] = JSON.stringify(settings);
  }

  isInit() {
    return chrome.storage.local['version'] !== undefined;
  }

  isLatest() {
    return chrome.storage.local['version'] === CURRENT_VERSION;
  }

  init() {
    // Create default settings for first-time user
    const settings = {
      actions: {
        101: {
          mouse: 0, // Left mouse button
          key: 90, // Z key
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

    // Save settings to store
    chrome.storage.local['settings'] = JSON.stringify(settings);
    chrome.storage.local['version'] = CURRENT_VERSION;

    return settings;
  }

  update() {
    if (!this.isInit()) {
      this.init();
    }
  }
}

export { SettingsManager };
