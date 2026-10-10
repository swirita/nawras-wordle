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

`test:browser` checks gameplay, hints, retries, and leaderboard behavior; build first.
`test:pages` builds and tests both `/repository-check/` and `/` on a strict static
server, including branding, offline guesses, a complete round, navigation,
refreshes, and saved results. Its temporary builds are in ignored `.checks/`.
CI installs Chromium automatically. `CHROME_PATH` can override the browser executable.

## Game rules

Press **F** to enter or exit fullscreen, or use the **Fullscreen (F)** button.
Escape also exits fullscreen. The shortcut is ignored while entering your name.
During a round, enter the letter F with **Shift+F** or the on-screen F key.

Each round has one five-letter answer and six valid guesses. Invalid words do not
consume a guess. Green means the correct position, yellow means an occurrence in
another position, and gray means no remaining occurrence. Keyboard feedback keeps
the strongest evidence. The timer starts with the ready board and stops at final
submission, before tile animations; background time still counts.

## Deploy to GitHub Pages

Repository: [swirita/nawras-wordle](https://github.com/swirita/nawras-wordle).
Pages URL: [Nawras Wordle](https://swirita.github.io/nawras-wordle/).

In **Settings → Pages**, keep **Source** set to **GitHub Actions**. Push reviewed
changes to the default branch, `main`, to run tests, build, and deploy:

```sh
git add <changed-project-files>
git commit -m "Update Nawras Wordle"
git push -u origin main
```

Include `package-lock.json`, source files, assets, tests, Vite config, and
`.github/workflows/deploy.yml`. Generated builds, dependencies, local environment
files, and editor clutter are ignored.

You can also open **Actions → Deploy Nawras Wordle to Pages → Run workflow**,
select `main`, and run it manually. Inspect the workflow's tests and deployment
status, then open the URL shown by the `github-pages` deployment.

The workflow uses Node 24, `npm ci`, tests, builds, and the official Pages artifact
upload/deployment actions. It runs on pushes to `main` and `workflow_dispatch`.
Deployments are serialized and use the `github-pages` environment. Keep the
workflow on the default branch so the manual Run workflow control is available.

Vite derives the base from `GITHUB_REPOSITORY` (`owner/repository`). During deployment,
`actions/configure-pages` supplies `PAGES_BASE_PATH` so repository, root, and custom
domain sites use their actual path. Nothing needs a hardcoded repository name.
Logo/favicon URLs use Vite's base, and the dictionary is bundled in JavaScript.
Screens switch without changing the URL, so refreshing does not request a game or
leaderboard route that is missing on static hosting.

To preview a repository path yourself:

```sh
npm run build -- --base=/nawras-wordle/
npm run preview -- --base=/nawras-wordle/
```

Visit the printed origin followed by `/nawras-wordle/`. Run a normal build again
for root previews. See [Vite's Pages guide](https://vite.dev/guide/static-deploy.html#github-pages)
and [GitHub's workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Leaderboard storage

Results use localStorage under `nawras-wordle.results.v1`. They are specific to the
browser profile and site origin (protocol, host, and port), and are **not shared
across devices**. Existing localhost scores will **not** automatically appear on
GitHub Pages. Changing domains or protocols also gives the site different storage;
paths on the same origin share storage. Clearing browser site data clears results.
The leaderboard's Clear Leaderboard button asks for confirmation, then removes
all saved game results from this browser without clearing other site data.

Each completed round (a full try, not an individual guess) saves once by unique
ID, including retries and repeated player names, preserving original milliseconds.
Ranking uses guesses, then rounded whole seconds; tied scores share competition
ranks. All solved rounds receive ranks and top-five highlights, including rounds
with hints. Using a hint adds an Assisted badge beside the player name in both
leaderboard views, without a score penalty. Unsuccessful rounds show Not solved.
Results save `hintsUsed`, keeping the badge after refresh. Existing records and
known hint usage are retained; older records without hint data default to zero.

Hint reveals up to three individual positions in a separate strip, skipping
positions already hinted or green. It consumes no guess and leaves the timer
running; submitting the answer is still required to win. Every new round randomly
selects a unique answer using cryptographic randomness, excluding the immediately
previous answer. Names and leaderboard data never determine answers. Retry keeps
the name and selects a fresh answer and category while resetting the board, hints,
keyboard, timer, and result state. Active
rounds ask for confirmation. Completed
results are preserved. Next Player returns to the landing page.

Abandoned rounds are not saved. Invalid stored data is handled safely.
If stored data cannot be read or a save fails, the completed result remains in
memory and the game reports that it could not be saved. Unreadable data is
preserved rather than overwritten; clearing results requires explicit confirmation.
Preparing or building the project does not change existing browser scores.

Dictionary source and license are preserved in `src/data/`.
