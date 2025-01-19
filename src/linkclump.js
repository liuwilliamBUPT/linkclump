

// const END_KEYCODE = 35;
// const HOME_KEYCODE = 36;
const Z_INDEX = 2147483647;
const OS_WIN = 1;
const OS_LINUX = 0;
const LEFT_BUTTON = 0;
// const EXCLUDE_LINKS = 0;
// const INCLUDE_LINKS = 1;

let settings = null;
let setting = -1;
// let keyPressed = 0;
let mouseButton = null;
let stopMenu = false;
let boxOn = false;
// let smartSelect = false;
// let mouseX = -1;
// let mouseY = -1;
// let scrollId = 0;
let links = [];
let box = null;
let countLabel = null;
// let overlay = null;
// let scrollBugIgnore = false;
const os = /Win/.test(navigator.userAgent) ? OS_WIN : OS_LINUX;
let timer = 0;

chrome.runtime.sendMessage(
  {
    message: 'init',
  },
  function (response) {
    if (response === null) {
      console.log('Unable to load linkclump due to null response');
      return;
    }

    // eslint-disable-next-line no-prototype-builtins
    if (response instanceof Object && response.hasOwnProperty('error')) {
      console.log(
        'Unable to properly load linkclump, returning to default settings: ' +
          JSON.stringify(response)
      );
    }

    settings = response.actions;

    const allowed = response.blocked.every((rule) => {
      if (!rule) {
        return true;
      }
      const re = new RegExp(rule, 'i');
      if (re.test(window.location.href)) {
        console.log(`Linkclump is blocked on this site: ${rule}`);
        return false;
      }
      return true;
    });

    if (allowed) {
      setupEventListeners();
    }
  }
);

function setupEventListeners() {
  window.addEventListener('mousedown', mousedown, true);
  window.addEventListener('keydown', window.onkeydown, true);
  window.addEventListener('keyup', window.onkeyup, true);
  window.addEventListener('blur', window.onblur, true);
  window.addEventListener('contextmenu', window.oncontextmenu, true);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'update') {
    settings = request.settings.actions;
  }
});

function mousedown(event) {
  mouseButton = event.button;
  if (os === OS_WIN) {
    stopMenu = false;
  }

  if (allowSelection()) {
    if (os === OS_LINUX || (os === OS_WIN && mouseButton === LEFT_BUTTON)) {
      preventEscalation(event);
    }

    handleMouseDownLogic(event);
  }
}

function handleMouseDownLogic(event) {
  if (timer) {
    clearTimeout(timer);
    timer = 0;
    if (os === OS_WIN) {
      stopMenu = true;
    }
  } else {
    if (boxOn) {
      cleanUp();
    }

    initializeBox();
    updateBoxPosition(event);

    setupMouseEventListeners();
  }
}

function initializeBox() {
  if (!box) {
    box = createBox();
    countLabel = createCountLabel();
    document.body.appendChild(box);
    document.body.appendChild(countLabel);
  }
}

function preventEscalation(event) {
  event.stopPropagation();
  event.preventDefault();
}

function updateBox(x, y) {
  const width = Math.max(
    document.documentElement.clientWidth,
    document.body.scrollWidth,
    document.documentElement.scrollWidth,
    document.body.offsetWidth,
    document.documentElement.offsetWidth
  );
  const height = Math.max(
    document.documentElement.clientHeight,
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight
  );
  x = Math.min(x, width - 7);
  y = Math.min(y, height - 7);

  box.x1 = Math.min(box.x, x);
  box.x2 = Math.max(box.x, x);
  box.y1 = Math.min(box.y, y);
  box.y2 = Math.max(box.y, y);

  box.style.left = `${box.x1}px`;
  box.style.width = `${box.x2 - box.x1}px`;
  box.style.top = `${box.y1}px`;
  box.style.height = `${box.y2 - box.y1}px`;

  countLabel.style.left = `${x - 15}px`;
  countLabel.style.top = `${y - 15}px`;
}

function createBox() {
  const box = document.createElement('span');
  box.style.margin = '0px auto';
  box.style.border = `2px dotted ${settings[setting].color}`;
  box.style.position = 'absolute';
  box.style.zIndex = Z_INDEX;
  box.style.visibility = 'hidden';
  return box;
}

function createCountLabel() {
  const label = document.createElement('span');
  label.style.zIndex = Z_INDEX;
  label.style.position = 'absolute';
  label.style.visibility = 'hidden';
  label.style.left = '10px';
  label.style.width = '50px';
  label.style.top = '10px';
  label.style.height = '20px';
  label.style.fontSize = '10px';
  label.style.font = 'Arial, sans-serif';
  label.style.color = 'black';
  return label;
}

function updateBoxPosition(event) {
  box.x = event.pageX;
  box.y = event.pageY;
  updateBox(event.pageX, event.pageY);
}

function setupMouseEventListeners() {
  window.addEventListener('mousemove', window.onmousemove, true);
  window.addEventListener('mouseup', window.onmouseup, true);
  window.addEventListener('mousewheel', window.onmousewheel, true);
  window.addEventListener('mouseout', window.onmouseout, true);
}

function allowSelection() {
  return settings && setting !== -1;
}

function cleanUp() {
  if (box) {
    box.style.visibility = 'hidden';
    countLabel.style.visibility = 'hidden';
  }
  boxOn = false;
  links = [];
}

// Further optimizations can continue from here, focusing on cleanup and context adjustment.
