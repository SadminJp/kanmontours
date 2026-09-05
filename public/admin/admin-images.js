/**
 * Photo upload: compress in the browser, then send the raw bytes.
 *
 * Compressing client-side keeps uploads well inside Netlify's ~6MB function
 * limit and, more importantly, stops multi-megabyte phone photos reaching the
 * live site. A modern phone photo is 3-6MB; these come out around 200-500KB
 * with no visible difference at the sizes the pages actually display.
 */

var MAX_EDGE = 1600;
var JPEG_QUALITY = 0.82;
var SKIP_IF_UNDER = 400 * 1024;

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.round(bytes / 1024) + ' KB';
}

/**
 * Decodes a file, honouring its EXIF orientation.
 *
 * This is not optional. Canvas re-encoding discards EXIF, so a photo taken in
 * portrait on a phone — which is stored landscape plus a "rotate me" tag —
 * would end up sideways on the live site. imageOrientation: 'from-image' bakes
 * the rotation into the pixels while decoding. The <img> fallback is for
 * browsers without createImageBitmap options support, where the browser applies
 * orientation itself when rendering.
 */
function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      /* fall through to the <img> path */
    }
  }
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

/** Resolves to { blob, type, before, after } — or the original when small enough. */
function compressImage(file) {
  var before = file.size;

  return decodeImage(file).then(function (source) {
    var width = source.width;
    var height = source.height;
    var longest = Math.max(width, height);

    // Already small and already a JPEG: re-encoding would only lose quality.
    if (file.type === 'image/jpeg' && before <= SKIP_IF_UNDER && longest <= MAX_EDGE) {
      if (source.close) source.close();
      return { blob: file, type: 'image/jpeg', before: before, after: before };
    }

    var scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    if (source.close) source.close();

    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (!blob) return reject(new Error('That image could not be processed.'));
          resolve({ blob: blob, type: 'image/jpeg', before: before, after: blob.size });
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    });
  });
}

/** Compresses then uploads one file, resolving to the stored image path. */
function uploadImage(file, onProgress) {
  var password = getSessionPassword();
  if (!password) return Promise.reject(new Error('Please log in again.'));

  if (file.type.indexOf('image/') !== 0) {
    return Promise.reject(new Error('"' + file.name + '" is not an image.'));
  }

  if (onProgress) onProgress('Preparing ' + file.name + '…');

  return compressImage(file).then(function (result) {
    if (onProgress) {
      onProgress(
        'Uploading ' + file.name + ' (' + formatBytes(result.before) +
          (result.after < result.before ? ' → ' + formatBytes(result.after) : '') + ')…'
      );
    }

    return fetch('/api/tour-images?filename=' + encodeURIComponent(file.name), {
      method: 'POST',
      headers: { 'Content-Type': result.type, 'X-Admin-Password': password },
      body: result.blob,
    })
      .then(readJson)
      .then(function (body) {
        return { src: body.src, before: result.before, after: result.after };
      });
  });
}

/**
 * A file input that uploads whatever is chosen and reports each stored path.
 * `onUploaded(src)` is called once per file, in the order they were selected.
 */
function uploadButton(label, multiple, onUploaded, statusEl) {
  var wrap = el('span');

  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp';
  input.multiple = !!multiple;
  input.hidden = true;

  var btn = button('add-row-btn', label, function () { input.click(); });

  input.addEventListener('change', function () {
    var files = Array.prototype.slice.call(input.files || []);
    if (!files.length) return;
    input.value = '';
    btn.disabled = true;

    var report = function (message, kind) {
      if (statusEl) setStatus(statusEl, message, kind || 'loading');
    };

    // Sequential rather than parallel, so progress is meaningful and a slow
    // connection isn't asked to push several megabytes at once.
    var chain = Promise.resolve();
    var done = 0;
    var savedBefore = 0;
    var savedAfter = 0;

    files.forEach(function (file) {
      chain = chain.then(function () {
        return uploadImage(file, report).then(function (result) {
          done++;
          savedBefore += result.before;
          savedAfter += result.after;
          onUploaded(result.src);
        });
      });
    });

    chain
      .then(function () {
        report(
          'Added ' + done + (done === 1 ? ' photo' : ' photos') +
            ' (' + formatBytes(savedBefore) + ' → ' + formatBytes(savedAfter) + '). ' +
            'Remember to save.',
          'success'
        );
      })
      .catch(function (error) {
        if (isAuthError(error)) showLogin('Your session has expired. Please log in again.');
        else report(error.message || 'That photo could not be uploaded.', 'error');
      })
      .finally(function () {
        btn.disabled = false;
      });
  });

  wrap.appendChild(btn);
  wrap.appendChild(input);
  return wrap;
}
