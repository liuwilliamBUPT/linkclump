import { CopyFormat } from '../background/constants';
import type { LinkURL, Message, Settings } from '../background/types';
import { formatLinks, uniqueLinkURLs } from '../background/utils';
import {
  END_KEYCODE,
  EXCLUDE_LINKS,
  HOME_KEYCODE,
  INCLUDE_LINKS,
  LEFT_BUTTON,
  OS_LINUX,
  OS_WIN,
  Z_INDEX,
} from './constants';
type RuntimeContext = {
  scrollId: any;
  mouseX: number;
  mouseY: number;
  timer: number;
  os: number;
  smartSelect: boolean;
  links: LinkURL[];
  boxOn: boolean;
  countLabel: HTMLElement | null;
  box:
    | (HTMLElement & {
        x?: number;
        y?: number;
        x1?: number;
        x2?: number;
        y1?: number;
        y2?: number;
      })
    | null;
  currentAction: string;
  mouseButton: number;
  settings: Settings | null;
  allowed: boolean;
  keyPressed: number;
  stopMenu: boolean;
  scrollBugIgnore: boolean;
};

const runtimeContext: RuntimeContext = {
  settings: null,
  allowed: false,
  keyPressed: 0,
  stopMenu: false,
  scrollBugIgnore: false,
  mouseButton: 0,
  box: null,
  currentAction: '',
  boxOn: false,
  countLabel: null,
  links: [],
  smartSelect: false,
  os: 0,
  timer: 0,
  mouseX: 0,
  mouseY: 0,
  scrollId: undefined,
};

function allowSelection() {
  for (let i in runtimeContext.settings?.actions) {
    // need to check if key is 0 as key_pressed might not be accurate
    if (
      runtimeContext.settings?.actions[i].mouse == runtimeContext.mouseButton &&
      runtimeContext.settings?.actions[i].key == runtimeContext.keyPressed
    ) {
      runtimeContext.currentAction = i;
      if (runtimeContext.box !== null) {
        (runtimeContext.box as HTMLElement).style.border =
          '2px dotted ' + runtimeContext.settings?.actions[i].color;
      }
      return true;
    }
  }
  return false;
}

function cleanUp() {
  // remove the box
  if (runtimeContext.box) {
    runtimeContext.box.style.visibility = 'hidden';
  }
  if (runtimeContext.countLabel) {
    runtimeContext.countLabel.style.visibility = 'hidden';
  }
  runtimeContext.boxOn = false;

  // remove the link boxes
  for (let i = 0; i < runtimeContext.links.length; i++) {
    const { box } = runtimeContext.links[i];
    if (box !== null) {
      document.body.removeChild(box);
      runtimeContext.links[i].box = null;
    }
  }
  runtimeContext.links = [];

  // wipe clean the smart select
  runtimeContext.smartSelect = false;
  runtimeContext.mouseButton = -1;
  runtimeContext.keyPressed = 0;
}

function allowKey(keyCode: number) {
  if (!runtimeContext.settings) {
    return false;
  }
  const { actions = {} } = runtimeContext.settings;
  for (const action of Object.values(actions)) {
    if (action.key === keyCode) {
      return true;
    }
  }
  return false;
}

function removeKey() {
  // turn menu on for linux
  if (OS_LINUX) {
    runtimeContext.stopMenu = false;
  }
  runtimeContext.keyPressed = 0;
}

function keydown(event: KeyboardEvent) {
  if (event.keyCode != END_KEYCODE && event.keyCode != HOME_KEYCODE) {
    runtimeContext.keyPressed = event.keyCode;
    // turn menu off for linux
    if (OS_LINUX && allowKey(runtimeContext.keyPressed)) {
      runtimeContext.stopMenu = true;
    }
  } else {
    runtimeContext.scrollBugIgnore = true;
  }
}

function blur() {
  removeKey();
}

function keyup(event: KeyboardEvent) {
  if (event.keyCode != END_KEYCODE && event.keyCode != HOME_KEYCODE) {
    removeKey();
  }
}

function contextmenu(event: MouseEvent) {
  if (runtimeContext.stopMenu) {
    event.preventDefault();
  }
}

function preventEscalation(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();
}

function updateBox(x: number, y: number) {
  let width = Math.max(
    document.documentElement['clientWidth'],
    document.body['scrollWidth'],
    document.documentElement['scrollWidth'],
    document.body['offsetWidth'],
    document.documentElement['offsetWidth']
  ); // taken from jquery
  let height = Math.max(
    document.documentElement['clientHeight'],
    document.body['scrollHeight'],
    document.documentElement['scrollHeight'],
    document.body['offsetHeight'],
    document.documentElement['offsetHeight']
  ); // taken from jquery
  x = Math.min(x, width - 7);
  y = Math.min(y, height - 7);

  const { box, countLabel } = runtimeContext;
  if (box && countLabel) {
    if (x > (box?.x ?? 0)) {
      box.x1 = box.x;
      box.x2 = x;
    } else {
      box.x1 = x;
      box.x2 = box.x;
    }
    if (y > (box.y ?? 0)) {
      box.y1 = box.y;
      box.y2 = y;
    } else {
      box.y1 = y;
      box.y2 = box.y;
    }

    box.style.left = box.x1 + 'px';
    box.style.width = (box.x2 ?? 0) - (box.x1 ?? 0) + 'px';
    box.style.top = box.y1 + 'px';
    box.style.height = (box.y2 ?? 0) - (box.y1 ?? 0) + 'px';

    countLabel.style.left = x - 15 + 'px';
    countLabel.style.top = y - 15 + 'px';
  }
}

function getXY(element: HTMLElement) {
  let x = 0;
  let y = 0;

  let parent = element;
  let style;
  let matrix;
  do {
    style = window.getComputedStyle(parent);
    matrix = new WebKitCSSMatrix(style.transform);
    x += parent.offsetLeft + matrix.m41;
    y += parent.offsetTop + matrix.m42;
  } while ((parent = parent.offsetParent as HTMLElement));

  parent = element;
  while (parent && parent !== document.body) {
    if (parent.scrollLeft) {
      x -= parent.scrollLeft;
    }
    if (parent.scrollTop) {
      y -= parent.scrollTop;
    }
    parent = parent.parentNode as HTMLElement;
  }

  return {
    x: x,
    y: y,
  };
}

function start() {
  // stop user from selecting text/elements
  document.body.style.userSelect = 'none';

  // turn on the box
  if (runtimeContext.box) {
    runtimeContext.box.style.visibility = 'visible';
  }
  if (runtimeContext.countLabel) {
    runtimeContext.countLabel.style.visibility = 'visible';
  }

  // find all links (find them each time as they could have moved)
  const pageLinks = document.links as HTMLCollectionOf<LinkURL>;
  // create RegExp once
  const re1 = new RegExp('^javascript:', 'i');
  const re2 = new RegExp(
    runtimeContext.settings?.actions[
      runtimeContext.currentAction
    ].options.ignore
      .slice(1)
      .join('|') ?? '',
    'i'
  );
  const re3 = new RegExp('^H\\d$');

  for (let i = 0; i < pageLinks.length; i++) {
    // reject javascript: links
    if (re1.test(pageLinks[i].href)) {
      continue;
    }

    // reject href="" or href="#"
    if (
      !pageLinks[i].getAttribute('href') ||
      pageLinks[i].getAttribute('href') === '#'
    ) {
      continue;
    }

    // include/exclude links
    if (
      (runtimeContext.settings?.actions[runtimeContext.currentAction].options
        .ignore.length ?? 0) > 1
    ) {
      if (re2.test(pageLinks[i].href) || re2.test(pageLinks[i].innerHTML)) {
        if (
          runtimeContext.settings?.actions[runtimeContext.currentAction].options
            .ignore[0] == EXCLUDE_LINKS
        ) {
          continue;
        }
      } else if (
        runtimeContext.settings?.actions[runtimeContext.currentAction].options
          .ignore[0] == INCLUDE_LINKS
      ) {
        continue;
      }
    }

    // attempt to ignore invisible links (can't ignore overflow)
    const comp = window.getComputedStyle(pageLinks[i], null);
    if (comp.visibility == 'hidden' || comp.display == 'none') {
      continue;
    }

    const pos = getXY(pageLinks[i]);
    let width = pageLinks[i].offsetWidth;
    let height = pageLinks[i].offsetHeight;

    // attempt to get the actual size of the link
    for (let k = 0; k < pageLinks[i].childNodes.length; k++) {
      if (pageLinks[i].childNodes[k].nodeName == 'IMG') {
        const pos2 = getXY(pageLinks[i].childNodes[k] as HTMLElement);
        if (pos.y >= pos2.y) {
          pos.y = pos2.y;

          width = Math.max(
            width,
            (pageLinks[i].childNodes[k] as HTMLElement).offsetWidth
          );
          height = Math.max(
            height,
            (pageLinks[i].childNodes[k] as HTMLElement).offsetHeight
          );
        }
      }
    }

    pageLinks[i].x1 = pos.x;
    pageLinks[i].y1 = pos.y;
    pageLinks[i].x2 = pos.x + width;
    pageLinks[i].y2 = pos.y + height;
    pageLinks[i].height = height;
    pageLinks[i].width = width;
    pageLinks[i].box = null;
    pageLinks[i].important =
      runtimeContext.settings?.actions[runtimeContext.currentAction].options
        .smart == 0 &&
      pageLinks[i].parentNode != null &&
      re3.test(pageLinks[i].parentNode?.nodeName ?? '');

    runtimeContext.links.push(pageLinks[i]);
  }

  runtimeContext.boxOn = true;

  // turn off menu for windows so mouse up doesn't trigger context menu
  if (runtimeContext.os === OS_WIN) {
    runtimeContext.stopMenu = true;
  }
}

function detect(x: number, y: number, open: boolean) {
  runtimeContext.mouseX = x;
  runtimeContext.mouseY = y;

  if (!runtimeContext.boxOn) {
    if (
      (runtimeContext.box?.x2 ?? 0) - (runtimeContext.box?.x1 ?? 0) < 5 &&
      (runtimeContext.box?.y2 ?? 0) - (runtimeContext.box?.y1 ?? 0) < 5
    ) {
      return true;
    } else {
      start();
    }
  }

  if (!runtimeContext.scrollId) {
    runtimeContext.scrollId = setInterval(scroll, 100);
  }

  let count = 0;
  const countTabs = new Set<string>();
  let openTabs: LinkURL[] = [];
  for (let i = 0; i < runtimeContext.links.length; i++) {
    if (
      (!runtimeContext.smartSelect || runtimeContext.links[i].important) &&
      !(
        runtimeContext.links[i].x1 > (runtimeContext.box?.x2 ?? 0) ||
        runtimeContext.links[i].x2 < (runtimeContext.box?.x1 ?? 0) ||
        runtimeContext.links[i].y1 > (runtimeContext.box?.y2 ?? 0) ||
        runtimeContext.links[i].y2 < (runtimeContext.box?.y1 ?? 0)
      )
    ) {
      if (open) {
        openTabs.push(runtimeContext.links[i]);
      }

      // check if important links have been selected and possibly redo
      if (!runtimeContext.smartSelect) {
        if (runtimeContext.links[i].important) {
          runtimeContext.smartSelect = true;
          return false;
        }
      } else {
        if (runtimeContext.links[i].important) {
          count++;
        }
      }

      if (runtimeContext.links[i].box === null) {
        const linkBox = document.createElement('span');
        linkBox.id = 'linkclump-link';
        linkBox.style.margin = '0px auto';
        linkBox.style.border = '1px solid red';
        linkBox.style.position = 'absolute';
        linkBox.style.width = runtimeContext.links[i].width + 'px';
        linkBox.style.height = runtimeContext.links[i].height + 'px';
        linkBox.style.top = runtimeContext.links[i].y1 + 'px';
        linkBox.style.left = runtimeContext.links[i].x1 + 'px';
        linkBox.style.zIndex = Z_INDEX.toString();

        document.body.appendChild(linkBox);
        runtimeContext.links[i].box = linkBox;
      } else {
        (runtimeContext.links[i].box as HTMLElement).style.visibility =
          'visible';
      }

      countTabs.add(runtimeContext.links[i].href);
    } else {
      if (runtimeContext.links[i].box !== null) {
        (runtimeContext.links[i].box as HTMLElement).style.visibility =
          'hidden';
      }
    }
  }

  // important links were found, but not anymore so redo
  if (runtimeContext.smartSelect && count === 0) {
    runtimeContext.smartSelect = false;
    return false;
  }

  if (runtimeContext.countLabel) {
    runtimeContext.countLabel.innerText = countTabs.size.toString();
  }

  if (openTabs.length > 0) {
    openTabs = openTabs.map((tab) => ({
      ...tab,
      url: tab.href,
      title: tab.title,
    }));

    if (openTabs.length === 0) {
      return;
    }

    // if (message.action?.options.block) {
    //   urls = uniqueLinkURLs(urls);
    // }

    if (
      runtimeContext.settings?.actions[runtimeContext.currentAction]?.options
        .reverse
    ) {
      openTabs.reverse();
    }

    if (
      runtimeContext.settings?.actions[runtimeContext.currentAction]?.type ===
      'copy'
    ) {
      const text = formatLinks(
        openTabs,
        runtimeContext.settings?.actions[runtimeContext.currentAction]?.options
          .copyFormat ?? CopyFormat.URLS_WITH_TITLES
      );
      window.focus();
      navigator.clipboard
        .writeText(text)
        .then(() => {
          console.log('Text copied!');
        })
        .catch((err) => {
          console.error('Failed to copy text:', err);
        });
    }

    chrome.runtime.sendMessage<Message>({
      type: 'activate',
      urls: openTabs,
      settings: {
        actions: {
          [runtimeContext.currentAction]:
            runtimeContext.settings?.actions[runtimeContext.currentAction]!,
        },
        blocked: [],
      },
    });
  }

  return true;
}

function mousemove(event: MouseEvent) {
  preventEscalation(event);

  if (allowSelection() || runtimeContext.scrollBugIgnore) {
    runtimeContext.scrollBugIgnore = false;
    updateBox(event.pageX, event.pageY);

    // while detect keeps on calling false then recall the method
    while (!detect(event.pageX, event.pageY, false)) {
      // empty
    }
  } else if (runtimeContext.timer === 0) {
    stop();
  }
}

function mouseup(event: MouseEvent) {
  preventEscalation(event);

  if (runtimeContext.boxOn) {
    // all the detection of the mouse to bounce
    if (allowSelection() && runtimeContext.timer === 0) {
      runtimeContext.timer = setTimeout(function () {
        updateBox(event.pageX, event.pageY);
        detect(event.pageX, event.pageY, true);

        stop();
        runtimeContext.timer = 0;
      }, 100);
    }
  } else {
    // false alarm
    stop();
  }
}

function mousewheel() {
  runtimeContext.scrollBugIgnore = true;
}

function mouseout(event: MouseEvent) {
  mousemove(event);
  // the mouse wheel event might also call this event
  runtimeContext.scrollBugIgnore = true;
}

function mousedown(event: MouseEvent) {
  runtimeContext.mouseButton = event.button;
  // turn on menu for windows
  if (OS_WIN) {
    runtimeContext.stopMenu = false;
  }
  if (allowSelection()) {
    // don't prevent for windows right click as it breaks spell checker
    // do prevent for left as otherwise the page becomes highlighted
    if (
      runtimeContext.os === OS_LINUX ||
      (runtimeContext.os === OS_WIN &&
        runtimeContext.mouseButton === LEFT_BUTTON)
    ) {
      preventEscalation(event);
    }
    // if mouse up timer is set then clear it as it was just caused by bounce
    if (runtimeContext.timer !== 0) {
      //console.log("bounced!");
      clearTimeout(runtimeContext.timer);
      runtimeContext.timer = 0;
      // keep menu off for windows
      if (runtimeContext.os === OS_WIN) {
        runtimeContext.stopMenu = true;
      }
    } else {
      // clean up any mistakes
      if (runtimeContext.boxOn) {
        console.log("box wasn't removed from previous operation");
        cleanUp();
      }
      // create the box
      if (runtimeContext.box === null) {
        runtimeContext.box = document.createElement('span');
        runtimeContext.box.style.margin = '0px auto';
        runtimeContext.box.style.border =
          '2px dotted' +
          runtimeContext.settings?.actions[runtimeContext.currentAction].color;
        runtimeContext.box.style.position = 'absolute';
        runtimeContext.box.style.zIndex = `${Z_INDEX}`;
        runtimeContext.box.style.visibility = 'hidden';
        runtimeContext.countLabel = document.createElement('span');
        runtimeContext.countLabel.style.zIndex = `${Z_INDEX}`;
        runtimeContext.countLabel.style.position = 'absolute';
        runtimeContext.countLabel.style.visibility = 'hidden';
        runtimeContext.countLabel.style.left = '10px';
        runtimeContext.countLabel.style.width = '50px';
        runtimeContext.countLabel.style.top = '10px';
        runtimeContext.countLabel.style.height = '20px';
        runtimeContext.countLabel.style.fontSize = '10px';
        runtimeContext.countLabel.style.font = 'Arial, sans-serif';
        runtimeContext.countLabel.style.color = 'black';
        document.body.appendChild(runtimeContext.box);
        document.body.appendChild(runtimeContext.countLabel);
      }
      // update position
      runtimeContext.box.x = event.pageX;
      runtimeContext.box.y = event.pageY;
      updateBox(event.pageX, event.pageY);
      // setup mouse move and mouse up
      window.addEventListener('mousemove', mousemove, true);
      window.addEventListener('mouseup', mouseup, true);
      window.addEventListener('mousewheel', mousewheel, true);
      window.addEventListener('mouseout', mouseout, true);
    }
  }
}

chrome.runtime.sendMessage({ type: 'init' }, function (response: Settings) {
  console.log(response);
  if (response === null) {
    console.log('Unable to load linkclump due to null response');
    return;
  }

  if (response.error) {
    console.log(
      'Unable to properly load linkclump, returning to default settings: ' +
        response
    );
  }

  runtimeContext.settings = response;
  runtimeContext.allowed = true;

  for (let i in response.blocked) {
    if (response.blocked[i] == '') continue;
    const re = new RegExp(response.blocked[i], 'i');

    if (re.test(window.location.href)) {
      runtimeContext.allowed = false;
      console.log(
        'Linkclump is blocked on this site: ' +
          response.blocked[i] +
          '~' +
          window.location.href
      );
    }
  }

  if (runtimeContext.allowed) {
    window.addEventListener('mousedown', mousedown, true);
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('keyup', keyup, true);
    window.addEventListener('blur', blur, true);
    window.addEventListener('contextmenu', contextmenu, true);
  }
  console.log('Linkclump loaded');
});

function stop() {
  // allow user to select text/elements
  document.body.style.userSelect = '';

  // turn off mouse move and mouse up
  window.removeEventListener('mousemove', mousemove, true);
  window.removeEventListener('mouseup', mouseup, true);
  window.removeEventListener('mousewheel', mousewheel, true);
  window.removeEventListener('mouseout', mouseout, true);

  if (runtimeContext.boxOn) {
    cleanUp();
  }

  // turn on menu for linux
  if (
    OS_LINUX &&
    runtimeContext.settings?.actions[runtimeContext.currentAction].key !=
      runtimeContext.keyPressed
  ) {
    runtimeContext.stopMenu = false;
  }
}
