/**
 * The schedule and notification-email tab.
 *
 * Each tour has one shared schedule by default. Ticking "different days for
 * English and Japanese" reveals a second set of controls so the two languages
 * can diverge; most tours never need it, and leaving it off means there is only
 * one set of days to keep right.
 *
 * State still lives in the DOM and is read back on save. With two language
 * blocks now sharing a card, every read MUST be scoped to a
 * [data-locale] block — a card-wide querySelectorAll would silently merge both
 * languages' days into one.
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

var SCHEDULE_LOCALES = [
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' },
];

var scheduleEls = {
  form: document.getElementById('schedule-form'),
  toursContainer: document.getElementById('tours-container'),
  saveStatus: document.getElementById('save-status'),
  saveBtn: document.getElementById('save-btn'),
  minLeadDays: document.getElementById('min-lead-days'),
  leadSplit: document.getElementById('lead-split'),
  leadCols: document.getElementById('lead-cols'),
  leadShared: document.getElementById('lead-shared'),
  leadEn: document.getElementById('min-lead-days-en'),
  leadJa: document.getElementById('min-lead-days-ja'),
  notificationEmail: document.getElementById('notification-email'),
};

/** [{ slug, label }] — rebuilt whenever the content document changes. */
var scheduleTours = [];

/**
 * The last schedules document loaded from the server. Kept so the form can be
 * re-populated after the tour cards are rebuilt (a content save rebuilds them),
 * which would otherwise blank every setting until the page was reloaded.
 */
var lastSchedules = null;

var EMPTY_BLOCK = { weekdays: [], blackoutDates: [], extraDates: [] };

/* --- building one set of controls ---------------------------------------- */

function buildDateRow(container, iso) {
  var row = el('div', 'date-row');

  var input = document.createElement('input');
  input.type = 'date';
  input.value = iso || '';
  row.appendChild(input);

  row.appendChild(button(null, 'Remove', function () {
    var block = row.closest('[data-locale]');
    row.remove();
    if (block) refreshNoDaysWarning(block);
  }));
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
    var hintEl = el('div', 'field__hint', hint);
    wrap.appendChild(hintEl);
  }

  var list = el('div', 'date-list');
  wrap.appendChild(list);

  wrap.appendChild(button('add-date-btn', '+ Add date', function () {
    buildDateRow(list, '');
    var block = wrap.closest('[data-locale]');
    if (block) refreshNoDaysWarning(block);
  }));

  return { wrap: wrap, list: list };
}

/**
 * One complete set of availability controls — weekdays plus the two date lists.
 * Built once per locale block so the shared, English and Japanese schedules are
 * all edited through identical UI.
 */
function buildScheduleBlock(localeKey, warningText) {
  var block = el('div');
  block.dataset.locale = localeKey;

  var warning = el('p', 'warn', warningText);
  warning.dataset.role = 'noDaysWarning';
  warning.hidden = true;
  block.appendChild(warning);

  var weekdaysField = document.createElement('fieldset');
  weekdaysField.appendChild(el('legend', null, 'Runs on these days'));

  var weekdaysWrap = el('div', 'weekdays');
  WEEKDAYS.forEach(function (day) {
    var label = el('label');
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = String(day.value);
    checkbox.dataset.weekday = String(day.value);
    checkbox.addEventListener('change', function () { refreshNoDaysWarning(block); });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(day.label));
    weekdaysWrap.appendChild(label);
  });
  weekdaysField.appendChild(weekdaysWrap);
  block.appendChild(weekdaysField);

  var blackout = buildDateList('Cancelled dates', 'This tour will NOT run on these dates, even on a matching weekday.');
  blackout.list.dataset.role = 'blackoutDates';
  block.appendChild(blackout.wrap);

  var extra = buildDateList('Extra dates', 'This tour WILL run on these dates, outside its usual weekdays.');
  extra.list.dataset.role = 'extraDates';
  block.appendChild(extra.wrap);

  return block;
}

function buildTourSection(tour) {
  var card = el('div', 'card');
  card.dataset.slug = tour.slug;
  card.appendChild(el('h2', null, tour.label));

  // The override toggle. Unticked, only the shared block is shown.
  var splitLabel = el('label', 'split-toggle');
  var splitBox = document.createElement('input');
  splitBox.type = 'checkbox';
  splitBox.dataset.role = 'split';
  splitLabel.appendChild(splitBox);
  splitLabel.appendChild(document.createTextNode(' Different days for English and Japanese'));
  card.appendChild(splitLabel);

  var shared = buildScheduleBlock('shared', 'This tour has no operating days set, so nobody can book it.');
  card.appendChild(shared);

  var cols = el('div', 'field__cols');
  cols.dataset.role = 'localeCols';
  cols.hidden = true;
  SCHEDULE_LOCALES.forEach(function (locale) {
    var col = el('div');
    col.appendChild(el('div', 'field__col-label', locale.label));
    col.appendChild(
      buildScheduleBlock(locale.key, 'No operating days set, so this tour cannot be booked in ' + locale.label + '.')
    );
    cols.appendChild(col);
  });
  card.appendChild(cols);

  splitBox.addEventListener('change', function () {
    applySplit(card, splitBox.checked, true);
  });

  return card;
}

/**
 * Shows the right block for the current toggle state.
 *
 * When `seed` is set this is a real click rather than a load: turning the
 * override on copies the shared days into both languages so nothing is lost,
 * and turning it off copies English back to shared so the client keeps what
 * they were just looking at instead of silently reverting to older values.
 */
function applySplit(card, split, seed) {
  var shared = blockOf(card, 'shared');
  var cols = card.querySelector('[data-role="localeCols"]');

  if (seed) {
    if (split) {
      var current = readBlock(shared);
      SCHEDULE_LOCALES.forEach(function (locale) { writeBlock(blockOf(card, locale.key), current); });
    } else {
      writeBlock(shared, readBlock(blockOf(card, 'en')));
    }
  }

  shared.hidden = split;
  cols.hidden = !split;
  refreshAllWarnings(card);
}

/* --- reading and writing one block --------------------------------------- */

function blockOf(card, localeKey) {
  return card.querySelector('[data-locale="' + localeKey + '"]');
}

function readBlock(block) {
  var readDates = function (role) {
    return Array.prototype.slice
      .call(block.querySelectorAll('[data-role="' + role + '"] input[type="date"]'))
      .map(function (input) { return input.value; })
      .filter(function (value) { return value; });
  };

  return {
    weekdays: Array.prototype.slice
      .call(block.querySelectorAll('[data-weekday]:checked'))
      .map(function (checkbox) { return Number(checkbox.dataset.weekday); }),
    blackoutDates: readDates('blackoutDates'),
    extraDates: readDates('extraDates'),
  };
}

function writeBlock(block, schedule) {
  var data = schedule || EMPTY_BLOCK;

  block.querySelectorAll('[data-weekday]').forEach(function (checkbox) {
    checkbox.checked = (data.weekdays || []).indexOf(Number(checkbox.dataset.weekday)) !== -1;
  });

  ['blackoutDates', 'extraDates'].forEach(function (role) {
    var list = block.querySelector('[data-role="' + role + '"]');
    list.innerHTML = '';
    (data[role] || []).forEach(function (iso) { buildDateRow(list, iso); });
  });

  refreshNoDaysWarning(block);
}

function refreshNoDaysWarning(block) {
  var anyDay = block.querySelectorAll('[data-weekday]:checked').length > 0;
  var anyExtra = block.querySelectorAll('[data-role="extraDates"] input[type="date"]').length > 0;
  block.querySelector('[data-role="noDaysWarning"]').hidden = anyDay || anyExtra;
}

function refreshAllWarnings(card) {
  card.querySelectorAll('[data-locale]').forEach(refreshNoDaysWarning);
}

/* --- whole-form load and save -------------------------------------------- */

function renderScheduleTours(tours) {
  scheduleTours = tours;
  scheduleEls.toursContainer.innerHTML = '';
  tours.forEach(function (tour) {
    scheduleEls.toursContainer.appendChild(buildTourSection(tour));
  });
}

function populateSchedule(data) {
  lastSchedules = data;

  scheduleEls.minLeadDays.value = data.minLeadDays;
  var leadByLocale = data.leadDaysByLocale || null;
  scheduleEls.leadEn.value = (leadByLocale && leadByLocale.en != null) ? leadByLocale.en : data.minLeadDays;
  scheduleEls.leadJa.value = (leadByLocale && leadByLocale.ja != null) ? leadByLocale.ja : data.minLeadDays;
  scheduleEls.leadSplit.checked = !!leadByLocale;
  applyLeadSplit(false);

  scheduleTours.forEach(function (tour) {
    var card = scheduleEls.toursContainer.querySelector('[data-slug="' + tour.slug + '"]');
    if (!card) return;

    var schedule = (data.tours && data.tours[tour.slug]) || EMPTY_BLOCK;
    var byLocale = schedule.byLocale || null;

    writeBlock(blockOf(card, 'shared'), schedule);
    SCHEDULE_LOCALES.forEach(function (locale) {
      writeBlock(blockOf(card, locale.key), (byLocale && byLocale[locale.key]) || schedule);
    });

    card.querySelector('[data-role="split"]').checked = !!byLocale;
    applySplit(card, !!byLocale, false);
  });
}

/** Re-applies the last loaded schedules after the cards are rebuilt. */
function repopulateSchedule() {
  if (lastSchedules) populateSchedule(lastSchedules);
}

function applyLeadSplit(seed) {
  var split = scheduleEls.leadSplit.checked;
  if (seed) {
    if (split) {
      scheduleEls.leadEn.value = scheduleEls.minLeadDays.value;
      scheduleEls.leadJa.value = scheduleEls.minLeadDays.value;
    } else {
      scheduleEls.minLeadDays.value = scheduleEls.leadEn.value;
    }
  }
  scheduleEls.leadShared.hidden = split;
  scheduleEls.leadCols.hidden = !split;
}

function collectScheduleData() {
  var leadSplit = scheduleEls.leadSplit.checked;

  var data = {
    minLeadDays: Number(scheduleEls.minLeadDays.value),
    leadDaysByLocale: leadSplit
      ? { en: Number(scheduleEls.leadEn.value), ja: Number(scheduleEls.leadJa.value) }
      : null,
    tours: {},
  };

  scheduleTours.forEach(function (tour) {
    var card = scheduleEls.toursContainer.querySelector('[data-slug="' + tour.slug + '"]');
    if (!card) return;

    var split = card.querySelector('[data-role="split"]').checked;
    var entry = readBlock(blockOf(card, 'shared'));
    entry.byLocale = split
      ? { en: readBlock(blockOf(card, 'en')), ja: readBlock(blockOf(card, 'ja')) }
      : null;

    data.tours[tour.slug] = entry;
  });

  return data;
}

scheduleEls.leadSplit.addEventListener('change', function () { applyLeadSplit(true); });

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
