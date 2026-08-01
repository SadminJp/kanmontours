/**
 * GitHub OAuth helper for the Decap CMS admin at /kanmontours/admin/.
 *
 * GitHub's OAuth flow exchanges a code for a token using a client secret, which
 * cannot live in a static site. This Worker does that exchange and hands the
 * token back to the CMS popup.
 *
 * Deploy to Cloudflare Workers and set these variables (see README.md):
 *   GITHUB_CLIENT_ID      - from the GitHub OAuth App
 *   GITHUB_CLIENT_SECRET  - from the GitHub OAuth App (store as a Secret)
 *   SITE_ORIGIN           - origin allowed to receive the token,
 *                           e.g. https://sadminjp.github.io
 *   OAUTH_SCOPE           - optional; defaults to "repo".
 *                           Use "public_repo" if the repository is public.
 */

const STATE_COOKIE = 'decap_oauth_state';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/auth':
        return startAuth(url, env);
      case '/callback':
        return completeAuth(request, url, env);
      default:
        return new Response('Not found', { status: 404 });
    }
  },
};

function startAuth(url, env) {
  // Random state, echoed back by GitHub, so a callback we did not initiate is
  // rejected rather than exchanged for a token.
  const state = crypto.randomUUID();

  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${url.origin}/callback`);
  authorize.searchParams.set('scope', env.OAUTH_SCOPE || 'repo');
  authorize.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}

async function completeAuth(request, url, env) {
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const expectedState = readCookie(request.headers.get('Cookie'), STATE_COOKIE);

  if (!code) return failure('No authorization code was returned by GitHub.');
  if (!returnedState || returnedState !== expectedState) {
    return failure('Authorization state did not match. Please try logging in again.');
  }

  let token;
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data = await response.json();
    if (data.error || !data.access_token) {
      return failure(data.error_description || 'GitHub did not return an access token.');
    }
    token = data.access_token;
  } catch {
    return failure('Could not reach GitHub to complete sign-in.');
  }

  return handBackToCms(token, env);
}

/**
 * Decap opens this URL in a popup and waits for a postMessage handshake: the
 * popup announces itself, the CMS answers, and only then is the token sent.
 * The token is posted to SITE_ORIGIN alone, never to whatever origin happens
 * to have opened the popup.
 */
function handBackToCms(token, env) {
  const payload = JSON.stringify({ token, provider: 'github' });
  const message = jsString(`authorization:github:success:${payload}`);
  const origin = jsString(env.SITE_ORIGIN);

  return html(`<!doctype html>
<title>Signing in…</title>
<p>Completing sign-in…</p>
<script>
  (function () {
    var target = ${origin};
    function onMessage(event) {
      if (event.origin !== target) return;
      window.removeEventListener('message', onMessage, false);
      window.opener.postMessage(${message}, target);
    }
    window.addEventListener('message', onMessage, false);
    window.opener.postMessage('authorizing:github', target);
  })();
</script>`);
}

function failure(reason) {
  return html(`<!doctype html>
<title>Sign-in failed</title>
<h1>Sign-in failed</h1>
<p>${escapeHtml(reason)}</p>
<p>Close this window and try again.</p>`, 400);
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

/** Safe JS string literal: quoted, and with `<` escaped so it cannot close the script tag. */
function jsString(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}
