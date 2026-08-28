# dsh-llm-opencode-go

[English](README.md) | 中文

DeepSeek Harness 的 OpenCode Go 集成。聊天走共享 PiAiAdapter，按官方 Go 表格为每个模型选择 Completions、Responses 或 Anthropic Messages。模型发现和订阅用量留在原生 Go 端点，因为这些能力不属于聊天协议。

包根入口公开 Cordis plugin contract 和 OpenCodeGoAdapter。同一 artifact 还导出 `./client`，在 Settings → LLM Providers 中提供 OpenCode Go 卡片。协议分离记录在 [ADR 0001](docs/adr/0001-one-route-triple-protocol.md)。

## 安装

要求 DeepSeek Harness 0.1.0-rc.6 或更高版本。直接从 GitHub 安装：

~~~sh
dsh plugin --profile web add github:NOirBRight/dsh-llm-opencode-go#v0.1.8
dsh web
~~~

仓库跟踪可直接发布的 lib artifacts，因此 GitHub 安装不需要 build-script allowlist。源码 checkout 可在 `pnpm run build` 后用 link 安装。

把本插件放在 profile bundle 里其它 LLM provider **之前**，由它认领 LLM Providers 页并列出所有已装卡片。

## Web 配置

打开 Settings → LLM Providers → OpenCode Go。provider 管理 RPC 只返回解码后的设置、revision 和不含值的凭据状态；API key 仅单向写入，绝不回显或记录。默认仅 loopback。外部认证部署请设置 `remoteManagement: true`，并用 `dsh web --trusted-host <host>` 启动（或使用 SSH 转发）；修改后必须重启 `dsh web`。

卡片用一次带 revision 防护的 `llm-opencode-go` mutation 同时保存 API 地址和模型目录。Fetch available models 会立即打开 picker。Host 读取 `GET /zen/go/v1/models`，再用文档目录补全 context window、vision、thinking 以及 Completions / Responses / Messages。

已配置 key 时，展开卡片会自动刷新订阅用量；没有 key 时用量区保持空闲。Host 读取 `GET &lt;baseURL&gt;/usage`，把 5 小时 / 每周 / 每月窗口渲染成已用百分比。凭据不会传到浏览器。

模型目录默认折叠，展开后一行一个模型：左侧把手可拖动排序（顺序随目录一起保存），右侧箭头展开该行的上下文和能力开关，垃圾桶按钮删除该行。

### 插件配置

![OpenCode Go 插件卡片：API key、用量与模型目录](docs/images/opencode-go-settings.png)

Models 页面会列出已保存的 `opencode-go` 模型并允许选择。当前 Harness 版本没有 Models 页里的第三方编辑器 slot，因此本包在 LLM Providers 持有完整编辑器。

## 能力与协议分离

聊天使用一条 `opencode-go` 路由。adapter **不会**再把该路由登记成 configurable provider（pi-ai 目录已经占了这个名字）。按模型 `api` 选择：

    openai-completions   POST /zen/go/v1/chat/completions
    openai-responses     POST /zen/go/v1/responses
    anthropic-messages   POST /zen/go/v1/messages

原生独立能力仍只在 Host：

    模型发现   GET /zen/go/v1/models
    订阅用量   GET /zen/go/v1/usage

官方文档：https://opencode.ai/docs/zh-cn/go/

## 配置

~~~yaml
- id: llm-opencode-go
  name: dsh-llm-opencode-go
  config:
    apiKeyEnv: OPENCODE_API_KEY
    remoteManagement: false
    baseURL: https://opencode.ai/zen/go/v1
    defaultContextWindow: 262144
    streamIdleTimeoutMs: 300000
    models:
      - id: muse-spark-1.2-contributor
        name: Muse Spark 1.2 Contributor
        contextWindow: 1048576
        maxTokens: 131072
        vision: true
        thinking: true
        defaultEffort: medium
        api: openai-responses
      - id: glm-5.3-flash
        name: GLM-5.3-Flash
        contextWindow: 1000000
        thinking: true
        defaultEffort: high
        api: openai-completions
~~~

Provider route 仍是 `opencode-go`，设置命名空间仍是 `llm-opencode-go`。只有目录里的模型可以聊天。行上的 `contextWindow` 是 DSH 压缩预算。Fallback 为 262,144 tokens。

### 模型能力

`vision` 决定 text/image 输入。`thinking` 启用 reasoning effort。已知 Go 家族在会话未选择时使用插件 `defaultEffort`。`api` 用于协议分发；未知 id 回退到文档中的家族表。

Muse Spark 需要 OpenCode 工作区打开训练数据模型开关。DeepSeek V4 Flash 需要打开中国区托管模型开关。那是 https://opencode.ai 上的账号选项，不是插件配置。

## 模型体验

System prompt 与 provider-neutral 消息由 PiAiAdapter 转成 Completions / Responses / Messages。工具调用保留 provider 签发的 id。只有 vision 模型接收 base64 图片。

Usage 映射成 Harness input/output。pi-ai 按 context capacity clamp maxTokens。

## 已知限制

- Provider 管理默认仅限 loopback。请先配置外部认证和 `dsh web --trusted-host <host>`，再设置 `remoteManagement: true` 并重启 DSH；也可以继续使用 SSH 端口转发。
- CodexHub 留下的 `~/.dsh/.credentials.yaml.lock`（`codexhub-atomic-lock=1`）会卡住所有 DSH `credentials.set`，需删掉该 sidecar。见 CodexHub `docs/tasks/dsh-credentials-lock-interop.md`。
- 本包不为 `opencode-go` 调用 `registerConfigurableProviders`（与 llm-pi-ai 目录冲突）。
- 共享 PiAiAdapter 不支持 GenerateOptions.stop。
