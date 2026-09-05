/**
 * The tour content tab: every editable field on a tour card and tour page, in
 * English and Japanese side by side.
 *
 * Unlike the schedule tab, state does NOT live in the DOM. There are roughly
 * forty fields per tour per language, and reading all of that back out of the
 * DOM on save would be fragile. Instead `contentDoc` is the source of truth:
 * inputs write straight into it, and panels render from it.
 */

var contentEls = {
  intro: document.getElementById('content-intro'),
  tabs: document.getElementById('tour-tabs'),
  panels: document.getElementById('tour-panels'),
  status: document.getElementById('content-status'),
  saveBtn: document.getElementById('content-save-btn'),
  publishBtn: document.getElementById('publish-btn'),
};

/** The whole editable document, exactly as the API stores it. */
var contentDoc = null;
var activeTourId = null;
var contentDirty = false;

/**
 * Field order and presentation. This drives the whole editor — adding a field
 * to the tour type means adding one line here.
 */
var CONTENT_FIELDS = [
  { key: 'number', label: 'Tour number', type: 'text', affectsLabel: true, hint: 'Shown above the title, e.g. "Tour-1". Also appears in booking emails.' },
  { key: 'title', label: 'Title', type: 'text', affectsLabel: true },
  { key: 'subtitle', label: 'Subtitle', type: 'text' },
  { key: 'cardSummary', label: 'Summary', type: 'textarea', hint: 'Shown on the homepage card, and used as the page description in search results.' },
  { key: 'heroImage', label: 'Card photo', type: 'image', hint: 'The photo on the homepage card.' },
  { key: 'overview', label: 'Overview paragraphs', type: 'list' },
  { key: 'overviewImages', label: 'Overview photos', type: 'images' },
  { key: 'highlights', label: 'Highlights', type: 'list', hint: 'Shown as a bulleted list.' },
  { key: 'highlightImages', label: 'Highlight photos', type: 'images' },
  { key: 'itinerary', label: 'Itinerary steps', type: 'itinerary', hint: 'Numbered automatically in the order shown here.' },
  { key: 'detailPrice', label: 'Price (tour page)', type: 'text' },
  { key: 'bookingPrice', label: 'Price (booking form)', type: 'text', hint: 'Appears next to the tour on the booking form and in booking emails.' },
  { key: 'included', label: 'Included', type: 'text' },
  { key: 'notIncluded', label: 'Not included', type: 'text' },
  { key: 'departureTime', label: 'Departure time', type: 'text' },
  { key: 'duration', label: 'Duration', type: 'text' },
  { key: 'meetingPoint', label: 'Meeting point', type: 'list', hint: 'Each line is shown as its own paragraph.' },
  { key: 'groupSize', label: 'Group size', type: 'text' },
  { key: 'sharedNote', label: 'Shared tour note', type: 'text', hint: 'Shown after the group size, separated by a dash.' },
  { key: 'operatingDatesNote', label: 'Operating dates note', type: 'text' },
  { key: 'walkingDistance', label: 'Walking distance', type: 'text' },
];

var LOCALES = [
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' },
];

function markDirty() {
  contentDirty = true;
  updatePublishState();
}

/* --- rendering ---------------------------------------------------------- */

function renderContent(doc) {
  contentDoc = doc;
  contentDirty = false;
  if (!activeTourId || !findTour(activeTourId)) {
    activeTourId = doc.tours.length ? doc.tours[0].id : null;
  }
  renderTourTabs();
  renderActiveTour();
  updatePublishState();
}

function findTour(id) {
  for (var i = 0; i < contentDoc.tours.length; i++) {
    if (contentDoc.tours[i].id === id) return contentDoc.tours[i];
  }
  return null;
}

function tourLabel(tour) {
  var number = (tour.en && tour.en.number) || '';
  var title = (tour.en && tour.en.title) || tour.slug;
  return number ? number + ' — ' + title : title;
}

function renderTourTabs() {
  contentEls.tabs.innerHTML = '';
  contentDoc.tours.forEach(function (tour) {
    var tab = button('tab' + (tour.id === activeTourId ? ' is-active' : ''), tourLabel(tour), function () {
      activeTourId = tour.id;
      renderTourTabs();
      renderActiveTour();
    });
    contentEls.tabs.appendChild(tab);
  });

  contentEls.tabs.appendChild(button('tab', '+ Add tour', addTour));
}

function renderActiveTour() {
  contentEls.panels.innerHTML = '';
  var tour = findTour(activeTourId);
  if (!tour) return;

  var card = el('div', 'card');
  card.appendChild(renderSlugRow(tour));

  CONTENT_FIELDS.forEach(function (field) {
    card.appendChild(renderField(tour, field));
  });

  card.appendChild(renderDangerZone(tour));
  contentEls.panels.appendChild(card);
}

function renderSlugRow(tour) {
  var wrap = el('div');
  var row = el('div', 'slug-row');

  var col = el('div');
  col.appendChild(el('div', 'field__col-label', 'Web address'));
  var input = document.createElement('input');
  input.type = 'text';
  input.value = tour.slug;
  col.appendChild(input);
  row.appendChild(col);

  var preview = el('div', 'field__hint', '/en/tours/' + tour.slug + '/');
  preview.style.paddingBottom = '0.6rem';
  row.appendChild(preview);
  wrap.appendChild(row);

  // Renaming a slug silently breaks the live URL, any bookmark and any search
  // result pointing at it, so the warning appears the moment it diverges.
  var warning = el('div', 'warn');
  warning.hidden = true;
  wrap.appendChild(warning);

  var original = tour.slug;
  input.addEventListener('input', function () {
    tour.slug = input.value.trim().toLowerCase();
    preview.textContent = '/en/tours/' + tour.slug + '/';
    if (tour.slug !== original) {
      warning.textContent =
        'Changing this breaks the existing link kanmontours.jp/en/tours/' + original +
        '/ — anyone who bookmarked or shared it will get a "page not found".';
      warning.hidden = false;
    } else {
      warning.hidden = true;
    }
    renderTourTabs();
    markDirty();
  });

  return wrap;
}

function renderField(tour, field) {
  var wrap = el('div', 'field');
  wrap.appendChild(el('div', 'field__label', field.label));
  if (field.hint) wrap.appendChild(el('div', 'field__hint', field.hint));

  var cols = el('div', 'field__cols');
  LOCALES.forEach(function (locale) {
    var col = el('div');
    col.appendChild(el('div', 'field__col-label', locale.label));
    col.appendChild(renderEditor(tour[locale.key], field));
    cols.appendChild(col);
  });
  wrap.appendChild(cols);
  return wrap;
}

function renderEditor(data, field) {
  switch (field.type) {
    case 'textarea': return textareaEditor(data, field.key);
    case 'list': return listEditor(data, field.key, 'text');
    case 'itinerary': return listEditor(data, field.key, 'step');
    case 'images': return imageListEditor(data, field.key);
    case 'image': return singleImageEditor(data, field.key);
    default: return textEditor(data, field.key, field.affectsLabel);
  }
}

function textEditor(data, key, affectsLabel) {
  var input = document.createElement('input');
  input.type = 'text';
  input.value = data[key] || '';
  input.addEventListener('input', function () {
    data[key] = input.value;
    // The tab label is built from the English number and title, so keep it in
    // step as they are typed rather than only after a save.
    if (affectsLabel) renderTourTabs();
    markDirty();
  });
  return input;
}

function textareaEditor(data, key) {
  var area = document.createElement('textarea');
  area.rows = 4;
  area.value = data[key] || '';
  area.addEventListener('input', function () {
    data[key] = area.value;
    markDirty();
  });
  return area;
}

/**
 * Editor for an ordered list of strings.
 *
 * `kind` is 'text' for plain string arrays (overview, highlights,
 * meetingPoint) or 'step' for the itinerary, whose entries are {text} objects.
 * Reordering is done with buttons rather than drag-and-drop: reliable in plain
 * JS, keyboard accessible, and usable on a tablet.
 */
function listEditor(data, key, kind) {
  var wrap = el('div');
  var rows = el('div', 'rows');
  wrap.appendChild(rows);

  if (!Array.isArray(data[key])) data[key] = [];

  function valueAt(i) { return kind === 'step' ? (data[key][i] || {}).text || '' : data[key][i] || ''; }
  function setAt(i, value) { data[key][i] = kind === 'step' ? { text: value } : value; }

  function draw() {
    rows.innerHTML = '';
    data[key].forEach(function (_, index) {
      var row = el('div', 'row');

      var body = el('div', 'row__body');
      var area = document.createElement('textarea');
      area.rows = kind === 'step' ? 2 : 3;
      area.value = valueAt(index);
      area.addEventListener('input', function () {
        setAt(index, area.value);
        markDirty();
      });
      body.appendChild(area);
      row.appendChild(body);

      var controls = el('div', 'row__controls');
      var up = button('row__btn', '↑', function () { move(index, -1); });
      up.disabled = index === 0;
      var down = button('row__btn', '↓', function () { move(index, 1); });
      down.disabled = index === data[key].length - 1;
      controls.appendChild(up);
      controls.appendChild(down);
      controls.appendChild(button('row__btn', '✕', function () {
        data[key].splice(index, 1);
        markDirty();
        draw();
      }));
      row.appendChild(controls);

      rows.appendChild(row);
    });
  }

  function move(index, delta) {
    var target = index + delta;
    if (target < 0 || target >= data[key].length) return;
    var moved = data[key].splice(index, 1)[0];
    data[key].splice(target, 0, moved);
    markDirty();
    draw();
  }

  draw();
  wrap.appendChild(button('add-row-btn', '+ Add', function () {
    setAt(data[key].length, '');
    markDirty();
    draw();
  }));
  return wrap;
}

function singleImageEditor(data, key) {
  var wrap = el('div');
  var row = el('div', 'img-row');

  var img = document.createElement('img');
  img.alt = '';
  img.src = data[key] || '';
  row.appendChild(img);

  var fields = el('div', 'img-row__fields');
  var path = el('div', 'field__hint', data[key] || 'No photo chosen');
  path.style.wordBreak = 'break-all';
  fields.appendChild(path);
  row.appendChild(fields);
  wrap.appendChild(row);

  wrap.appendChild(
    uploadButton('Replace photo', false, function (src) {
      data[key] = src;
      img.src = src;
      path.textContent = src;
      markDirty();
    }, contentEls.status)
  );

  return wrap;
}

/** Editor for a list of {src, alt} images, with reorder and remove. */
function imageListEditor(data, key) {
  var wrap = el('div');
  var rows = el('div', 'rows');
  wrap.appendChild(rows);

  if (!Array.isArray(data[key])) data[key] = [];

  function draw() {
    rows.innerHTML = '';
    data[key].forEach(function (image, index) {
      var row = el('div', 'img-row');

      var img = document.createElement('img');
      img.src = image.src || '';
      img.alt = '';
      row.appendChild(img);

      var fields = el('div', 'img-row__fields');

      var path = el('div', 'field__hint', image.src || 'No photo');
      path.style.wordBreak = 'break-all';
      path.style.marginBottom = '0';
      fields.appendChild(path);

      var altInput = document.createElement('input');
      altInput.type = 'text';
      altInput.value = image.alt || '';
      altInput.placeholder = 'Describe the photo (for screen readers and search engines)';
      altInput.addEventListener('input', function () {
        image.alt = altInput.value;
        markDirty();
      });
      fields.appendChild(altInput);
      row.appendChild(fields);

      var controls = el('div', 'row__controls');
      var up = button('row__btn', '↑', function () { move(index, -1); });
      up.disabled = index === 0;
      var down = button('row__btn', '↓', function () { move(index, 1); });
      down.disabled = index === data[key].length - 1;
      controls.appendChild(up);
      controls.appendChild(down);
      controls.appendChild(button('row__btn', '✕', function () {
        data[key].splice(index, 1);
        markDirty();
        draw();
      }));
      row.appendChild(controls);

      rows.appendChild(row);
    });
  }

  function move(index, delta) {
    var target = index + delta;
    if (target < 0 || target >= data[key].length) return;
    var moved = data[key].splice(index, 1)[0];
    data[key].splice(target, 0, moved);
    markDirty();
    draw();
  }

  draw();
  wrap.appendChild(
    uploadButton('+ Add photos', true, function (src) {
      data[key].push({ src: src, alt: '' });
      markDirty();
      draw();
    }, contentEls.status)
  );
  return wrap;
}

function renderDangerZone(tour) {
  var zone = el('div', 'danger-zone');
  zone.appendChild(el('p', null, 'Removing a tour deletes its page from the website and cannot be undone.'));
  zone.appendChild(button('danger', 'Delete this tour', function () { deleteTour(tour); }));
  return zone;
}

/* --- add / delete ------------------------------------------------------- */

function blankLocale() {
  var side = {};
  CONTENT_FIELDS.forEach(function (field) {
    if (field.type === 'list' || field.type === 'itinerary' || field.type === 'images') side[field.key] = [];
    else side[field.key] = '';
  });
  return side;
}

function addTour() {
  var slug = window.prompt('Web address for the new tour (lowercase letters, numbers and hyphens):', '');
  if (slug === null) return;
  slug = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return window.alert('That web address is not valid. Use lowercase letters, numbers and hyphens, for example: kokura-night-walk');
  }
  for (var i = 0; i < contentDoc.tours.length; i++) {
    if (contentDoc.tours[i].slug === slug) return window.alert('A tour already uses that web address.');
  }

  var id = 't_' + Math.random().toString(36).slice(2, 10);
  var tour = { id: id, slug: slug, en: blankLocale(), ja: blankLocale() };
  tour.en.number = 'Tour-' + (contentDoc.tours.length + 1);
  tour.en.title = 'New tour';
  tour.ja.number = tour.en.number;
  tour.ja.title = '新しいツアー';

  contentDoc.tours.push(tour);
  activeTourId = id;
  markDirty();
  renderTourTabs();
  renderActiveTour();
  setStatus(
    contentEls.status,
    'Tour added. Fill in every field before saving — blank titles and prices are rejected. It will not be bookable until you set its operating days on the Schedule tab.',
    'loading'
  );
}

function deleteTour(tour) {
  if (contentDoc.tours.length <= 1) {
    return window.alert('You cannot delete the last remaining tour.');
  }
  var confirmed = window.confirm(
    'Delete "' + tourLabel(tour) + '"?\n\n' +
      'Its page at /en/tours/' + tour.slug + '/ will be removed from the website when you next publish. ' +
      'This cannot be undone.'
  );
  if (!confirmed) return;

  contentDoc.tours = contentDoc.tours.filter(function (t) { return t.id !== tour.id; });
  activeTourId = contentDoc.tours.length ? contentDoc.tours[0].id : null;
  markDirty();
  renderTourTabs();
  renderActiveTour();
}

/* --- save / publish ----------------------------------------------------- */

/**
 * Publishing is separate from saving because each publish is a full site
 * rebuild. Saving every keystroke straight to a deploy would burn build
 * minutes and leave the client waiting minutes to see anything.
 */
function updatePublishState() {
  if (!contentDoc) return;
  var unpublished = contentDoc.updatedAt !== contentDoc.publishedAt;
  contentEls.publishBtn.disabled = contentDirty || !unpublished;
  contentEls.publishBtn.textContent = contentDirty
    ? 'Save first, then publish'
    : unpublished
      ? 'Publish to website'
      : 'Everything is published';
}

contentEls.saveBtn.addEventListener('click', function () {
  var password = getSessionPassword();
  if (!password) return showLogin('Please log in again.');

  contentEls.saveBtn.disabled = true;
  setStatus(contentEls.status, 'Saving…', 'loading');

  postJson(CONTENT_URL, {
    password: password,
    baseUpdatedAt: contentDoc.updatedAt,
    data: { tours: contentDoc.tours },
  })
    .then(function (body) {
      var published = contentDoc.publishedAt;
      renderContent(body.data);
      contentDoc.publishedAt = published;
      renderScheduleTours(toScheduleTours(contentDoc));
      updatePublishState();
      setStatus(contentEls.status, 'Saved. Press "Publish to website" to put these changes live.', 'success');
    })
    .catch(function (error) {
      if (isAuthError(error)) showLogin('Your session has expired. Please log in again.');
      else setStatus(contentEls.status, error.message || 'Could not save.', 'error');
    })
    .finally(function () {
      contentEls.saveBtn.disabled = false;
    });
});

contentEls.publishBtn.addEventListener('click', function () {
  var password = getSessionPassword();
  if (!password) return showLogin('Please log in again.');

  contentEls.publishBtn.disabled = true;
  setStatus(contentEls.status, 'Publishing… the website updates in a minute or two.', 'loading');

  postJson(CONTENT_URL + '?action=publish', { password: password })
    .then(function (body) {
      contentDoc.publishedAt = body.publishedAt;
      updatePublishState();
      setStatus(
        contentEls.status,
        'Publishing started. The website will show your changes in a minute or two — reload the site to check.',
        'success'
      );
    })
    .catch(function (error) {
      if (isAuthError(error)) showLogin('Your session has expired. Please log in again.');
      else setStatus(contentEls.status, error.message || 'Could not publish.', 'error');
      updatePublishState();
    });
});

/** The schedule tab's tour list is derived from the content document. */
function toScheduleTours(doc) {
  return doc.tours.map(function (tour) {
    return { slug: tour.slug, label: tourLabel(tour) };
  });
}

// Leaving with unsaved edits loses them, so warn the way any editor would.
window.addEventListener('beforeunload', function (event) {
  if (!contentDirty) return;
  event.preventDefault();
  event.returnValue = '';
});
