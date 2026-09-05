/**
 * Shared plumbing for the admin page: session handling, status messages, tab
 * switching and fetch helpers.
 *
 * Plain ES5-flavoured script with globals, loaded via <script src> in order —
 * no build step, no framework, no modules. Keep it that way: this page is
 * served straight out of /public and nothing compiles it.
 */

var SCHEDULES_URL = '/api/schedules';
var SETTINGS_URL = '/api/settings';
var CONTENT_URL = '/api/tour-content';
var SESSION_KEY = 'kanmonAdminPassword';

var els = {
  main: document.getElementById('main'),
  loginCard: document.getElementById('login-card'),
  loginForm: document.getElementById('login-form'),
  loginStatus: document.getElementById('login-status'),
  loadStatus: document.getElementById('load-status'),
  workspace: document.getElementById('workspace'),
};

/* --- session ------------------------------------------------------------ */

// sessionStorage: remembered for this browser tab only, cleared when the tab
// closes — a reasonable "logged in" lifetime without needing a real
// server-side session, which this single-shared-password model doesn't have.
function getSessionPassword() {
  try { return sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; }
}
function setSessionPassword(pw) {
  try { sessionStorage.setItem(SESSION_KEY, pw); } catch (e) {}
}
function clearSessionPassword() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
}

// A request with a password and no data verifies the password without saving
// anything — see netlify/functions/schedules.ts.
function verifyPassword(password) {
  return fetch(SCHEDULES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: password }),
  }).then(function (response) {
    return response.json().then(function (body) {
      if (!response.ok) throw new Error(body.error || 'Incorrect password.');
    });
  });
}

/* --- status messages ---------------------------------------------------- */

function setStatus(el, message, kind) {
  el.textContent = message;
  el.className = 'status visible' + (kind ? ' status--' + kind : '');
  el.hidden = false;
}

function clearStatus(el) {
  el.textContent = '';
  el.className = 'status';
}

/* --- fetch helpers ------------------------------------------------------ */

/** Unwraps the JSON body before checking ok, so the server's error text shows. */
function readJson(response) {
  return response.json().then(function (body) {
    if (!response.ok) {
      var error = new Error(body.error || 'Request failed: ' + response.status);
      error.status = response.status;
      throw error;
    }
    return body;
  });
}

function getJson(url, password) {
  var options = password ? { headers: { 'X-Admin-Password': password } } : undefined;
  return fetch(url, options).then(readJson);
}

function postJson(url, payload) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(readJson);
}

/** A rotated password mid-session should bounce back to the login screen. */
function isAuthError(error) {
  return error && (error.status === 401 || String(error.message).indexOf('Incorrect password') !== -1);
}

/* --- tabs --------------------------------------------------------------- */

function activateTabs(tabsEl, onChange) {
  tabsEl.addEventListener('click', function (event) {
    var tab = event.target.closest('.tab');
    if (!tab || !tabsEl.contains(tab)) return;
    selectTab(tabsEl, tab.dataset.panel);
    if (onChange) onChange(tab.dataset.panel);
  });
}

function selectTab(tabsEl, panelId) {
  var tabs = tabsEl.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('is-active', tabs[i].dataset.panel === panelId);
  }
  var bodies = document.querySelectorAll('[data-panel-body]');
  for (var j = 0; j < bodies.length; j++) {
    bodies[j].hidden = bodies[j].dataset.panelBody !== panelId;
  }
}

/* --- small DOM helpers -------------------------------------------------- */

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function button(className, text, onClick) {
  var node = el('button', className, text);
  node.type = 'button';
  if (onClick) node.addEventListener('click', onClick);
  return node;
}
