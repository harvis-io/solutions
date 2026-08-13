# harvis.solutions

Self-contained examples of deploying to [harvis.dev](https://harvis.dev). Each example lives in
its own top-level folder with its own README, and — where it deploys — its own workflow in
`.github/workflows/<example-name>.yml` that only triggers on changes to that folder.

| Example | What it shows |
| --- | --- |
| [`github-action-example/`](github-action-example/) | A static site rebuilt on a daily cron and deployed with [harvis-io/static-deploy-action](https://github.com/harvis-io/static-deploy-action) |
| [`forms-example/`](forms-example/) | A static site with real contact forms (`harvis-form`), deployed by curl with an account `HARVIS_API_KEY` instead of a site deploy token |

## Adding an example

1. Create a folder named after the example.
2. Add a `README.md` explaining what it demonstrates and how to run it locally.
3. If it deploys, copy `.github/workflows/github-action-example.yml`, then update the workflow
   name, the `paths` filter, the `concurrency` group, `defaults.run.working-directory`, and the
   action's `directory` input (workspace-relative) to point at the new folder.

## Which credential

Two secrets appear in these workflows, and they are not interchangeable. `HARVIS_DEPLOY_TOKEN` is
scoped to one site and can only replace its files — the right thing for a repository that just
publishes. `HARVIS_API_KEY` is the account: it can create the site, take an address, and read what
the site's forms collected, at the cost of being worth much more if it leaks. See
[`forms-example/`](forms-example/) for the comparison in full.
