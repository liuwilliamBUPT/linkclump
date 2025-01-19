// 将 openTab 函数移到顶层作用域
function openTab(urls, delay, windowId, openerTabId, tabPosition, closeTime) {
  return new Promise((resolve) => {
    const obj = {
      windowId,
      url: urls[0].url,
      active: false,
    };

    if (!delay) {
      obj.openerTabId = openerTabId;
    }

    if (tabPosition != null) {
      obj.index = tabPosition;
    }

    chrome.tabs.create(obj, (tab) => {
      if (closeTime > 0) {
        setTimeout(() => {
          chrome.tabs.remove(tab.id);
        }, closeTime * 1000);
      }

      const remainingUrls = urls.slice(1);
      if (remainingUrls.length > 0) {
        setTimeout(() => {
          openTab(remainingUrls, delay, windowId, openerTabId, tabPosition + 1, closeTime)
            .then(resolve);
        }, delay * 1000);
      } else {
        resolve();
      }
    });
  });
}

(async () => {
  // 常量定义
  const CopyFormat = {
    URLS_WITH_TITLES: 0,
    URLS_ONLY: 1,
    URLS_ONLY_SPACE_SEPARATED: 2,
    TITLES_ONLY: 3,
    AS_LINK_HTML: 4,
    AS_LIST_LINK_HTML: 5,
    AS_MARKDOWN: 6,
  };

  // 工具函数
  const uniqueUrls = (urls) => {
    const seen = new Set();
    return urls.filter(({ url }) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  };

  const pad = (number, length) => String(number).padStart(length, '0');

  const timeConverter = (date) => {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1, 2);
    const day = pad(date.getDate(), 2);
    const hour = pad(date.getHours(), 2);
    const min = pad(date.getMinutes(), 2);
    const sec = pad(date.getSeconds(), 2);
    return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
  };

  const formatLink = ({ url, title }, copyFormat) => {
    switch (parseInt(copyFormat)) {
      case CopyFormat.URLS_WITH_TITLES:
        return `${title}\t${url}\n`;
      case CopyFormat.URLS_ONLY:
        return `${url}\n`;
      case CopyFormat.URLS_ONLY_SPACE_SEPARATED:
        return `${url} `;
      case CopyFormat.TITLES_ONLY:
        return `${title}\n`;
      case CopyFormat.AS_LINK_HTML:
        return `<a href="${url}">${title}</a>\n`;
      case CopyFormat.AS_LIST_LINK_HTML:
        return `<li><a href="${url}">${title}</a></li>\n`;
      case CopyFormat.AS_MARKDOWN:
        return `[${title}](${url})\n`;
    }
  };

  // SettingsManager 类定义
  class SettingsManager {
    load() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['settings'], (result) => {
          try {
            resolve(result.settings ? JSON.parse(result.settings) : this.init());
          } catch (error) {
            const settings = this.init();
            settings.error = `Error: ${error}`;
            resolve(settings);
          }
        });
      });
    }

    save(settings) {
      return new Promise((resolve) => {
        if (settings.error !== undefined) {
          delete settings.error;
        }
        chrome.storage.local.set({ settings: JSON.stringify(settings) }, resolve);
      });
    }

    isInit() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['version'], (result) => {
          resolve(result.version !== undefined);
        });
      });
    }

    isLatest() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['version'], (result) => {
          resolve(result.version === '6');
        });
      });
    }

    init() {
      const settings = {
        actions: {
          101: {
            mouse: 0,
            key: 90,
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

      chrome.storage.local.set({
        settings: JSON.stringify(settings),
        version: '6'
      });

      return settings;
    }

    update() {
      return this.isInit().then(isInit => {
        if (!isInit) {
          return this.init();
        }
      });
    }
  }

  // 创建实例
  const settingsManager = new SettingsManager();

  // 其他函数定义
  const copyToClipboard = async (text) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleRequests = async (request, sender, callback) => {
    switch (request.message) {
      case 'activate': {
        if (request.setting.options.block) {
          request.urls = uniqueUrls(request.urls);
        }

        if (request.urls.length === 0) return;

        if (request.setting.options.reverse) {
          request.urls.reverse();
        }

        handleAction(request, sender).then(() => {
          callback({ success: true });
        }).catch(error => {
          console.error('Action handling failed:', error);
          callback({ success: false, error: error.message });
        });

        return true;
      }

      case 'init':
        settingsManager.load().then(settings => {
          callback(settings);
        }).catch(error => {
          console.error('Failed to load settings:', error);
          callback({ error: error.message });
        });
        return true;

      case 'update':
        settingsManager.save(request.settings).then(() => {
          return chrome.windows.getAll({ populate: true });
        }).then(windows => {
          const updatePromises = windows.flatMap(window =>
            window.tabs.map(tab =>
              settingsManager.load().then(settings =>
                chrome.tabs.sendMessage(tab.id, {
                  message: 'update',
                  settings
                }).catch(() => {/* 忽略发送失败的标签页 */})
              )
            )
          );
          return Promise.all(updatePromises);
        }).then(() => {
          callback({ success: true });
        }).catch(error => {
          console.error('Update failed:', error);
          callback({ success: false, error: error.message });
        });
        return true;

      default:
        callback({ error: 'Unknown message type' });
        return false;
    }
  };

  // 注册事件监听器
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const response = handleRequests(request, sender, sendResponse);
    if (response instanceof Promise) {
      response.catch(console.error);
      return true;
    }
    return false;
  });

  chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
    settingsManager.isInit().then(isInit => {
      if (!isInit) {
        settingsManager.init();
        // ... 其他初始化代码 ...
      } else {
        settingsManager.isLatest().then(isLatest => {
          if (!isLatest) {
            settingsManager.update();
          }
        });
      }
    });
  });

  // 初始化逻辑
  if (!(await settingsManager.isInit())) {
    await settingsManager.init();

    const windows = await chrome.windows.getAll({ populate: true });
    await Promise.all(
      windows.flatMap(window =>
        window.tabs
          .filter(tab => /^https?:\/\//.test(tab.url))
          .map(tab =>
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['linkclump.js'],
              injectImmediately: true
            }).catch(err => console.error(`Failed to inject into tab ${tab.id}:`, err))
          )
      )
    );

    // 使用 chrome.runtime.getURL 获取完整路径
    const optionsUrl = chrome.runtime.getURL('pages/options.html?init=true');

    // 获取屏幕尺寸
    const width = 800;
    const height = 850;
    const left = Math.max(0, Math.floor((window.screen.width - width) / 2));
    const top = Math.max(0, Math.floor((window.screen.height - height) / 2));

    await chrome.windows.create({
      url: optionsUrl,
      type: 'popup',
      width,
      height,
      left,
      top
    });
  } else if (!(await settingsManager.isLatest())) {
    await settingsManager.update();
  }
})().catch(err => {
  console.error('Service Worker initialization failed:', err);
});

// 处理不同动作的辅助函数
async function handleAction(request, sender) {
  switch (request.setting.action) {
    case 'copy': {
      const text = request.urls
        .map(url => formatLink(url, request.setting.options.copy))
        .join('');

      const finalText = request.setting.options.copy === CopyFormat.AS_LIST_LINK_HTML
        ? `<ul>\n${text}</ul>\n`
        : text;

      await copyToClipboard(finalText);
      break;
    }

    case 'bm': {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const folder = await chrome.bookmarks.create({
        parentId: bookmarkTree[0].children[1].id,
        title: `Linkclump ${timeConverter(new Date())}`,
      });

      await Promise.all(request.urls.map(({ title, url }) =>
        chrome.bookmarks.create({
          parentId: folder.id,
          title,
          url,
        })
      ));
      break;
    }

    case 'win': {
      const currentWindow = await chrome.windows.getCurrent();
      const [firstUrl, ...remainingUrls] = request.urls;

      const newWindow = await chrome.windows.create({
        url: firstUrl.url,
        focused: !request.setting.options.unfocus,
      });

      if (remainingUrls.length > 0) {
        await openTab(
          remainingUrls,
          request.setting.options.delay,
          newWindow.id,
          undefined,
          null,
          0
        );
      }

      if (request.setting.options.unfocus) {
        await chrome.windows.update(currentWindow.id, { focused: true });
      }
      break;
    }

    case 'tabs': {
      const tab = await chrome.tabs.get(sender.tab.id);
      const window = await chrome.windows.getCurrent();
      const tabIndex = !request.setting.options.end ? tab.index + 1 : null;

      await openTab(
        request.urls,
        request.setting.options.delay,
        window.id,
        tab.id,
        tabIndex,
        request.setting.options.close
      );
      break;
    }

    default:
      throw new Error('Unknown action type');
  }
}
