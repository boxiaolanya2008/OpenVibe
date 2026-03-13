# OpenVibe

English | [**中文文档**](./README_CN.md)

OpenVibe 是一个专业的 AI 编程助手，为开发者提供智能的代码编辑、文件管理和项目协作功能。

## 安装

```bash
npm install -g openvibe
```

## 快速开始

### 首次配置

运行 OpenVibe 后，系统将引导你完成初始配置：

```bash
openvibe
```

你需要提供：
- **API 地址**: 你的 AI 服务接口地址
- **API 密钥**: 访问 AI 服务的密钥
- **模型名称**: 使用的 AI 模型名称

### 基本用法

```bash
# 启动交互式会话
openvibe

# 直接执行指令
openvibe "分析当前项目的代码结构"

# 处理文件
openvibe -f src/main.ts "优化这段代码"
```

## 核心功能

### 内置工具

OpenVibe 内置以下工具：

| 工具 | 描述 |
|------|------|
| `read` | 读取文件内容（支持文本和图片） |
| `write` | 写入文件内容（创建或覆盖） |
| `edit` | 编辑文件（精确文本替换） |
| `bash` | 执行 shell 命令 |
| `grep` | 搜索文件内容（支持正则表达式） |
| `find` | 按名称模式查找文件 |
| `ls` | 列出目录内容 |
| `truncate` | 截断大型输出 |

### 斜杠命令

OpenVibe 提供强大的斜杠命令用于会话管理：

| 命令 | 描述 |
|------|------|
| `/settings` | 打开设置菜单 |
| `/export` | 导出会话为 HTML 文件 |
| `/share` | 分享会话为私密 GitHub gist |
| `/copy` | 复制最后的 AI 消息到剪贴板 |
| `/name` | 设置会话显示名称 |
| `/session` | 显示会话信息和统计 |
| `/changelog` | 显示更新日志 |
| `/hotkeys` | 显示所有键盘快捷键 |
| `/fork` | 从历史消息创建新分支 |
| `/tree` | 导航会话树（切换分支） |
| `/new` | 开始新会话 |
| `/compact` | 手动压缩会话上下文 |
| `/resume` | 恢复其他会话 |
| `/reload` | 重载扩展、技能、提示和主题 |
| `/skills` | 浏览和调用可用技能 |
| `/think` | 设置思考级别（off/minimal/low/medium/high/xhigh） |
| `/quit` | 退出 OpenVibe |

### 会话管理

- **自动保存**: 会话以 JSONL 格式自动保存
- **恢复**: 随时继续之前的对话
- **分支**: 从对话任意点创建分支
- **树形导航**: 在对话分支间导航切换
- **历史记录**: 查看和管理所有历史会话

### 上下文压缩

自动压缩对话历史以节省 tokens：
- **自动压缩**: 上下文溢出时自动触发
- **手动压缩**: 使用 `/compact` 命令
- **智能摘要**: 保留重要信息
- **Token 预算管理**: 可配置预留和保留 tokens

### 技能系统

技能是提供专业指导的知识文件：
- 加载领域专业知识
- 支持用户、项目和路径范围的技能
- Markdown 格式带 frontmatter
- 兼容 Claude 技能目录

**支持的技能目录：**

| 位置 | 类型 | 优先级 |
|------|------|--------|
| `~/.openvibe/skills/` | 全局 | 高 |
| `~/.agents/skills/` | 全局 (Agent Skills 标准) | 中 |
| `~/.claude/skills/` | 全局 (Claude 兼容) | 中 |
| `~/.codex/skills/` | 全局 (Codex 兼容) | 中 |
| `.openvibe/skills/` | 项目 | 高 |
| `.agents/skills/` | 项目 | 中 |
| `.claude/skills/` | 项目 | 中 |

**使用方法：**
```bash
# 交互式选择技能
/skills

# 直接调用特定技能
/skill:code-review
```

### 提示模板

创建可重用的提示模板：
- 用户和项目范围的模板
- 支持参数替换（`$1`、`$2`、`$ARGUMENTS`）
- Markdown 格式带描述 frontmatter
- 通过 `/模板名称` 语法快速访问

### 扩展系统

构建强大的 TypeScript 扩展：

```typescript
import { defineExtension } from 'openvibe';

export default defineExtension({
  name: 'my-extension',
  setup({ onMessage, registerTool, registerCommand }) {
    // 订阅消息
    onMessage((message) => {
      console.log('收到:', message);
    });
    
    // 注册自定义工具
    registerTool({
      name: 'myTool',
      description: '一个自定义工具',
      parameters: { ... },
      handler: async (args) => { ... }
    });
    
    // 注册命令
    registerCommand({
      name: 'myCommand',
      description: '一个自定义命令',
      handler: async (args) => { ... }
    });
  }
});
```

扩展功能：
- 注册 LLM 可调用工具
- 注册斜杠命令和键盘快捷键
- 创建自定义 UI 组件
- 订阅代理生命周期事件
- 访问会话和模型信息

### 主题系统

自定义外观：
- 内置深色和浅色主题
- 通过 JSON 文件支持自定义主题
- HTML 导出颜色定制
- 动态主题切换

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Esc` | 中断当前操作 |
| `Ctrl+C` | 清空输入 / 取消 |
| `Ctrl+D` | 退出 |
| `Ctrl+Z` | 挂起 |
| `Shift+Tab` | 切换思考级别 |
| `Ctrl+P` | 向前切换模型 |
| `Ctrl+L` | 模型选择器 |
| `Ctrl+O` | 展开/折叠工具 |
| `Ctrl+T` | 切换思考块 |
| `Ctrl+G` | 打开外部编辑器 |
| `Alt+Enter` | 队列后续消息 |
| `Ctrl+V` | 从剪贴板粘贴图片 |

### HTML 导出

导出会话为独立 HTML 文件：
- 完整对话历史带语法高亮
- 工具执行详情
- 可定制主题
- 通过 GitHub Gist 分享

### 其他功能

- **100万上下文窗口**: 通过提供商配置支持 100 万 token 上下文窗口
- **多 GPU 支持**: 在多 GPU 间分配工作负载
- **自动重试**: API 失败时自动重试，可配置延迟
- **图片支持**: 从剪贴板粘贴和处理图片
- **Git 集成**: 在状态栏显示当前分支
- **RPC 模式**: 远程过程调用支持，便于集成
- **引导向导**: 指导初始设置
- **响应加速**: 流式优化以加快响应速度

## 配置说明

配置文件位于 `~/.openvibe/config.json`：

```json
{
  "apiUrl": "https://api.example.com/v1/chat/completions",
  "apiKey": "your-api-key",
  "model": "your-model-name"
}
```

### 设置

全局和项目级设置在 `~/.openvibe/settings.json`：

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

### 100万上下文窗口配置

OpenVibe 通过独立的 **Context Architecture** 支持百万级上下文：

```typescript
// 使用 Context Architecture API
import { 
  getContextProviderRegistry, 
  enhanceModelContext,
  LargeContextProvider 
} from 'openvibe';

// 增强任意模型的大上下文支持
const enhancedModel = enhanceModelContext(model);

// 或注册自定义模型
const provider = new LargeContextProvider();
provider.registerCustomModel('my-model', {
  contextWindow: 1000000,
  maxTokens: 65536,
  supportsVision: true
});
```

**支持 1M 上下文的模型：**
- Google Gemini 1.5 Pro/Flash
- Google Gemini 2.0 Flash/Pro
- Alibaba Qwen-Max
- Moonshot Kimi (128K)

**架构组件：**
- `IContextProvider` - 自定义上下文提供者接口
- `LargeContextProvider` - 内置提供者，支持 50+ 模型
- `ContextProviderRegistry` - 中心注册表
- `ContextManager` - 配置驱动的替代 API

## 命令行选项

```
Usage: openvibe [options] [prompt]

Options:
  -f, --file <path>       包含文件路径
  -c, --context <path>    添加上下文文件/目录
  --no-onboarding         跳过引导配置
  -h, --help             显示帮助信息
  -v, --version          显示版本号
```

## 文档

- [扩展开发指南](docs/extensions.md)
- [SDK 文档](docs/sdk.md)
- [主题定制](docs/themes.md)
- [快捷键配置](docs/keybindings.md)
- [技能系统](docs/skills.md)
- [提示模板](docs/prompt-templates.md)
- [会话管理](docs/session.md)
- [上下文压缩](docs/compaction.md)
- [自定义提供商](docs/custom-provider.md)
- [TUI 组件](docs/tui.md)
- [RPC 集成](docs/rpc.md)

## 系统要求

- Node.js >= 18.0.0
- npm >= 9.0.0

## 许可证

MIT

## 相关链接

- [npm 包](https://www.npmjs.com/package/openvibe)
- [问题反馈](https://github.com/boxiaolanya2008/openvibe/issues)
