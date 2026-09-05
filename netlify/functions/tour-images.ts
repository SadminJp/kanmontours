import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { STORE_NAME, json, verifyAdminPassword } from '../lib/admin.js';

/**
 * Stores and serves the photos uploaded through the admin page.
 *
 * POST /api/tour-images?filename=harbour.jpg — admin only. The body is the raw
 *      image bytes, deliberately not base64 in JSON: Netlify caps a function
 *      request at roughly 6MB and base64 inflates by a third, which would waste
 *      a quarter of the budget for nothing.
 *
 * GET  /images/tours/uploaded/<key> — public, because these are ordinary page
 *      images. Rewritten to this function by netlify.toml.
 *
 * Serving through a function rather than materialising files into the build is
 * a deliberate trade. The alternative needs Blobs access at build time, which
 * is exactly what does not work here (see src/data/tours.ts). Uploaded keys are
 * unique and never rewritten — editing a photo means uploading a new one — so
 * responses are immutable and the CDN can cache them indefinitely, making this
 * roughly one invocation per image per edge node.
 */

const UPLOAD_PREFIX = 'uploads/';
const PUBLIC_PREFIX = '/images/tours/uploaded/';
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Keys are generated here, so anything not matching is a probe, not a typo. */
const KEY_RE = /^[a-z0-9]{8}-[a-z0-9-]{1,60}\.(jpg|jpeg|png|webp)$/;

function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : '';
}

/** Strips anything that could escape the key namespace or confuse a URL. */
function safeName(name: string): string {
  const base = name.replace(/\.[^.]*$/, '');
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return cleaned || 'photo';
}

export default async (req: Request, _context: Context): Promise<Response> => {
  const store = getStore(STORE_NAME);
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const key = url.searchParams.get('key') || '';
    if (!KEY_RE.test(key)) {
      return new Response('Not found', { status: 404 });
    }

    const blob = await store.getWithMetadata(UPLOAD_PREFIX + key, { type: 'arrayBuffer' });
    if (!blob) {
      return new Response('Not found', { status: 404 });
    }

    const contentType = (blob.metadata?.contentType as string) || CONTENT_TYPES[extensionOf(key)] || 'image/jpeg';
    return new Response(blob.data as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // A given key's bytes never change, so this can be cached forever.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  if (req.method === 'POST') {
    if (!verifyAdminPassword(req.headers.get('X-Admin-Password'))) {
      return json({ error: 'Incorrect password.' }, 401);
    }

    const contentType = (req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    const extension = Object.keys(CONTENT_TYPES).find((ext) => CONTENT_TYPES[ext] === contentType);
    if (!extension) {
      return json({ error: 'Only JPEG, PNG and WebP images can be uploaded.' }, 415);
    }

    const bytes = await req.arrayBuffer();
    if (!bytes.byteLength) {
      return json({ error: 'The upload was empty.' }, 400);
    }
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      // The admin page compresses before uploading, so anything this large
      // means compression failed — worth surfacing rather than accepting.
      return json({ error: 'That image is too large. Please try a smaller photo.' }, 413);
    }

    const id = Math.random().toString(36).slice(2, 10);
    const name = safeName(url.searchParams.get('filename') || 'photo');
    const key = `${id}-${name}.${extension === 'jpeg' ? 'jpg' : extension}`;

    await store.set(UPLOAD_PREFIX + key, bytes, {
      metadata: {
        contentType,
        uploadedAt: new Date().toISOString(),
        originalName: (url.searchParams.get('filename') || '').slice(0, 200),
      },
    });

    return json({ ok: true, src: PUBLIC_PREFIX + key, bytes: bytes.byteLength });
  }

  return json({ error: 'Method not allowed.' }, 405);
};
