/**
 * The schedule and notification-email tab.
 *
 * Unchanged in behaviour from the original single-file admin, except that the
 * tour list is no longer hardcoded here — it comes from the tour-content
 * document, so a tour added on the content tab automatically gets a schedule
 * card. State still lives in the DOM and is read back on save, which is fine
 * for a handful of checkboxes and dates.
 */

var WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

var scheduleEls = {
  form: document.getElementById('schedule-form'),
  toursContainer: document.getElementById('tours-container'),
  saveStatus: document.getElementById('save-status'),
  saveBtn: document.getElementById('save-btn'),
  minLeadDays: document.getElementById('min-lead-days'),
  notificationEmail: document.getElementById('notification-email'),
};

/** [{ slug, label }] — rebuilt whenever the content document changes. */
var scheduleTours = [];

function buildDateRow(container, iso) {
  var row = el('div', 'date-row');

  var input = document.createElement('input');
  input.type = 'date';
  input.value = iso || '';
  row.appendChild(input);

  row.appendChild(button(null, 'Remove', function () { row.remove(); }));
  container.appendChild(row);
}

function buildDateList(labelText, hint) {
  var wrap = el('div');

  var legend = el('div', null, labelText);
  legend.style.fontWeight = '600';
  legend.style.fontSize = '0.9rem';
  legend.style.marginBottom = '0.35rem';
  wrap.appendChild(legend);

  if (hint) {
    var hintEl = el('div', null, hint);
    hintEl.style.fontSize = '0.8rem';
    hintEl.style.color = 'var(--color-text-muted)';
    hintEl.style.marginBottom = '0.4rem';
    wrap.appendChild(hintEl);
  }

  var list = el('div', 'date-list');
  wrap.appendChild(list);

  var addBtn = button('add-date-btn', '+ Add date', function () { buildDateRow(list, ''); });
  wrap.appendChild(addBtn);

  return { wrap: wrap, list: list };
}

function buildTourSection(tour) {
  var card = el('div', 'card');
  card.dataset.slug = tour.slug;
  card.appendChild(el('h2', null, tour.label));

  // Filled in by populateSchedule when a tour has no operating days at all.
  var warning = el('p', 'warn', 'This tour has no operating days set, so nobody can book it.');
  warning.dataset.role = 'noDaysWarning';
  warning.hidden = true;
  card.appendChild(warning);

  var weekdaysField = document.createElement('fieldset');
  weekdaysField.appendChild(el('legend', null, 'Runs on these days'));

  var weekdaysWrap = el('div', 'weekdays');
  WEEKDAYS.forEach(function (day) {
    var label = el('label');
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = String(day.value);
    checkbox.dataset.weekday = String(day.value);
    checkbox.addEventListener('change', function () { refreshNoDaysWarning(card); });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(day.label));
    weekdaysWrap.appendChild(label);
  });
  weekdaysField.appendChild(weekdaysWrap);
  card.appendChild(weekdaysField);

  var blackout = buildDateList('Cancelled dates', 'This tour will NOT run on these dates, even on a matching weekday.');
  blackout.list.dataset.role = 'blackoutDates';
  card.appendChild(blackout.wrap);

  var extra = buildDateList('Extra dates', 'This tour WILL run on these dates, outside its usual weekdays.');
  extra.list.dataset.role = 'extraDates';
  card.appendChild(extra.wrap);

  return card;
}

function refreshNoDaysWarning(card) {
  var anyDay = card.querySelectorAll('[data-weekday]:checked').length > 0;
  var anyExtra = card.querySelectorAll('[data-role="extraDates"] input[type="date"]').length > 0;
  card.querySelector('[data-role="noDaysWarning"]').hidden = anyDay || anyExtra;
}

/** Rebuilds the per-tour cards for the given tour list. */
function renderScheduleTours(tours) {
  scheduleTours = tours;
  scheduleEls.toursContainer.innerHTML = '';
  tours.forEach(function (tour) {
    scheduleEls.toursContainer.appendChild(buildTourSection(tour));
  });
}

function populateSchedule(data) {
  scheduleEls.minLeadDays.value = data.minLeadDays;

  scheduleTours.forEach(function (tour) {
    var card = scheduleEls.toursContainer.querySelector('[data-slug="' + tour.slug + '"]');
    if (!card) return;
    var schedule = (data.tours && data.tours[tour.slug]) || { weekdays: [], blackoutDates: [], extraDates: [] };

    card.querySelectorAll('[data-weekday]').forEach(function (checkbox) {
      checkbox.checked = schedule.weekdays.indexOf(Number(checkbox.dataset.weekday)) !== -1;
    });

    ['blackoutDates', 'extraDates'].forEach(function (role) {
      var list = card.querySelector('[data-role="' + role + '"]');
      list.innerHTML = '';
      (schedule[role] || []).forEach(function (iso) { buildDateRow(list, iso); });
    });

    refreshNoDaysWarning(card);
  });
}

function collectScheduleData() {
  var data = { minLeadDays: Number(scheduleEls.minLeadDays.value), tours: {} };

  scheduleTours.forEach(function (tour) {
    var card = scheduleEls.toursContainer.querySelector('[data-slug="' + tour.slug + '"]');
    if (!card) return;

    var weekdays = Array.prototype.slice
      .call(card.querySelectorAll('[data-weekday]:checked'))
      .map(function (checkbox) { return Number(checkbox.dataset.weekday); });

    var readDates = function (role) {
      return Array.prototype.slice
        .call(card.querySelectorAll('[data-role="' + role + '"] input[type="date"]'))
        .map(function (input) { return input.value; })
        .filter(function (value) { return value; });
    };

    data.tours[tour.slug] = {
      weekdays: weekdays,
      blackoutDates: readDates('blackoutDates'),
      extraDates: readDates('extraDates'),
    };
  });

  return data;
}

scheduleEls.form.addEventListener('submit', function (event) {
  event.preventDefault();
  var password = getSessionPassword();
  if (!password) return showLogin('Please log in again.');

  scheduleEls.saveBtn.disabled = true;
  setStatus(scheduleEls.saveStatus, 'Saving…', 'loading');

  var scheduleSave = postJson(SCHEDULES_URL, { password: password, data: collectScheduleData() });
  var settingsSave = postJson(SETTINGS_URL, {
    password: password,
    notificationEmail: scheduleEls.notificationEmail.value,
  });

  Promise.all([scheduleSave, settingsSave])
    .then(function (results) {
      populateSchedule(results[0].data);
      scheduleEls.notificationEmail.value = results[1].data.notificationEmail;

      if (results[1].warning) {
        setStatus(scheduleEls.saveStatus, 'Schedule saved. ' + results[1].warning, 'error');
      } else {
        setStatus(scheduleEls.saveStatus, 'Saved. Changes are live.', 'success');
      }
    })
    .catch(function (error) {
      if (isAuthError(error)) {
        showLogin('Your session has expired. Please log in again.');
      } else {
        setStatus(scheduleEls.saveStatus, error.message || 'Something went wrong. Please try again.', 'error');
      }
    })
    .finally(function () {
      scheduleEls.saveBtn.disabled = false;
    });
});
