/**
 * Login flow and initial load. Runs last, once the other modules have defined
 * their handlers.
 */

function showLogin(message) {
  clearSessionPassword();
  els.loginCard.hidden = false;
  els.loadStatus.hidden = true;
  els.workspace.hidden = true;
  document.getElementById('login-password').value = '';
  if (message) setStatus(els.loginStatus, message, 'error');
  else clearStatus(els.loginStatus);
}

activateTabs(document.getElementById('main-tabs'));

function loadEverything() {
  els.loginCard.hidden = true;
  setStatus(els.loadStatus, 'Loading…', 'loading');

  var password = getSessionPassword();

  return Promise.all([
    getJson(SCHEDULES_URL),
    getJson(SETTINGS_URL, password),
    getJson(CONTENT_URL, password),
  ])
    .then(function (results) {
      var schedules = results[0];
      var settings = results[1];
      var content = results[2];

      // The content document is the source of truth for which tours exist, so
      // the schedule cards are built from it rather than a hardcoded list.
      renderContent(content);
      renderScheduleTours(toScheduleTours(content));
      populateSchedule(schedules);
      scheduleEls.notificationEmail.value = settings.notificationEmail || '';

      els.loadStatus.hidden = true;
      els.workspace.hidden = false;
    })
    .catch(function (error) {
      if (isAuthError(error)) {
        showLogin('Your session has expired. Please log in again.');
      } else {
        setStatus(els.loadStatus, 'Could not load. Please reload this page to try again.', 'error');
      }
    });
}

// Both tabs now show two language columns, and .field__cols only goes two-up
// at 900px — inside the default 720px wrapper it could never fire.
els.main.classList.add('is-wide');

els.loginForm.addEventListener('submit', function (event) {
  event.preventDefault();
  var password = document.getElementById('login-password').value;
  var loginBtn = document.getElementById('login-btn');
  loginBtn.disabled = true;
  setStatus(els.loginStatus, 'Checking…', 'loading');

  verifyPassword(password)
    .then(function () {
      setSessionPassword(password);
      return loadEverything();
    })
    .catch(function (error) {
      setStatus(els.loginStatus, error.message || 'Incorrect password.', 'error');
    })
    .finally(function () {
      loginBtn.disabled = false;
    });
});

document.getElementById('logout-btn').addEventListener('click', function () { showLogin(); });
document.getElementById('content-logout-btn').addEventListener('click', function () { showLogin(); });

// Returning with a remembered password from earlier in this tab session:
// re-check it quietly (it may have been changed on the server since) and
// either go straight to the workspace or fall back to the login screen.
var remembered = getSessionPassword();
if (remembered) {
  verifyPassword(remembered)
    .then(loadEverything)
    .catch(function () { showLogin('Your session has expired. Please log in again.'); });
} else {
  showLogin();
}
