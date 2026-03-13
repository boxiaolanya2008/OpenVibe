---
name: code-review
description: Comprehensive code review workflow with checklists and best practices. Use when reviewing pull requests, code changes, or conducting code audits.
---

# Code Review Skill

A systematic approach to code review that ensures quality, maintainability, and security.

## Review Checklist

### Functionality
- Does the code do what it's supposed to do?
- Are edge cases handled properly?
- Are there any logic errors or bugs?
- Is error handling comprehensive?

### Code Quality
- Is the code readable and well-organized?
- Are variable and function names descriptive?
- Is there appropriate code documentation?
- Are functions small and focused (single responsibility)?
- Is there code duplication that should be refactored?

### Performance
- Are there any obvious performance issues?
- Are database queries optimized?
- Are there unnecessary loops or computations?
- Is caching used appropriately?

### Security
- Are user inputs validated and sanitized?
- Are there any SQL injection or XSS vulnerabilities?
- Are sensitive data properly encrypted?
- Are API keys and secrets properly managed?

### Testing
- Are there unit tests for new functionality?
- Do existing tests still pass?
- Are test cases covering edge cases?
- Is the test coverage adequate?

## Review Process

### 1. Understand the Context
Use `git diff` or read the relevant files to understand what changed.

### 2. Analyze the Changes
- Review each file systematically
- Focus on logic changes, not just formatting
- Look for patterns across multiple files

### 3. Provide Feedback
Use constructive feedback format:
```
**[Category]** Issue description
- Why it matters
- Suggested fix
```

### 4. Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| 🔴 Critical | Security vulnerability, data loss risk | Must fix before merge |
| 🟠 High | Bug, breaking change, significant issue | Should fix before merge |
| 🟡 Medium | Code quality, maintainability | Recommend fix |
| 🟢 Low | Minor suggestions, style improvements | Optional |
