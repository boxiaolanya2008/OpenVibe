# OpenVibe

[**中文文档**](./README_CN.md) | English

OpenVibe is a professional AI coding assistant that provides intelligent code editing, file management, and project collaboration features for developers.

## Installation

```bash
npm install -g openvibe
```

## Quick Start

### Initial Configuration

After running OpenVibe, the system will guide you through the initial setup:

```bash
openvibe
```

You will need to provide:
- **API URL**: Your AI service endpoint address
- **API Key**: The key to access the AI service
- **Model Name**: The AI model name to use

### Basic Usage

```bash
# Start an interactive session
openvibe

# Execute a command directly
openvibe "Analyze the code structure of the current project"

# Process files
openvibe -f src/main.ts "Optimize this code"
```

## Core Features

### Built-in Tools

OpenVibe includes the following built-in tools:

| Tool | Description |
|------|-------------|
| `read` | Read file contents (supports text and images) |
| `write` | Write content to files (creates or overwrites) |
| `edit` | Edit files with precise text replacement |
| `bash` | Execute shell commands |
| `grep` | Search file contents with regex support |
| `find` | Find files by name pattern |
| `ls` | List directory contents |
| `truncate` | Truncate large outputs |

### Slash Commands

OpenVibe provides powerful slash commands for session management:

| Command | Description |
|---------|-------------|
| `/settings` | Open settings menu |
| `/export` | Export session to HTML file |
| `/share` | Share session as a secret GitHub gist |
| `/copy` | Copy last agent message to clipboard |
| `/name` | Set session display name |
| `/session` | Show session info and stats |
| `/changelog` | Show changelog entries |
| `/hotkeys` | Show all keyboard shortcuts |
| `/fork` | Create a new fork from a previous message |
| `/tree` | Navigate session tree (switch branches) |
| `/new` | Start a new session |
| `/compact` | Manually compact the session context |
| `/resume` | Resume a different session |
| `/reload` | Reload extensions, skills, prompts, and themes |
| `/skills` | Browse and invoke available skills |
| `/think` | Set thinking level (off/minimal/low/medium/high/xhigh) |
| `/quit` | Quit OpenVibe |

### Session Management

- **Auto-save**: Sessions are automatically saved in JSONL format
- **Resume**: Continue previous conversations anytime
- **Fork**: Create branches from any point in the conversation
- **Tree Navigation**: Navigate and switch between conversation branches
- **History**: View and manage all historical sessions

### Context Compaction

Automatically compresses conversation history to save tokens:
- **Auto-compaction**: Triggers when context overflows
- **Manual compaction**: Use `/compact` command
- **Smart summarization**: Preserves important information
- **Token budget management**: Configurable reserve and keep tokens

### Skills System

Skills are specialized knowledge files that provide expert guidance:
- Load domain-specific expertise
- Support for user, project, and path-scoped skills
- Markdown format with frontmatter
- Compatible with Claude skills directory

**Supported Skill Directories:**

| Location | Type | Priority |
|----------|------|----------|
| `~/.openvibe/skills/` | Global | High |
| `~/.agents/skills/` | Global (Agent Skills standard) | Medium |
| `~/.claude/skills/` | Global (Claude compatible) | Medium |
| `~/.codex/skills/` | Global (Codex compatible) | Medium |
| `.openvibe/skills/` | Project | High |
| `.agents/skills/` | Project | Medium |
| `.claude/skills/` | Project | Medium |

**Usage:**
```bash
# List and select skills interactively
/skills

# Invoke a specific skill directly
/skill:code-review
```

### Prompt Templates

Create reusable prompt templates:
- User and project-scoped templates
- Argument substitution support (`$1`, `$2`, `$ARGUMENTS`)
- Markdown format with description frontmatter
- Quick access via `/template-name` syntax

### Extension System

Build powerful TypeScript extensions:

```typescript
import { defineExtension } from 'openvibe';

export default defineExtension({
  name: 'my-extension',
  setup({ onMessage, registerTool, registerCommand }) {
    // Subscribe to messages
    onMessage((message) => {
      console.log('Received:', message);
    });
    
    // Register custom tools
    registerTool({
      name: 'myTool',
      description: 'A custom tool',
      parameters: { ... },
      handler: async (args) => { ... }
    });
    
    // Register commands
    registerCommand({
      name: 'myCommand',
      description: 'A custom command',
      handler: async (args) => { ... }
    });
  }
});
```

Extension capabilities:
- Register LLM-callable tools
- Register slash commands and keyboard shortcuts
- Create custom UI components
- Subscribe to agent lifecycle events
- Access session and model information

### Theme System

Customize the appearance:
- Built-in dark and light themes
- Custom theme support via JSON files
- Export colors for HTML generation
- Dynamic theme switching

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Interrupt current operation |
| `Ctrl+C` | Clear input / Cancel |
| `Ctrl+D` | Exit |
| `Ctrl+Z` | Suspend |
| `Shift+Tab` | Cycle thinking level |
| `Ctrl+P` | Cycle model forward |
| `Ctrl+L` | Model selector |
| `Ctrl+O` | Expand/collapse tools |
| `Ctrl+T` | Toggle thinking block |
| `Ctrl+G` | Open external editor |
| `Alt+Enter` | Queue follow-up message |
| `Ctrl+V` | Paste image from clipboard |

### HTML Export

Export sessions to standalone HTML files:
- Full conversation history with syntax highlighting
- Tool execution details
- Customizable themes
- Share via GitHub Gist

### Additional Features

- **1M Context Window**: Full support for 1 million token context window via provider configuration
- **Multi-GPU Support**: Distribute workloads across GPUs
- **Auto Retry**: Automatic retry on API failures with configurable delays
- **Image Support**: Paste and process images from clipboard
- **Git Integration**: Display current branch in status bar
- **RPC Mode**: Remote procedure call support for integration
- **Onboarding Wizard**: Guided initial setup
- **Response Acceleration**: Streaming optimizations for faster responses

## Configuration

Configuration file located at `~/.openvibe/config.json`:

```json
{
  "apiUrl": "https://api.example.com/v1/chat/completions",
  "apiKey": "your-api-key",
  "model": "your-model-name"
}
```

### Settings

Global and project-level settings in `~/.openvibe/settings.json`:

```json
{
  "theme": "dark",
  "defaultThinkingLevel": "medium",
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "retry": {
    "enabled": true,
    "maxRetries": 3
  },
  "enableSkillCommands": true
}
```

### 1M Context Window Configuration

OpenVibe supports models with 1 million token context window through an independent **Context Architecture**:

```typescript
// Using the Context Architecture API
import { 
  getContextProviderRegistry, 
  enhanceModelContext,
  LargeContextProvider 
} from 'openvibe';

// Enhance any model with large context
const enhancedModel = enhanceModelContext(model);

// Or register a custom model with 1M context
const provider = new LargeContextProvider();
provider.registerCustomModel('my-custom-model', {
  contextWindow: 1000000,
  maxTokens: 65536,
  supportsVision: true
});
```

**Supported Models with 1M Context:**
- Google Gemini 1.5 Pro/Flash
- Google Gemini 2.0 Flash/Pro
- Alibaba Qwen-Max
- Moonshot Kimi (128K)

**Architecture Components:**
- `IContextProvider` - Interface for custom context providers
- `LargeContextProvider` - Built-in provider with 50+ model definitions
- `ContextProviderRegistry` - Central registry for managing providers
- `ContextManager` - Configuration-based alternative API
```

## Command Line Options

```
Usage: openvibe [options] [prompt]

Options:
  -f, --file <path>       Include file path
  -c, --context <path>    Add context file/directory
  --no-onboarding         Skip onboarding configuration
  -h, --help              Display help information
  -v, --version           Display version number
```

## Documentation

- [Extension Development Guide](docs/extensions.md)
- [SDK Documentation](docs/sdk.md)
- [Theme Customization](docs/themes.md)
- [Keybinding Configuration](docs/keybindings.md)
- [Skills System](docs/skills.md)
- [Prompt Templates](docs/prompt-templates.md)
- [Session Management](docs/session.md)
- [Context Compaction](docs/compaction.md)
- [Custom Providers](docs/custom-provider.md)
- [TUI Components](docs/tui.md)
- [RPC Integration](docs/rpc.md)

## System Requirements

- Node.js >= 18.0.0
- npm >= 9.0.0

## License

MIT

## Links

- [npm Package](https://www.npmjs.com/package/openvibe)
- [Issue Tracker](https://github.com/boxiaolanya2008/openvibe/issues)
