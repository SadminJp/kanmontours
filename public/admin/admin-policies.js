/**
 * The Terms & Conditions tab: the page title and every section of the policies
 * page, in English and Japanese.
 *
 * It edits `contentDoc.policies` — the same document as the Tour Content and
 * Home Page tabs — so it shares their dirty flag, Save and Publish (see
 * admin-content.js) and reuses their field editors.
 */

var policiesEls = {
  editor: document.getElementById('policies-editor'),
  status: document.getElementById('policies-status'),
  saveBtn: document.getElementById('policies-save-btn'),
  publishBtn: document.getElementById('policies-publish-btn'),
};

function renderPolicies() {
  if (!contentDoc || !contentDoc.policies) return;
  policiesEls.editor.innerHTML = '';

  var card = el('div', 'card');

  var title = el('div', 'field');
  title.appendChild(el('div', 'field__label', 'Page title'));
  title.appendChild(el('div', 'field__hint', 'Shown at the top of the page and in the browser tab.'));
  var titleCols = el('div', 'field__cols');
  LOCALES.forEach(function (locale) {
    var col = el('div');
    col.appendChild(el('div', 'field__col-label', locale.label));
    col.appendChild(textEditor(contentDoc.policies[locale.key], 'pageTitle', false));
    titleCols.appendChild(col);
  });
  title.appendChild(titleCols);
  card.appendChild(title);

  var sections = el('div', 'field');
  sections.appendChild(el('div', 'field__label', 'Sections'));
  sections.appendChild(
    el('div', 'field__hint',
      'Each section has a heading, then optional paragraphs, then optional bullet points. ' +
      'The two languages are edited separately, so they can have different numbers of sections.')
  );
  var cols = el('div', 'field__cols');
  LOCALES.forEach(function (locale) {
    var col = el('div');
    col.appendChild(el('div', 'field__col-label', locale.label));
    col.appendChild(policySectionsEditor(contentDoc.policies[locale.key]));
    cols.appendChild(col);
  });
  sections.appendChild(cols);
  card.appendChild(sections);

  policiesEls.editor.appendChild(card);
}

/** An ordered list of sections, each with a heading, paragraphs and bullet points. */
function policySectionsEditor(side) {
  if (!Array.isArray(side.sections)) side.sections = [];
  var wrap = el('div');

  function draw() {
    wrap.innerHTML = '';
    side.sections.forEach(function (section, index) {
      var box = el('div', 'access-group');

      var head = el('div', 'row');
      var body = el('div', 'row__body');
      body.appendChild(el('div', 'field__col-label', 'Section ' + (index + 1) + ' heading'));
      body.appendChild(textEditor(section, 'heading', false));
      head.appendChild(body);

      var controls = el('div', 'row__controls');
      var up = button('row__btn', '↑', function () { move(index, -1); });
      up.disabled = index === 0;
      var down = button('row__btn', '↓', function () { move(index, 1); });
      down.disabled = index === side.sections.length - 1;
      controls.appendChild(up);
      controls.appendChild(down);
      controls.appendChild(button('row__btn', '✕', function () {
        if (side.sections.length <= 1) return window.alert('The page needs at least one section.');
        if (!window.confirm('Remove the section "' + (section.heading || 'untitled') + '"?')) return;
        side.sections.splice(index, 1);
        markDirty();
        draw();
      }));
      head.appendChild(controls);
      box.appendChild(head);

      var paragraphs = el('div', 'access-route');
      paragraphs.appendChild(el('div', 'field__col-label', 'Paragraphs'));
      paragraphs.appendChild(listEditor(section, 'paragraphs', 'text'));
      box.appendChild(paragraphs);

      var bullets = el('div', 'access-route');
      bullets.appendChild(el('div', 'field__col-label', 'Bullet points'));
      bullets.appendChild(listEditor(section, 'list', 'text'));
      box.appendChild(bullets);

      wrap.appendChild(box);
    });

    wrap.appendChild(button('add-row-btn', '+ Add section', function () {
      side.sections.push({ heading: '', paragraphs: [''], list: [] });
      markDirty();
      draw();
    }));
  }

  function move(index, delta) {
    var target = index + delta;
    if (target < 0 || target >= side.sections.length) return;
    var moved = side.sections.splice(index, 1)[0];
    side.sections.splice(target, 0, moved);
    markDirty();
    draw();
  }

  draw();
  return wrap;
}

policiesEls.saveBtn.addEventListener('click', function () {
  saveContent(policiesEls.status, policiesEls.saveBtn);
});

policiesEls.publishBtn.addEventListener('click', function () {
  publishContent(policiesEls.status, policiesEls.publishBtn);
});
