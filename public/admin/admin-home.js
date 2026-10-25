/**
 * The Home Page tab: every piece of home page text in English and Japanese side
 * by side, the home page photos, and the few site-wide items (search title and
 * description, footer contact) that live in the same data.
 *
 * It edits `contentDoc.home` — the same document the Tour Content tab edits —
 * so it shares that tab's dirty flag, Save and Publish (see admin-content.js),
 * and reuses its field editors. Like that tab, state lives in the document, not
 * the DOM: inputs write straight into it and sections render from it.
 */

var homeEls = {
  tabs: document.getElementById('home-tabs'),
  editor: document.getElementById('home-editor'),
  status: document.getElementById('home-status'),
  saveBtn: document.getElementById('home-save-btn'),
  publishBtn: document.getElementById('home-publish-btn'),
};

/**
 * Section order and contents, top of the page to the bottom. Each field names
 * its place in the per-language data by path; `photo`/`photos` entries name a
 * slot in `home.images`, whose sizes are fixed (see HOME_IMAGE_SLOTS in
 * src/data/types.ts) so a gallery can never end up with a hole in it.
 */
var HOME_SECTIONS = [
  {
    id: 'hero',
    title: 'Top of page',
    items: [
      { path: ['hero', 'eyebrow'], label: 'Main heading', type: 'text', hint: 'The large heading at the very top of the page.' },
      { path: ['hero', 'tagline'], label: 'Tagline', type: 'text', hint: 'Shown just under the main heading.' },
      { path: ['hero', 'title'], label: 'Location heading', type: 'list', hint: 'Shown above the banner photos. Each line appears on its own row.' },
      { photos: 'banners', label: 'Banner photos' },
    ],
  },
  {
    id: 'intro',
    title: 'Cities of the Strait',
    items: [
      { path: ['intro', 'heading'], label: 'Heading', type: 'text' },
      { path: ['intro', 'paragraphs'], label: 'Paragraphs', type: 'list' },
      { photo: 'regionMap', label: 'Map' },
    ],
  },
  {
    id: 'cities',
    title: 'About the Cities',
    items: [
      { path: ['cities', 'heading'], label: 'Section heading', type: 'text' },
      { path: ['cities', 'kitakyushu', 'title'], label: 'Kitakyushu — heading', type: 'text' },
      { path: ['cities', 'kitakyushu', 'paragraphs'], label: 'Kitakyushu — paragraphs', type: 'list' },
      { photos: 'kitakyushuGallery', label: 'Kitakyushu — photos' },
      { path: ['cities', 'shimonoseki', 'title'], label: 'Shimonoseki — heading', type: 'text' },
      { path: ['cities', 'shimonoseki', 'paragraphs'], label: 'Shimonoseki — paragraphs', type: 'list' },
      { photos: 'shimonosekiGallery', label: 'Shimonoseki — photos' },
    ],
  },
  {
    id: 'offer',
    title: 'What We Offer',
    items: [
      { path: ['offer', 'heading'], label: 'Heading', type: 'text' },
      { path: ['offer', 'paragraphs'], label: 'Paragraphs', type: 'list' },
      { photos: 'offerGallery', label: 'Photos' },
      { path: ['offer', 'specialHeading'], label: 'Second heading', type: 'text', hint: 'Shown above the bullet points.' },
      { path: ['offer', 'specialPoints'], label: 'Bullet points', type: 'list' },
    ],
  },
  {
    id: 'tours',
    title: 'Tours',
    note: 'The tour cards themselves are edited on the Tour Content tab.',
    items: [
      { path: ['tours', 'heading'], label: 'Heading', type: 'text' },
      { path: ['tours', 'intro'], label: 'Introduction', type: 'textarea', hint: 'Optional. Shown above the tour cards; leave blank to hide it.' },
    ],
  },
  {
    id: 'about',
    title: 'About Us',
    items: [
      { path: ['about', 'heading'], label: 'Heading', type: 'text' },
      { path: ['about', 'paragraphs'], label: 'Paragraphs', type: 'list' },
      { photos: 'aboutGallery', label: 'Team photos' },
    ],
  },
  {
    id: 'access',
    title: 'Access',
    items: [
      { path: ['access', 'heading'], label: 'Heading', type: 'text' },
      { photo: 'accessMap', label: 'Route map' },
      { access: true, label: 'Routes', hint: 'Each group is a destination; each route under it is one way of getting there.' },
    ],
  },
  {
    id: 'site',
    title: 'Site-wide',
    note: 'These appear on every page of the website, not just the home page.',
    items: [
      { path: ['meta', 'title'], label: 'Search title', type: 'text', hint: 'Shown in the browser tab and in Google results. Other pages add their own name in front of it.' },
      { path: ['meta', 'description'], label: 'Search description', type: 'textarea', hint: 'The summary Google shows under the title.' },
      { path: ['contact', 'heading'], label: 'Footer contact heading', type: 'text' },
      { path: ['contact', 'email'], label: 'Footer contact email', type: 'text', hint: 'Shown at the bottom of every page.' },
    ],
  },
];

var activeHomeSection = HOME_SECTIONS[0].id;

/* --- rendering ---------------------------------------------------------- */

function renderHome() {
  if (!contentDoc || !contentDoc.home) return;
  renderHomeTabs();
  renderHomeSection();
}

function renderHomeTabs() {
  homeEls.tabs.innerHTML = '';
  HOME_SECTIONS.forEach(function (section) {
    homeEls.tabs.appendChild(
      button('tab' + (section.id === activeHomeSection ? ' is-active' : ''), section.title, function () {
        activeHomeSection = section.id;
        renderHomeTabs();
        renderHomeSection();
      })
    );
  });
}

function renderHomeSection() {
  homeEls.editor.innerHTML = '';
  var section = null;
  for (var i = 0; i < HOME_SECTIONS.length; i++) {
    if (HOME_SECTIONS[i].id === activeHomeSection) section = HOME_SECTIONS[i];
  }
  if (!section) return;

  var card = el('div', 'card');
  card.appendChild(el('h2', null, section.title));
  if (section.note) card.appendChild(el('p', 'field__hint', section.note));

  section.items.forEach(function (item) {
    if (item.photo) card.appendChild(renderPhotoSlot(item.label, item.photo, null));
    else if (item.photos) card.appendChild(renderPhotoGallery(item.label, item.photos));
    else if (item.access) card.appendChild(renderAccessField(item));
    else card.appendChild(renderHomeField(item));
  });

  homeEls.editor.appendChild(card);
}

/** Follows a path like ['cities', 'kitakyushu'] into one language's data. */
function homeParent(localeKey, path) {
  var node = contentDoc.home[localeKey];
  for (var i = 0; i < path.length - 1; i++) {
    if (!node[path[i]] || typeof node[path[i]] !== 'object') node[path[i]] = {};
    node = node[path[i]];
  }
  return node;
}

function renderHomeField(item) {
  var wrap = el('div', 'field');
  wrap.appendChild(el('div', 'field__label', item.label));
  if (item.hint) wrap.appendChild(el('div', 'field__hint', item.hint));

  var key = item.path[item.path.length - 1];
  var cols = el('div', 'field__cols');
  LOCALES.forEach(function (locale) {
    var col = el('div');
    col.appendChild(el('div', 'field__col-label', locale.label));
    var parent = homeParent(locale.key, item.path);
    if (item.type === 'list') col.appendChild(listEditor(parent, key, 'text'));
    else if (item.type === 'textarea') col.appendChild(textareaEditor(parent, key));
    else col.appendChild(textEditor(parent, key, false));
    cols.appendChild(col);
  });
  wrap.appendChild(cols);
  return wrap;
}

/* --- photos ------------------------------------------------------------- */

function renderPhotoGallery(label, slot) {
  var wrap = el('div', 'field');
  wrap.appendChild(el('div', 'field__label', label));
  wrap.appendChild(el('div', 'field__hint', 'Each photo can be replaced, but the number of photos is fixed so the layout stays intact.'));
  contentDoc.home.images[slot].forEach(function (_, index) {
    wrap.appendChild(renderPhotoRow(slot, index, 'Photo ' + (index + 1)));
  });
  return wrap;
}

function renderPhotoSlot(label, slot) {
  var wrap = el('div', 'field');
  wrap.appendChild(el('div', 'field__label', label));
  wrap.appendChild(renderPhotoRow(slot, null, null));
  return wrap;
}

/**
 * One photo: shared by both languages, so it has a single Replace button, but
 * a description per language (what screen readers and Google read).
 */
function renderPhotoRow(slot, index, caption) {
  function image() {
    return index === null ? contentDoc.home.images[slot] : contentDoc.home.images[slot][index];
  }
  var current = image();
  if (!current.alt) current.alt = { en: '', ja: '' };

  var box = el('div', 'photo-slot');
  var row = el('div', 'img-row');

  var img = document.createElement('img');
  img.alt = '';
  img.src = current.src || '';
  row.appendChild(img);

  var fields = el('div', 'img-row__fields');
  if (caption) fields.appendChild(el('div', 'field__col-label', caption));
  var path = el('div', 'field__hint', current.src || 'No photo');
  path.style.wordBreak = 'break-all';
  fields.appendChild(path);
  fields.appendChild(
    uploadButton('Replace photo', false, function (src) {
      image().src = src;
      img.src = src;
      path.textContent = src;
      markDirty();
    }, homeEls.status)
  );
  row.appendChild(fields);
  box.appendChild(row);

  var cols = el('div', 'field__cols');
  LOCALES.forEach(function (locale) {
    var col = el('div');
    col.appendChild(el('div', 'field__col-label', 'Description — ' + locale.label));
    var input = document.createElement('input');
    input.type = 'text';
    input.value = current.alt[locale.key] || '';
    input.placeholder = 'Describe the photo';
    input.addEventListener('input', function () {
      image().alt[locale.key] = input.value;
      markDirty();
    });
    col.appendChild(input);
    cols.appendChild(col);
  });
  box.appendChild(cols);
  return box;
}

/* --- access routes ------------------------------------------------------ */

function renderAccessField(item) {
  var wrap = el('div', 'field');
  wrap.appendChild(el('div', 'field__label', item.label));
  if (item.hint) wrap.appendChild(el('div', 'field__hint', item.hint));

  var cols = el('div', 'field__cols');
  LOCALES.forEach(function (locale) {
    var col = el('div');
    col.appendChild(el('div', 'field__col-label', locale.label));
    col.appendChild(accessEditor(homeParent(locale.key, ['access', 'groups'])));
    cols.appendChild(col);
  });
  wrap.appendChild(cols);
  return wrap;
}

/**
 * Groups (a destination, e.g. "Access to Kokura") each holding routes (a label
 * such as "From Fukuoka" plus one or more lines). Languages are edited
 * independently, so the two columns can have different numbers of routes.
 */
function accessEditor(access) {
  if (!Array.isArray(access.groups)) access.groups = [];
  var wrap = el('div');

  function draw() {
    wrap.innerHTML = '';
    access.groups.forEach(function (group, g) {
      if (!Array.isArray(group.routes)) group.routes = [];
      var box = el('div', 'access-group');

      var head = el('div', 'row');
      var body = el('div', 'row__body');
      body.appendChild(el('div', 'field__col-label', 'Group ' + (g + 1) + ' heading'));
      body.appendChild(textEditor(group, 'heading', false));
      head.appendChild(body);

      var controls = el('div', 'row__controls');
      var up = button('row__btn', '↑', function () { moveGroup(g, -1); });
      up.disabled = g === 0;
      var down = button('row__btn', '↓', function () { moveGroup(g, 1); });
      down.disabled = g === access.groups.length - 1;
      controls.appendChild(up);
      controls.appendChild(down);
      controls.appendChild(button('row__btn', '✕', function () {
        if (!window.confirm('Remove the group "' + (group.heading || 'untitled') + '" and all its routes?')) return;
        access.groups.splice(g, 1);
        markDirty();
        draw();
      }));
      head.appendChild(controls);
      box.appendChild(head);

      group.routes.forEach(function (route, r) {
        var routeBox = el('div', 'access-route');
        var routeHead = el('div', 'row');
        var routeBody = el('div', 'row__body');
        routeBody.appendChild(el('div', 'field__col-label', 'Route ' + (r + 1)));
        routeBody.appendChild(textEditor(route, 'label', false));
        routeHead.appendChild(routeBody);
        var routeControls = el('div', 'row__controls');
        routeControls.appendChild(button('row__btn', '✕', function () {
          group.routes.splice(r, 1);
          markDirty();
          draw();
        }));
        routeHead.appendChild(routeControls);
        routeBox.appendChild(routeHead);
        routeBox.appendChild(listEditor(route, 'lines', 'text'));
        box.appendChild(routeBox);
      });

      box.appendChild(button('add-row-btn', '+ Add route', function () {
        group.routes.push({ label: '', lines: [''] });
        markDirty();
        draw();
      }));
      wrap.appendChild(box);
    });

    wrap.appendChild(button('add-row-btn', '+ Add group', function () {
      access.groups.push({ heading: '', routes: [{ label: '', lines: [''] }] });
      markDirty();
      draw();
    }));
  }

  function moveGroup(index, delta) {
    var target = index + delta;
    if (target < 0 || target >= access.groups.length) return;
    var moved = access.groups.splice(index, 1)[0];
    access.groups.splice(target, 0, moved);
    markDirty();
    draw();
  }

  draw();
  return wrap;
}

/* --- save / publish ----------------------------------------------------- */

homeEls.saveBtn.addEventListener('click', function () {
  saveContent(homeEls.status, homeEls.saveBtn);
});

homeEls.publishBtn.addEventListener('click', function () {
  publishContent(homeEls.status, homeEls.publishBtn);
});
