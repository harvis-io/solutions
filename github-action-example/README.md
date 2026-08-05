# Daily Jamstack providers

A demo static site that rebuilds itself every day and deploys with
[harvis-io/static-deploy-action](https://github.com/harvis-io/static-deploy-action).

The page lists every provider in the `#### Jamstack` section of
[debarshibasak/awesome-paas](https://github.com/debarshibasak/awesome-paas), parsed from the
README at build time — name, link, `alive`/`defunct` status, and description — plus a summary of
how many are still operating. Because the build runs on a daily schedule, the published page
tracks upstream edits without anyone touching this repo.

## Layout

Paths are relative to this folder, except the workflow, which GitHub only reads from the
repository root.

| Path | Purpose |
| --- | --- |
| `build.js` | Fetches the README, parses the Jamstack section, writes `dist/` |
| `src/styles.css` | Stylesheet, copied into `dist/` verbatim |
| `src/awesome-paas.md` | Last successful fetch — used as a fallback if upstream is unreachable |
| `harvis.json` | Subdomain this example deploys to, recorded by the harvis CLI |
| `../.github/workflows/github-action-example.yml` | Daily cron build + deploy |

No dependencies and no `package.json`; `build.js` uses only Node 18+ built-ins.

## Build locally

From this folder:

```bash
node build.js          # writes dist/
python3 -m http.server -d dist 8000
```

If the fetch fails three times, the build falls back to the committed copy of the README rather
than publishing an empty list. It only exits non-zero when there is no cache either, or when the
section parses to zero entries — so a change in upstream formatting fails the deploy loudly
instead of silently shipping a blank page.

## Deploying

The workflow runs on a `15 6 * * *` cron, on pushes to `main` that touch this folder or the
workflow itself, and via **Run workflow**. It builds with `defaults.run.working-directory:
github-action-example`; the action's `directory` input is workspace-relative, so it stays
`github-action-example/dist`.

**First run — no configuration needed.** With no `site`/`token`, the action creates a fresh
unclaimed site that expires after 24 hours. The run summary shows the URL and a single-use
claim link.

**To keep deploying to the same subdomain:**

1. Claim the site via the link in the run summary, then copy its deploy token from the
   harvis.dev dashboard.
2. In this repo: **Settings → Secrets and variables → Actions**
   - Secret `HARVIS_DEPLOY_TOKEN` — the deploy token
   - Variable `HARVIS_SITE` — the subdomain, e.g. `happy-panda-482`

Until those exist the inputs resolve to empty strings, which is exactly the unclaimed-site
behaviour above — so the workflow is valid either way.

Note that scheduled workflows are disabled automatically after 60 days without repository
activity, and GitHub may delay cron runs during busy periods.
