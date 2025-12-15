# Temple Run Mini Clone

A lightweight, single-page Temple Run–style endless runner built with HTML5 canvas and vanilla JavaScript. The runner auto-sprints down three lanes while you dodge obstacles and grab coins.

## How to play
- Open `index.html` in a modern browser.
- The runner starts moving immediately.
- Controls: Left/Right (or A/D) to change lanes, Up/W/Space to jump, R to restart after a crash. On touch devices, swipe left/right to switch lanes and swipe up to jump; tap after a crash to restart.
- Avoid obstacles, collect coins, and survive as long as possible to push your score higher.

## Development notes
- No build tools or dependencies are required; everything lives in `index.html`.
- The canvas resizes with the window so it can run in desktop or mobile browsers.
- If you want a quick local run, open `index.html` directly or use a static file server such as `python3 -m http.server 8000` and visit `http://localhost:8000`.

## Deployment (GitHub Pages)
This project is a single static file, so deploying to GitHub Pages takes just a few steps:

1. **Resolve merge conflicts locally** (if GitHub shows conflicts on your branch):
   - `git fetch origin`
   - `git checkout main` (or `master` if that is your default branch)
   - `git pull`
   - `git checkout work` (replace with your feature branch name)
   - `git rebase origin/main` (or `git merge origin/main`)
   - Fix any reported conflicts in `README.md` or `index.html`, then `git add` and `git rebase --continue` (or `git commit` if you merged).
   - `git push --force-with-lease` if you rebased, or `git push` if you merged.
2. **Merge into your default branch** after conflicts are cleared (e.g., open the PR on GitHub and use the “Merge pull request” button).
3. **Enable Pages** in your repo settings: Settings → Pages → Source: “Deploy from a branch” → branch `main` (root). Save.
4. Wait for GitHub to publish, then open the provided Pages URL to play.

If you host elsewhere (Netlify, Vercel, Firebase, S3, etc.), point the host at the repository root so it serves `index.html` as the entry point.
