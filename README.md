# Nawras Wordle

A Vite game with vanilla JavaScript, HTML, and CSS. The Nawras branding, gameplay,
24 supplied answers, offline English dictionary, and local leaderboard are included.

## Run locally

Use Node.js 24 (also specified in `.nvmrc`).

```sh
npm ci
npm run dev
```

Open the URL printed by Vite.

## Test, build, and preview

```sh
npm test
npm run build
npm run preview
```

For browser checks, use an installed Chrome browser, or install Playwright Chromium
and set `CHROME_CHANNEL=chromium` in your shell:

```sh
npx playwright install chromium
npm run test:browser
npm run test:pages
```

`test:browser` checks gameplay and leaderboard behavior; build first.
`test:pages` builds and tests both `/repository-check/` and `/` on a strict static
server, including branding, offline guesses, a complete round, navigation,
refreshes, and saved results. Its temporary builds are in ignored `.checks/`.
CI installs Chromium automatically. `CHROME_PATH` can override the browser executable.

## Create the GitHub repository and push

Create an empty repository on GitHub, without adding a README or other starter files.
A repository named `YOUR-USERNAME.github.io` hosts at `/`; any other name hosts at
`/REPOSITORY-NAME/`. Run these commands from this project folder, replacing the
repository URL with your own:

```sh
git init
git add .
git commit -m "Prepare Nawras Wordle for GitHub Pages"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/REPOSITORY-NAME.git
git push -u origin main
```

Include `package-lock.json`, source files, assets, tests, Vite config, and
`.github/workflows/deploy.yml`. Generated builds, dependencies, local environment
files, and editor clutter are ignored.

## Deploy manually when ready

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open **Actions → Deploy Nawras Wordle to Pages → Run workflow**.
4. Select `main`, then click **Run workflow**.
5. After it succeeds, open the URL shown by the `github-pages` deployment.

The workflow uses Node 24, `npm ci`, tests, builds, and the official Pages artifact
upload/deployment actions. It runs **only** through `workflow_dispatch`; pushing
commits does not deploy. Keep the workflow on the default branch so the manual
Run workflow control is available.

Vite derives the base from `GITHUB_REPOSITORY` (`owner/repository`). During deployment,
`actions/configure-pages` supplies `PAGES_BASE_PATH` so repository, root, and custom
domain sites use their actual path. Nothing needs a hardcoded repository name.
Logo/favicon URLs use Vite's base, and the dictionary is bundled in JavaScript.
Screens switch without changing the URL, so refreshing does not request a game or
leaderboard route that is missing on static hosting.

To preview a repository path yourself:

```sh
npm run build -- --base=/repository-check/
npm run preview -- --base=/repository-check/
```

Visit the printed origin followed by `/repository-check/`. Run a normal build again
for root previews. See [Vite's Pages guide](https://vite.dev/guide/static-deploy.html#github-pages)
and [GitHub's workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Leaderboard storage

Results use localStorage under `nawras-wordle.results.v1`. They are specific to the
browser profile and site origin (protocol, host, and port), and are **not shared
across devices**. Existing localhost scores will **not** automatically appear on
GitHub Pages. Changing domains or protocols also gives the site different storage;
paths on the same origin share storage. Clearing browser site data clears results.

Each completed attempt saves once by unique ID, preserving original milliseconds.
Ranking uses guesses, then rounded whole seconds; tied scores share competition
ranks. Abandoned rounds are not saved. Invalid stored data is handled safely.
Preparing or building the project does not change existing browser scores.

Dictionary source and license are preserved in `src/data/`.
