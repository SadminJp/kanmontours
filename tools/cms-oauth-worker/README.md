# CMS OAuth helper

Lets the client sign in to the schedule admin at `/kanmontours/admin/`.

GitHub's OAuth flow needs a client secret to swap an authorization code for a
token. A static site on GitHub Pages has nowhere safe to keep that secret, so
this small Cloudflare Worker does the exchange instead. It is the only piece of
the setup that is not part of the static site.

Cost: nothing. `workers.dev` is free, needs no domain on Cloudflare, and a
sign-in uses a handful of the free tier's 100k daily requests.

## Setup

The OAuth App needs the Worker's URL, and the Worker needs the OAuth App's
credentials — so create the Worker first, just to claim its URL.

### 1. Create the Worker

At [dash.cloudflare.com](https://dash.cloudflare.com) → Workers → **Create**.
Name it `kanmon-cms-auth` and deploy the default template. The first Worker on a
new account also asks you to pick a `workers.dev` subdomain.

Note the URL you get back:

```
https://kanmon-cms-auth.<your-subdomain>.workers.dev
```

### 2. Create the GitHub OAuth App

github.com → Settings → Developer settings → **OAuth Apps** → New OAuth App.

| Field | Value |
| --- | --- |
| Application name | `Kanmon Tours CMS` |
| Homepage URL | `https://sadminjp.github.io/kanmontours` |
| Authorization callback URL | `https://kanmon-cms-auth.<your-subdomain>.workers.dev/callback` |

Copy the **Client ID**, then generate and copy a **Client Secret**.

### 3. Add the credentials to the Worker

In the Worker → Settings → Variables:

| Name | Value | Type |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | from step 2 | Text |
| `GITHUB_CLIENT_SECRET` | from step 2 | **Secret** (encrypted) |
| `SITE_ORIGIN` | `https://sadminjp.github.io` | Text |
| `OAUTH_SCOPE` | `public_repo` if the repo is public, otherwise omit | Text |

`SITE_ORIGIN` is the only origin the token is ever sent to — set it correctly.

### 4. Deploy the real code

Replace the template with [`worker.js`](./worker.js) (Worker → Edit code →
paste → Deploy).

### 5. Point the CMS at it

In `public/admin/config.yml`, set `base_url` to the Worker's URL, **without**
`/callback`:

```yaml
backend:
  name: github
  repo: SadminJp/kanmontours
  branch: main
  base_url: https://kanmon-cms-auth.<your-subdomain>.workers.dev
```

Commit and push. Once GitHub Pages redeploys, `/kanmontours/admin/` will sign in.

## Who can log in

Anyone with write access to `SadminJp/kanmontours`. To give the client the admin
without handing over the whole account, move the repo into a GitHub organisation
and add them to a team with write permission on that repo only.

## Notes

- Sign-in is rejected unless GitHub returns the same `state` value the Worker
  issued, so a callback the Worker did not start cannot be traded for a token.
- The token is posted only to `SITE_ORIGIN`, not to whichever page opened the
  popup.
- If sign-in fails, the popup shows the reason. Worker logs are under
  Workers → your Worker → Logs.
