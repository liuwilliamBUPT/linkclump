import SettingManager from './setting-manager';
import { copyToClipboard, formatLinks, uniqueLinkURLs } from './utils';
import type { LinkURL, Message } from './types';
import { CopyFormat } from './constants';

const handleMessage = (
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => {
  const settingManager = SettingManager.getInstance();

  switch (message.type) {
    case 'activate':
      let urls: LinkURL[] = message.urls ?? [];
      if (urls.length === 0) {
        return;
      }

      if (message.action?.options.block) {
        urls = uniqueLinkURLs(urls);
      }

      if (message.action?.options.reverse) {
        urls.reverse();
      }

      switch (message.action?.type) {
        case 'copy':
          const text = formatLinks(
            urls,
            message.action.options.copyFormat ?? CopyFormat.URLS_WITH_TITLES
          );
          copyToClipboard(text);
          break;
        case 'bookmark':
          break;
        case 'win':
          break;
        case 'tabs':
          break;
      }

      break;
    case 'init':
      settingManager
        .getSettings()
        .then((settings) => {
          console.log('Sending settings:', settings);
          sendResponse(settings);
        })
        .catch((error) => {
          console.error('Failed to get settings:', error);
          sendResponse(null);
        });
      return true;
    case 'update':
      SettingManager.getInstance().saveSettings(message.settings);
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs
              .sendMessage(tab.id, {
                type: 'settingsUpdated',
                settings: message.settings,
              })
              .catch(() => {
                // 忽略不能发送消息的标签页
              });
          }
        });
      });
      sendResponse({ success: true });
      break;
    case 'updateAction':
      if (message.actionId && message.action) {
        settingManager
          .saveAction(message.actionId, message.action)
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error('Failed to save action:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true;
      }
      break;
  }

  return true;
};

const initExtension = async () => {
  const settingManager = SettingManager.getInstance();
  await settingManager.init();
};

chrome.runtime.onInstalled.addListener(() => {
  initExtension();
});

chrome.runtime.onStartup.addListener(() => {
  initExtension();
});

chrome.runtime.onMessage.addListener(handleMessage);
