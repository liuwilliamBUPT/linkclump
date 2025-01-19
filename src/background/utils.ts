import { CopyFormat } from './constants';
import type { LinkURL } from './types';

const uniqueLinkURLs = (urls: LinkURL[]) => {
  return urls.reduce((acc, current) => {
    if (acc.find((l) => l.url === current.url)) {
      return acc;
    }
    acc.push(current);
    return acc;
  }, [] as LinkURL[]);
};

const formatLink = (linkURL: LinkURL, copyFormat: CopyFormat) => {
  switch (copyFormat) {
    case CopyFormat.URLS_WITH_TITLES:
      return linkURL.title + '\t' + linkURL.url + '\n';
    case CopyFormat.URLS_ONLY:
      return linkURL.url + '\n';
    case CopyFormat.URLS_ONLY_SPACE_SEPARATED:
      return linkURL.url + ' ';
    case CopyFormat.TITLES_ONLY:
      return linkURL.title + '\n';
    case CopyFormat.AS_LINK_HTML:
      return '<a href="' + linkURL.url + '">' + linkURL.title + '</a>\n';
    case CopyFormat.AS_LIST_LINK_HTML:
      return (
        '<li><a href="' + linkURL.url + '">' + linkURL.title + '</a></li>\n'
      );
    case CopyFormat.AS_MARKDOWN:
      return '[' + linkURL.title + '](' + linkURL.url + ')\n';
  }
};

const formatLinks = (linkURLs: LinkURL[], copyFormat: CopyFormat) => {
  let text = '';

  linkURLs.forEach((linkURL) => {
    text += formatLink(linkURL, copyFormat);
  });

  if (copyFormat === CopyFormat.AS_LIST_LINK_HTML) {
    text = '<ul>\n' + text + '</ul>\n';
  }

  return text;
};

function copyToClipboard(text: string) {
  var copyDiv = document.createElement('textarea');
  copyDiv.contentEditable = true;
  document.body.appendChild(copyDiv);
  copyDiv.innerHTML = text;
  copyDiv.unselectable = 'off';
  copyDiv.focus();
  document.execCommand('SelectAll');
  document.execCommand('Copy', false, undefined);
  document.body.removeChild(copyDiv);
}

export { uniqueLinkURLs, formatLinks, copyToClipboard };
