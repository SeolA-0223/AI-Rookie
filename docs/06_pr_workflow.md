# PR Workflow

## Branch Strategy
- `main`: release-ready branch
- `feat/*`: feature changes
- `fix/*`: bug fixes
- `chore/*`: non-feature maintenance

## Daily Flow
1. `git switch main`
2. `git pull origin main`
3. `git switch -c feat/<short-task-name>`
4. Implement and test locally
5. `git add . && git commit -m "feat: <message>"`
6. `git push -u origin feat/<short-task-name>`
7. Create PR to `main`

## PR Rule
- Keep PR small and single-purpose
- CI `test` check must pass
- At least 1 approval before merge
- Prefer squash merge

## Local Guardrails
- Install hooks once: `npm run hooks:install`
- `pre-commit`: refreshes `docs/09_handover_status.txt` automatically
- `pre-push`: blocks direct push to `main` by default
- One-time override for emergency push:
  - PowerShell: `$env:ALLOW_MAIN_PUSH=1; git push origin main`

## Commands
```bash
gh pr create --base main --head <branch> --fill
gh pr checks <pr-number>
gh pr merge <pr-number> --squash --delete-branch
```

If `gh` is unavailable, open PR directly:
```text
https://github.com/<owner>/<repo>/pull/new/<branch>
```

