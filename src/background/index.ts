import SettingManager from './setting-manager';
import { copyToClipboard, formatLinks, uniqueLinkURLs } from './utils';
import type { Message } from './types';
import { CopyFormat } from './constants';

const handleMessage = (
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => {
  switch (message.type) {
    case 'activate':
      if (message.action.options.block) {
        if (message.action.options.reverse) {
          const urls = uniqueLinkURLs(message.urls);
          if (message.action.options.reverse) {
            urls.reverse();
          }
          switch (message.action.type) {
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
        }
      }

      break;
    case 'init':
      SettingManager.getInstance()
        .init()
        .then(() => {
          sendResponse(SettingManager.getInstance().getSettings());
        });

      break;
    case 'update':
      break;
  }
  return true;
};

const init = async () => {
  if (!SettingManager.getInstance().isInitialized()) {
    SettingManager.getInstance().init();
    // open popup page
    chrome.runtime.openOptionsPage();
  } else if (!SettingManager.getInstance().isLatestVersion()) {
    SettingManager.getInstance().updateSettings();
  }
};

chrome.runtime.onInstalled.addListener(() => {
  init();
});

chrome.runtime.onStartup.addListener(() => {
  init();
});

chrome.runtime.onMessage.addListener(handleMessage);
