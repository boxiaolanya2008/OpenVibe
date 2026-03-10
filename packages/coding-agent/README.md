# OpenVibe

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

- **智能代码编辑**: 基于 AI 的代码分析、重构和生成
- **文件操作工具**: read、write、edit、bash、grep、find 等
- **会话管理**: 保存和恢复对话历史
- **扩展系统**: 自定义功能扩展
- **交互式终端界面**: 直观的 TUI 操作体验

## 配置说明

配置文件位于 `~/.openvibe/config.json`：

```json
{
  "apiUrl": "https://api.example.com/v1/chat/completions",
  "apiKey": "your-api-key",
  "model": "your-model-name"
}
```

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

## 工具功能

OpenVibe 内置以下工具：

| 工具 | 描述 |
|------|------|
| `read` | 读取文件内容 |
| `write` | 写入文件内容 |
| `edit` | 编辑文件（精确替换） |
| `bash` | 执行 shell 命令 |
| `grep` | 搜索文件内容 |
| `find` | 查找文件 |
| `ls` | 列出目录内容 |

## 交互式快捷键

在交互模式下：

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+C` | 退出程序 |
| `Ctrl+D` | 结束输入 |
| `Ctrl+L` | 清屏 |
| `Tab` | 自动补全 |

## 扩展开发

OpenVibe 支持 TypeScript 扩展，示例：

```typescript
import { defineExtension } from 'openvibe';

export default defineExtension({
  name: 'my-extension',
  setup({ onMessage }) {
    onMessage((message) => {
      console.log('收到消息:', message);
    });
  }
});
```

## 历史记录

OpenVibe 自动保存所有会话历史，方便你随时回顾和继续之前的对话。

### 查看历史

```bash
# 列出所有历史会话
openvibe --history

# 查看特定会话
openvibe --session <session-id>
```

### 历史文件位置

历史记录保存在 `~/.openvibe/sessions/` 目录下，每个会话以 JSONL 格式存储。

### 快捷键

在交互模式下管理历史：

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+R` | 打开历史会话选择器 |
| `Ctrl+S` | 保存当前会话 |
| `Ctrl+Shift+S` | 重命名当前会话 |

- [扩展开发指南](docs/extensions.md)
- [SDK 文档](docs/sdk.md)
- [主题定制](docs/themes.md)
- [快捷键配置](docs/keybindings.md)

## 系统要求

- Node.js >= 18.0.0
- npm >= 9.0.0

## 许可证

MIT

## 相关链接

- [npm 包](https://www.npmjs.com/package/openvibe)
- [问题反馈](https://github.com/openvibe/openvibe/issues)
