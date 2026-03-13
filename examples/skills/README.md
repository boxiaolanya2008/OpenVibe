# Skills Examples

This directory contains example skills demonstrating the Agent Skills standard.

## What are Skills?

Skills are self-contained capability packages that the agent loads on-demand. Each skill provides:
- Specialized workflows and instructions
- Best practices for specific tasks
- Reference documentation and checklists

## Directory Structure

```
skill-name/
├── SKILL.md           # Required: skill definition with frontmatter
├── scripts/           # Optional: helper scripts
├── references/        # Optional: detailed documentation
└── templates/         # Optional: file templates
```

## Included Examples

| Skill | Description |
|-------|-------------|
| `code-review` | Code review workflow with checklists and best practices |
| `api-design` | RESTful API design guidelines and conventions |
| `testing` | Testing strategies and patterns |
| `git-workflow` | Git workflow and commit conventions |

## Usage

### In OpenVibe

Skills are auto-discovered from multiple directories:

**Global Skills (优先级从高到低):**
- `~/.openvibe/skills/` - OpenVibe 全局技能
- `~/.agents/skills/` - Agent Skills 标准位置
- `~/.claude/skills/` - Claude 技能目录 (兼容)
- `~/.codex/skills/` - OpenAI Codex 技能 (兼容)

**Project-level Skills:**
- `.openvibe/skills/` - 项目技能
- `.agents/skills/` - 项目 Agent Skills 标准位置
- `.claude/skills/` - 项目 Claude 技能目录

**CLI:**
```bash
openvibe --skill ./path/to/skill
```

### Skill Commands

```bash
# List and select skills interactively
/skills

# Invoke a specific skill directly
/skill:code-review

# Invoke skill with arguments
/skill:code-review src/main.ts
```

### Creating a Skill

1. Create a directory with your skill name
2. Add `SKILL.md` with frontmatter:

```markdown
---
name: my-skill
description: What this skill does and when to use it
---

# My Skill

Instructions and guidelines here...
```

## Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Skill name (lowercase, hyphens only, matches directory) |
| `description` | Yes | What the skill does and when to use it |
| `disable-model-invocation` | No | If true, skill won't appear in system prompt |

## Resources

- [Skills Documentation](../../docs/skills.md)
- [Agent Skills Specification](https://agentskills.io/specification)
