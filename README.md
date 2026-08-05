# harvis.solutions

Self-contained examples of deploying to [harvis.dev](https://harvis.dev). Each example lives in
its own top-level folder with its own README, and — where it deploys — its own workflow in
`.github/workflows/<example-name>.yml` that only triggers on changes to that folder.

| Example | What it shows |
| --- | --- |
| [`github-action-example/`](github-action-example/) | A static site rebuilt on a daily cron and deployed with [harvis-io/static-deploy-action](https://github.com/harvis-io/static-deploy-action) |

## Adding an example

1. Create a folder named after the example.
2. Add a `README.md` explaining what it demonstrates and how to run it locally.
3. If it deploys, copy `.github/workflows/github-action-example.yml`, then update the workflow
   name, the `paths` filter, the `concurrency` group, `defaults.run.working-directory`, and the
   action's `directory` input (workspace-relative) to point at the new folder.
