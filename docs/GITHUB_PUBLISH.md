# Publishing Taskflow to GitHub

**GitHub account:** `ashutoshcy`  
**Suggested repository:** `taskflow-task-manager`

## Publish through a connected GitHub integration

1. Open <https://github.com/new> while signed in to `ashutoshcy`.
2. Name the repository `taskflow-task-manager` and select **Public**.
3. Check **Add a README file** to give the repository an initial `main` branch, then create it.
4. Return to the ChatGPT conversation where GitHub is connected and ask to publish the prepared Taskflow files to the new repository.
5. Check the repository's **Actions** tab and confirm the automated tests pass.

The GitHub integration cannot create repositories in this environment, but it can write files to a repository once the repository exists and the connection has write access.

## Alternative: upload from your terminal

If you prefer to push with Git, create an **empty** GitHub repository instead (do **not** pre-create a README, `.gitignore`, or license). They already exist in the project.

In the extracted project directory:

```bash
git init -b main
git add .
git commit -m "Build Taskflow dashboard and REST API"
git remote add origin https://github.com/ashutoshcy/taskflow-task-manager.git
git push -u origin main
```

Use your own Git author identity. GitHub may ask for browser-based sign-in or a configured credential manager. Don't share passwords or access tokens in chat.

## Before you share the repository

- Confirm `README.md` displays the screenshots from `docs/screenshots/`.
- Make sure `.env`, `.venv/`, `tasks.db`, caches and other local data are **not** tracked. The supplied `.gitignore` excludes these.
- Check that both the Python and JavaScript GitHub Actions jobs pass.
- Be clear that the current version is a **local single-user project without authentication**. Do not deploy it as a publicly writable task service.

Keep the commit message and README accurate to what is actually present in the repository. There is no need to invent development history or claim features that have not been built.
