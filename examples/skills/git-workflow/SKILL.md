---
name: git-workflow
description: Git workflow and commit conventions for clean version control history. Use when committing changes or managing branches.
---

# Git Workflow Skill

Best practices for using Git effectively in team environments.

## Branch Strategy

### Main Branches
- `main` - Production-ready code
- `develop` - Integration branch for features

### Feature Branches
- Create from: `develop`
- Merge into: `develop`
- Naming: `feature/description` or `feature/ticket-id-description`

### Bugfix Branches
- Create from: `develop`
- Merge into: `develop`
- Naming: `bugfix/description`

### Hotfix Branches
- Create from: `main`
- Merge into: `main` and `develop`
- Naming: `hotfix/description`

## Commit Message Format

### Structure
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting) |
| `refactor` | Code refactoring |
| `test` | Adding/updating tests |
| `chore` | Build/config changes |

### Examples
```
feat(auth): add OAuth2 login support

- Implement Google OAuth provider
- Add login button component
- Update user model for OAuth IDs

Closes #123
```

```
fix(api): handle null response in user endpoint

The endpoint was crashing when user not found.
Now returns proper 404 response.

Fixes #456
```

## Workflow Commands

### Starting New Work
```bash
git checkout develop
git pull origin develop
git checkout -b feature/new-feature
```

### Committing Changes
```bash
git add .
git commit -m "feat(module): add new feature"
```

### Pushing and Creating PR
```bash
git push origin feature/new-feature
# Create pull request via GitHub/GitLab
```

### After Merge
```bash
git checkout develop
git pull origin develop
git branch -d feature/new-feature
```

## Best Practices

- Commit related changes together
- Write clear commit messages
- Pull before pushing
- Review your changes before committing
- Never commit directly to `main`
- Keep branches small and focused
