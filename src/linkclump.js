const END_KEYCODE = 35;
const HOME_KEYCODE = 36;
const Z_INDEX = 2147483647;
const OS_WIN = 1;
const OS_LINUX = 0;
const LEFT_BUTTON = 0;
const EXCLUDE_LINKS = 0;
const INCLUDE_LINKS = 1;

var settings = null;
var setting = -1;
var key_pressed = 0;
var mouse_button = null;
var stop_menu = false;
var box_on = false;
var smart_select = false;
var mouse_x = -1;
var mouse_y = -1;
var scroll_id = 0;
var links = [];
var box = null;
var count_label = null;
var overlay = null;
var scroll_bug_ignore = false;
var os = ((navigator.appVersion.indexOf("Win") === -1) ? OS_LINUX : OS_WIN);
var timer = 0;

chrome.extension.sendMessage({
	message: "init"
}, function(response) {
	if (response === null) {
		console.log("Unable to load linkclump due to null response");
	} else {
		if (response.hasOwnProperty("error")) {
			console.log("Unable to properly load linkclump, returning to default settings: " + JSON.stringify(response));
  }

  settings = response.actions

  const allowed = response.blocked.every((rule) => {
    if (!rule) return true
    const re = new RegExp(rule, 'i')
    if (re.test(window.location.href)) {
      console.log(`Linkclump is blocked on this site: ${rule}`)
      return false
    }
    return true
  })

  if (allowed) {
    window.addEventListener('mousedown', mousedown, true)
    window.addEventListener('keydown', keydown, true)
    window.addEventListener('keyup', keyup, true)
    window.addEventListener('blur', blur, true)
    window.addEventListener('contextmenu', contextmenu, true)
  }
})

// Listener for settings update
chrome.runtime.onMessage.addListener((request) => {
  if (request.message === 'update') {
    settings = request.settings.actions
  }
})

function mousedown(event) {
  mouseButton = event.button
  if (os === OS_WIN) stopMenu = false

  if (allowSelection()) {
    if (os === OS_LINUX || (os === OS_WIN && mouseButton === LEFT_BUTTON)) {
      preventEscalation(event)
    }

    if (timer) {
      clearTimeout(timer)
      timer = 0
      if (os === OS_WIN) stopMenu = true
    } else {
      if (boxOn) cleanUp()

      if (!box) {
        box = document.createElement('span')
        box.style.margin = '0px auto'
        box.style.border = `2px dotted ${settings[setting].color}`
        box.style.position = 'absolute'
        box.style.zIndex = Z_INDEX
        box.style.visibility = 'hidden'

        countLabel = document.createElement('span')
        countLabel.style.zIndex = Z_INDEX
        countLabel.style.position = 'absolute'
        countLabel.style.visibility = 'hidden'
        countLabel.style.left = '10px'
        countLabel.style.width = '50px'
        countLabel.style.top = '10px'
        countLabel.style.height = '20px'
        countLabel.style.fontSize = '10px'
        countLabel.style.font = 'Arial, sans-serif'
        countLabel.style.color = 'black'

        document.body.appendChild(box)
        document.body.appendChild(countLabel)
      }

      box.x = event.pageX
      box.y = event.pageY
      updateBox(event.pageX, event.pageY)

      window.addEventListener('mousemove', mousemove, true)
      window.addEventListener('mouseup', mouseup, true)
      window.addEventListener('mousewheel', mousewheel, true)
      window.addEventListener('mouseout', mouseout, true)
    }
  }
}

function preventEscalation(event) {
  event.stopPropagation()
  event.preventDefault()
}

function updateBox(x, y) {
  const width = Math.max(
    document.documentElement.clientWidth,
    document.body.scrollWidth,
    document.documentElement.scrollWidth,
    document.body.offsetWidth,
    document.documentElement.offsetWidth
  )
  const height = Math.max(
    document.documentElement.clientHeight,
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight
  )
  x = Math.min(x, width - 7)
  y = Math.min(y, height - 7)

  box.x1 = Math.min(box.x, x)
  box.x2 = Math.max(box.x, x)
  box.y1 = Math.min(box.y, y)
  box.y2 = Math.max(box.y, y)

  box.style.left = `${box.x1}px`
  box.style.width = `${box.x2 - box.x1}px`
  box.style.top = `${box.y1}px`
  box.style.height = `${box.y2 - box.y1}px`

  countLabel.style.left = `${x - 15}px`
  countLabel.style.top = `${y - 15}px`
}

// Further optimizations can continue from here, focusing on cleanup and context adjustment.
