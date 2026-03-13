# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.61.0] - 2025-03-13

### Added

- **Update Check**: Added automatic version check from npm registry on startup
  - Checks for new versions without requiring a remote server
  - Caches results for 24 hours to avoid frequent requests
  - Shows update notification when a newer version is available
  - Can be skipped with `--offline` flag or `PI_SKIP_VERSION_CHECK` env variable

### Changed

- **Skills Loading**: Changed to priority-based fallback system
  - Checks skill directories in priority order
  - Stops checking once skills are found in a higher priority directory
  - Allows overriding default skills by placing them in higher priority directories

### Fixed

- Fixed CI failures: resolved biome lint errors and TypeScript compilation issues
- Fixed vitest configuration: added `passWithNoTests: true` to prevent test failures when no test files exist
- Removed unused imports and variables across multiple files
- Fixed TypeScript errors in `footer.ts` and `onboarding-wizard.ts`

---

## [0.60.0] - 2025-03-13

### Added

- **Skills Command**: New `/skills` command for interactive skill selection and invocation
- **Multi-path Skills Loading**: Skills are now loaded from multiple directories with priority:
  - Global: `~/.openvibe/skills/`, `~/.agents/skills/`, `~/.claude/skills/`, `~/.codex/skills/`
  - Project: `.openvibe/skills/`, `.agents/skills/`, `.claude/skills/`
- **Example Skills**: Added 4 example skills in `examples/skills/`:
  - `code-review` - Code review workflow with checklists
  - `api-design` - RESTful API design guidelines
  - `testing` - Testing strategies and patterns
  - `git-workflow` - Git workflow and commit conventions
- **Bilingual Documentation**: README now available in both English (`README.md`) and Chinese (`README_CN.md`)
- **Context Architecture**: New third-party architecture for large context support:
  - Independent module `context-architecture.ts` for managing context windows
  - `IContextProvider` interface for implementing custom context providers
  - `LargeContextProvider` with built-in support for 50+ models
  - `ContextProviderRegistry` for managing multiple providers
  - `ContextManager` for configuration-based context management
  - Full 1M token context window support for compatible models
- **Enhanced System Prompt**: New creative system prompt with XML-based configuration

### Changed

- Improved skills system with better compatibility across AI tools (Claude, Codex, Agent Skills standard)
- History skills from compaction now saved to `.history-skill/` hidden directory
- Optimized context management for large context window models
- Context window configuration moved from prompt to independent architecture

### Removed

- Removed "Update Available" notification feature
- Removed redundant `tsconfig.examples.json` configuration file
- Removed model configuration from system prompt (now handled by Context Architecture)

### Fixed

- Code cleanup and optimization

---

## [0.59.0] - 2025-03-09

### Added

- Initial release of OpenVibe AI Coding Assistant
- Core features:
  - Intelligent code editing with AI assistance
  - Built-in tools: read, write, edit, bash, grep, find, ls
  - Session management with auto-save and resume
  - Extension system for custom tools and commands
  - Theme system with dark and light modes
  - Context compaction for token management
  - HTML export for session sharing
  - Multi-GPU support
  - Auto-retry on API failures
  - Image support from clipboard
  - Git integration
  - RPC mode for integrations

---

[0.60.0]: https://github.com/boxiaolanya2008/openvibe/compare/v0.59.0...v0.60.0
[0.59.0]: https://github.com/boxiaolanya2008/openvibe/releases/tag/v0.59.0
