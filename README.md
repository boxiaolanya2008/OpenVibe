# OpenVibe

OpenVibe 是一款专业的 AI 编码助手，旨在提升开发者的编程效率和代码质量。它集成了智能代码分析、自动化工具执行和上下文感知的对话系统，为开发者提供全方位的编程辅助体验。

## 核心特性

### 智能编码辅助
- **上下文感知对话**：基于当前项目上下文提供精准的代码建议和问题解答
- **多文件分析**：同时分析多个文件，理解复杂的代码依赖关系
- **智能代码编辑**：支持代码重构、补全和优化建议

### 高性能工具执行
- **并行工具执行**：支持最多 8 个工具并发执行，大幅提升响应速度
- **API 并发优化**：基于网络 I/O 特性优化的并发请求处理机制
- **GPU 加速支持**：自动检测并利用本地 GPU 资源进行计算加速

### 灵活的扩展系统
- **技能系统 (Skills)**：基于 Markdown 的模块化技能定义，支持版本控制协作
- **扩展框架**：完整的扩展 API，支持自定义工具、命令和事件处理
- **主题定制**：灵活的主题系统，支持界面外观自定义

### 简化的配置模型
- **一次性配置**：在引导界面完成模型配置后，无需再次登录或切换
- **用户自定义端点**：仅使用用户配置的 API 端点，无预定义服务商限制
- **项目级上下文存储**：上下文压缩和历史记录存储在项目目录中，便于团队协作

## 项目结构

OpenVibe 采用模块化 monorepo 架构，包含以下核心包：

```
packages/
├── ai/              # AI 提供商抽象层和模型定义
├── agent/           # 核心代理逻辑和工具执行
├── coding-agent/    # 编码代理实现和交互模式
├── mom/            # 会话管理和持久化
├── tui/            # 终端用户界面组件
├── web-ui/         # Web 界面实现
└── pods/           # 容器化部署支持
```

## 安装指南

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### 快速开始

1. **克隆仓库**
   ```bash
   git clone https://github.com/your-org/openvibe.git
   cd openvibe
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建项目**
   ```bash
   npm run build
   ```

4. **运行引导配置**
   ```bash
   npm start
   ```
   按照提示配置您的 API 端点和模型参数。

## 使用方法

### 启动交互式会话

```bash
npm start
```

### 可用命令

在交互式会话中，您可以使用以下 slash 命令：

| 命令 | 描述 |
|------|------|
| `/help` | 显示帮助信息 |
| `/compact` | 压缩当前会话上下文 |
| `/fork` | 从当前状态创建分支会话 |
| `/tree` | 查看会话历史树 |
| `/session` | 切换或管理会话 |
| `/clear` | 清除当前会话历史 |
| `/tools` | 管理可用工具 |
| `/thinking` | 调整思考级别 |

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+C` | 中断当前操作 |
| `Ctrl+D` | 退出会话 |
| `Tab` | 自动补全 |

## 配置说明

### 用户配置文件

配置文件位于 `~/.openvibe/user-config.json`：

```json
{
  "activeModelId": "your-model-id",
  "apiUrl": "https://api.your-provider.com",
  "apiKey": "your-api-key",
  "thinkingLevel": "normal",
  "theme": "default"
}
```

**注意**：模型配置在引导阶段完成后即固定，不支持运行时切换。

### 项目级配置

在项目根目录创建 `.openvibe/config.json`：

```json
{
  "skills": ["./custom-skills"],
  "extensions": ["./custom-extensions"],
  "tools": {
    "enabled": ["read", "edit", "grep", "find", "bash"]
  }
}
```

### 技能系统

技能是存储在项目 `history-skill/` 目录中的 Markdown 文件，包含：

- **上下文摘要**：历史会话的压缩摘要
- **知识库**：领域特定知识
- **最佳实践**：项目特定的编码规范

## 开发指南

### 构建开发版本

```bash
npm run build:dev
```

### 运行测试

```bash
npm test
```

### 创建扩展

扩展使用 TypeScript/JavaScript 编写，放置在 `.openvibe/extensions/` 目录：

```typescript
import { ExtensionAPI } from '@openvibe/coding-agent';

export default function myExtension(pi: ExtensionAPI) {
  pi.registerCommand('hello', {
    description: 'Say hello',
    handler: async (args, ctx) => {
      ctx.ui.showMessage('Hello from extension!');
    }
  });
}
```

## API 并发架构

OpenVibe 实现了多层次的并发处理机制：

### 工具级并行
- **最大并发数**：8 个工具同时执行
- **智能调度**：基于 I/O 类型自动优化执行顺序
- **资源感知**：根据系统负载动态调整并发度

### 请求级优化
- **批处理**：支持 API 请求的批量提交
- **流式处理**：实时流式响应，减少等待时间
- **连接池**：复用 HTTP 连接，降低连接开销

### 本地加速
- **GPU 检测**：自动检测可用 GPU 资源
- **多线程处理**：CPU 密集型任务的多线程执行
- **内存优化**：智能缓存策略减少内存占用

## 常见问题

### Q: 如何更换已配置的模型？
A: 由于设计原则，模型配置在引导完成后固定。如需更换，请删除 `~/.openvibe/user-config.json` 并重新运行引导流程。

### Q: 技能文件是否可以版本控制？
A: 是的，`history-skill/` 目录中的文件是标准 Markdown，建议提交到版本控制系统以便团队协作。

### Q: 如何禁用特定工具？
A: 在项目配置中设置 `tools.enabled` 数组，仅列出需要启用的工具。

### Q: 支持哪些 API 提供商？
A: 任何兼容 OpenAI API 格式的提供商均可使用，包括 OpenAI、Anthropic、Azure OpenAI、本地模型等。

## 系统要求

### 最低配置
- CPU: 2 核心
- 内存: 4 GB RAM
- 磁盘: 1 GB 可用空间

### 推荐配置
- CPU: 4 核心及以上
- 内存: 8 GB RAM 及以上
- GPU: 支持 CUDA 或 ROCm 的显卡（可选，用于加速）
- 磁盘: SSD，5 GB 可用空间

## 贡献指南

我们欢迎社区贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范
- 使用 TypeScript 严格模式
- 遵循现有代码风格
- 提交前运行 `npm run lint`
- 确保所有测试通过

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 致谢

感谢所有贡献者和开源社区的支持。特别感谢以下项目的启发：
- 终端界面：基于 Ink 构建
- AI 抽象层：参考了 Vercel AI SDK 设计

## 联系我们

- **GitHub Issues**: [提交问题](https://github.com/your-org/openvibe/issues)
- **邮件**: contact@openvibe.dev

---

**OpenVibe** - 智能编程，从对话开始
