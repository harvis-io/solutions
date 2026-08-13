# Static site with forms, deployed with an API key

A three-file static site whose contact form actually collects submissions, published from GitHub
Actions with an **account API key** rather than a site deploy token.

Two things are being demonstrated, and they fit together:

| | |
| --- | --- |
| [Forms](https://harvis.dev/forms) | `<form harvis-form="contact">` is the whole integration. harvis rewrites the form in the HTML it serves; submissions land in the dashboard. |
| API key deploys | `HARVIS_API_KEY` stands for the account, so the workflow can create the site, claim its address, and read the inbox — not just replace files. |

## Layout

Paths are relative to this folder, except the workflow, which GitHub only reads from the
repository root.

| Path | Purpose |
| --- | --- |
| `public/index.html` | The page, with two marked forms — `contact` and `newsletter` |
| `public/thanks.html` | Where `contact` redirects, via `data-harvis-redirect` |
| `public/styles.css` | Stylesheet |
| `deploy.sh` | curl against the account API: find the site by address, create it if absent, replace its files |
| `../.github/workflows/forms-example.yml` | Deploy on push to this folder, or on demand |

No build step and no dependencies. `deploy.sh` needs `curl` and `jq`, both present on
`ubuntu-latest`.

## The forms

```html
<form harvis-form="contact" data-harvis-redirect="/thanks.html">
  <input name="email" type="email" required>
  <textarea name="message"></textarea>
  <button>Send</button>
</form>
```

harvis is in the path of every HTML response it serves, so on the way out it rewrites any form
carrying the marker: `action` and `method` are replaced with the site's own collection endpoint,
an off-screen honeypot field is inserted, and `data-harvis-redirect` becomes a hidden field — the
handler never sees this HTML, only what the browser posts. The reply is a 303, so a refresh on the
thank-you page cannot submit twice.

The name must match `[a-z0-9][a-z0-9_-]{0,39}`; anything else, including a bare `harvis-form`,
collects under `default`. The `newsletter` form here has no redirect, which is what the branded
thank-you page at `/__harvis/form/thanks` is for.

Limits worth knowing: 64 KB per submission, 30 fields, 60 submissions per hour per site, 1,000
stored (oldest pruned). File inputs are dropped. A form mounted at runtime by a framework has no
`<form>` in the served HTML for the rewrite to find — those write the endpoint themselves, see
[harvis.dev/forms](https://harvis.dev/forms).

## Why an API key instead of a deploy token

[`harvis-io/static-deploy-action`](https://github.com/harvis-io/static-deploy-action) takes a
deploy token: scoped to one site, able to do exactly one thing to it — replace its files. That is
the right credential for a build that only publishes, and it is what
[`github-action-example/`](../github-action-example/) uses. It also means the site has to exist,
and be claimed by hand, before CI can name it.

An account key (`hvs_` + 32 random bytes, from
[/dashboard/keys](https://harvis.dev/dashboard/keys)) is the account. This workflow uses that for
three things a deploy token cannot do:

1. **Create the site on the first run.** `POST /api/v1/sites` with a key produces a site owned by
   the account from the first byte — no claim link, no 24-hour expiry.
2. **Keep the address.** The site is found by its subdomain on each run, so the workflow stores no
   site id and the first run `PATCH`es the random address to the one it wants.
3. **Read the inbox.** The summary step reports how many submissions the site holds. Same
   credential, no second secret.

The trade is scope: a leaked key is the whole account, including every other site on it. A
repository that only publishes should prefer the deploy token.

## Setup

1. Create a key at [harvis.dev/dashboard/keys](https://harvis.dev/dashboard/keys). It is shown
   once — the row keeps only a SHA-256 digest.
2. Add it as the secret `HARVIS_API_KEY` under **Settings → Secrets and variables → Actions**.
3. Optionally set the repository variable `HARVIS_SUBDOMAIN`. Addresses are unique across the
   whole service, so the default `harvis-forms-example` may already be taken — if the first run
   fails with `subdomainTaken`, pick another.

Without the secret the run fails immediately, with the name of the variable to set. That is
deliberate: unlike an anonymous deploy there is no useful thing to do with no credential here.

## Run it yourself

```bash
HARVIS_API_KEY=hvs_… HARVIS_SUBDOMAIN=my-forms-demo ./deploy.sh public
```

The script prints the live URL. Nothing about it is CI-specific — the only thing it does
differently under Actions is append `url`, `subdomain` and `site-id` to `$GITHUB_OUTPUT`.

Read the inbox with the same key:

```bash
curl -sS -H "Authorization: Bearer $HARVIS_API_KEY" \
  "https://harvis.dev/api/v1/sites/$SITE_ID/submissions?form=contact" | jq
```

## Preview locally

```bash
python3 -m http.server -d public 8000
```

The page renders, but **the forms do not work locally**: the rewrite happens in harvis's HTML
response, so on a local server the marked forms have no `action` and post to the page itself.
Deploy to try a submission.

## Notes

- `deploy.sh` replaces the site's whole file list — a path absent from the upload is deleted from
  storage. Submissions belong to the site rather than to the deploy, so they survive a redeploy.
- If the first run creates the site but cannot take the subdomain, it deletes the site it just
  created and exits non-zero. Otherwise every retry would leave another site behind on the account.
- A local `harvis` CLI run writes a `harvis.json` here naming the site it deployed to. It is
  gitignored, and `deploy.sh` ignores it — the subdomain in the workflow is what decides.
