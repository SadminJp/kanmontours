/**
 * The Booking & Inquiry tab: the wording on the Booking Request and Inquiry
 * pages, in English and Japanese.
 *
 * Wording only. Which inputs each form has stays fixed, because every input
 * feeds the booking/inquiry emails by name — and the two languages' booking
 * forms already differ (the Japanese one asks for more). A label only exists in
 * the languages whose form has that field; the other column says so.
 *
 * Edits `contentDoc.forms`, the same document as the other content tabs, so it
 * shares their dirty flag, Save and Publish (see admin-content.js).
 */

var formsEls = {
  tabs: document.getElementById('forms-tabs'),
  editor: document.getElementById('forms-editor'),
  status: document.getElementById('forms-status'),
  saveBtn: document.getElementById('forms-save-btn'),
  publishBtn: document.getElementById('forms-publish-btn'),
};

var FORM_PAGES = [
  {
    id: 'booking',
    title: 'Booking Request',
    dataKey: 'booking',
    items: [
      { key: 'pageTitle', label: 'Page title', hint: 'Shown at the top of the page and in the browser tab.' },
      { key: 'step1', label: 'Step 1 heading', hint: 'Above the list of tours. The tours and their prices come from the Tour Content tab.' },
      { key: 'step2', label: 'Step 2 heading' },
      { key: 'calendarHint', label: 'Calendar hint', type: 'textarea', hint: 'Shown under the step 2 heading.' },
      { key: 'selectTourFirst', label: '"Choose a tour first" message', hint: 'Shown in the calendar until a tour is ticked.' },
      { key: 'loadingDates', label: 'Calendar loading message' },
      { key: 'datesUnavailable', label: 'Calendar error message', type: 'textarea', hint: 'Shown if the available dates cannot be loaded.' },
      { key: 'selectedDate', label: '"Selected date" label', hint: 'Shown with the date the customer picked.' },
      { key: 'step3', label: 'Step 3 heading' },
      { fields: true, label: 'Form field labels', hint: 'The labels next to each box the customer fills in.' },
      { key: 'step4', label: 'Step 4 heading' },
      { key: 'termsAgree', label: 'Terms agreement text', type: 'textarea', hint: 'Next to the tick box. A link to the Terms & Conditions page follows it.' },
      { key: 'submit', label: 'Send button' },
      { key: 'successMessage', label: 'Success message', type: 'textarea', hint: 'Shown after the request is sent.' },
      { key: 'errorMessage', label: 'Error message', type: 'textarea', hint: 'Shown if sending fails.' },
    ],
  },
  {
    id: 'inquiry',
    title: 'Inquiry',
    dataKey: 'inquiryForm',
    items: [
      { key: 'pageTitle', label: 'Page title', hint: 'Shown at the top of the page and in the browser tab.' },
      { key: 'intro', label: 'Introduction', type: 'textarea', hint: 'Shown above the form.' },
      { key: 'name', label: 'Name label' },
      { key: 'email', label: 'Email label' },
      { key: 'message', label: 'Message label' },
      { key: 'submit', label: 'Send button' },
      { key: 'successMessage', label: 'Success message', type: 'textarea', hint: 'Shown after the message is sent.' },
      { key: 'errorMessage', label: 'Error message', type: 'textarea', hint: 'Shown if sending fails.' },
    ],
  },
];

/** Booking form field labels, in the order the fields appear on the forms. */
var BOOKING_FIELD_LABELS = [
  { key: 'totalParticipants', label: 'Number of participants' },
  { key: 'adults', label: 'Adults' },
  { key: 'underAge', label: 'Under 18' },
  { key: 'name', label: 'Name' },
  { key: 'representativeName', label: 'Representative name (heading)' },
  { key: 'kanji', label: 'Name in kanji' },
  { key: 'katakana', label: 'Name in katakana' },
  { key: 'contact', label: 'Contact details (heading)' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
];

/** Column headings show 日本語; sentences read better with the English name. */
var LANGUAGE_NAMES = { en: 'English', ja: 'Japanese' };

var activeFormPage = FORM_PAGES[0].id;

function renderForms() {
  if (!contentDoc || !contentDoc.forms) return;
  formsEls.tabs.innerHTML = '';
  FORM_PAGES.forEach(function (page) {
    formsEls.tabs.appendChild(
      button('tab' + (page.id === activeFormPage ? ' is-active' : ''), page.title, function () {
        activeFormPage = page.id;
        renderForms();
      })
    );
  });

  formsEls.editor.innerHTML = '';
  var page = FORM_PAGES.filter(function (p) { return p.id === activeFormPage; })[0];
  var card = el('div', 'card');
  card.appendChild(el('h2', null, page.title));
  card.appendChild(
    el('p', 'field__hint', 'You can change the wording here. The boxes on the form themselves stay as they are, because each one feeds the email you receive.')
  );

  page.items.forEach(function (item) {
    if (item.fields) card.appendChild(renderFieldLabels(item));
    else card.appendChild(renderFormText(page.dataKey, item));
  });
  formsEls.editor.appendChild(card);
}

function renderFormText(dataKey, item) {
  var wrap = el('div', 'field');
  wrap.appendChild(el('div', 'field__label', item.label));
  if (item.hint) wrap.appendChild(el('div', 'field__hint', item.hint));
  var cols = el('div', 'field__cols');
  LOCALES.forEach(function (locale) {
    var col = el('div');
    col.appendChild(el('div', 'field__col-label', locale.label));
    var data = contentDoc.forms[locale.key][dataKey];
    col.appendChild(item.type === 'textarea' ? textareaEditor(data, item.key) : textEditor(data, item.key, false));
    cols.appendChild(col);
  });
  wrap.appendChild(cols);
  return wrap;
}

/**
 * One row per label. A language whose form has no such field gets a note
 * instead of an input — the server would drop anything typed there anyway.
 */
function renderFieldLabels(item) {
  var wrap = el('div', 'field');
  wrap.appendChild(el('div', 'field__label', item.label));
  if (item.hint) wrap.appendChild(el('div', 'field__hint', item.hint));

  BOOKING_FIELD_LABELS.forEach(function (field) {
    var present = LOCALES.filter(function (locale) {
      var fields = contentDoc.forms[locale.key].booking.fields || {};
      return typeof fields[field.key] === 'string';
    });
    if (!present.length) return;

    var row = el('div', 'access-route');
    row.appendChild(el('div', 'field__col-label', field.label));
    var cols = el('div', 'field__cols');
    LOCALES.forEach(function (locale) {
      var col = el('div');
      var fields = contentDoc.forms[locale.key].booking.fields;
      if (typeof fields[field.key] === 'string') {
        col.appendChild(textEditor(fields, field.key, false));
      } else {
        col.appendChild(el('div', 'field__hint', 'Not used on the ' + LANGUAGE_NAMES[locale.key] + ' form'));
      }
      cols.appendChild(col);
    });
    row.appendChild(cols);
    wrap.appendChild(row);
  });
  return wrap;
}

formsEls.saveBtn.addEventListener('click', function () {
  saveContent(formsEls.status, formsEls.saveBtn);
});

formsEls.publishBtn.addEventListener('click', function () {
  publishContent(formsEls.status, formsEls.publishBtn);
});
