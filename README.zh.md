# dsh-llm-opencode-go

[English](README.md) | 中文

DeepSeek Harness 的 OpenCode Go 集成。聊天走共享 PiAiAdapter，按官方 Go 表格为每个模型选择 Completions、Responses 或 Anthropic Messages。模型发现和订阅用量留在原生 Go 端点，因为这些能力不属于聊天协议。

包根入口公开 Cordis plugin contract 和 OpenCodeGoAdapter。同一 artifact 还导出 `./client`，在 Settings → LLM Providers 中提供 OpenCode Go 卡片。协议分离记录在 [ADR 0001](docs/adr/0001-one-route-triple-protocol.md)。

## 兼容性

已验证运行时是 DeepSeek Harness `0.1.2-alpha.4` 与 `0.1.2-rc.1`（Cordis `4.0.2`）；这份记录只是证据，不是 allowlist。

未知的新版本会先打一条 warning，再按正常挂载路径 best-effort 尝试，不会因为未验证而跳过。

只有复现过的故障才会加入 blocklist；受影响版本、原因和证据见[兼容性记录](package.json)。


## 安装

通过 profile manager 安装已发布的软件包：

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/download/v0.1.5/dsh-llm-providers-ui-0.1.5.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-opencode-go/releases/download/v0.1.20/dsh-llm-opencode-go-0.1.20.tgz
dsh web
~~~

软件包包含可直接使用的 `lib` artifacts。请在 profile 中与本插件一起安装 `dsh-llm-providers-ui`，由它提供共享的 LLM Providers 页面。

Alpha.4 Host Connection RPC 会通过 Web trust fence 认证浏览器请求。持久化设置只对 loopback 页面开放；即使 authority 已获信任，非 loopback 页面也只在进程内保存设置。需要远程编辑时请使用 SSH 转发。

请在 profile 中与 `dsh-llm-providers-ui` 一起安装本插件，由 owner 枚举所有已安装的 provider 卡片。

## Web 配置

打开 Settings → LLM Providers → OpenCode Go。provider 管理 RPC 只返回解码后的设置、revision 和不含值的凭据状态；API key 仅单向写入，绝不回显或记录。Connection RPC 通过 Web trust fence 认证请求，但持久化设置写入需要 loopback settings scope；浏览器在远程主机时请使用 SSH 转发。

卡片用一次带 revision 防护的 `llm-opencode-go` mutation 同时保存 API 地址和模型目录。Fetch available models 会立即打开 picker。Host 读取 `GET /zen/go/v1/models`（只有 OpenAI 形 id），先用本地快照再叠加 live [models.dev](https://models.dev) 的 `opencode-go` 元数据补全名称、上下文、视觉和推理，因此新 id（如 `omen-alpha`）不会是空白行。

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

Muse Spark 需要 OpenCode 工作区打开训练数据模型开关。DeepSeek V4 Flash 需要打开中国区托管模型开关。那是 https://opencode.ai 上的账号选项，不是插件配置。Muse Spark 1.3 Contributor 会按前瞻策略展示 `max`，但当前 OpenCode Go 上游会以 HTTP 400 拒绝该值；上游扩展枚举前请选 `xhigh`。

## 模型体验

System prompt 与 provider-neutral 消息由 PiAiAdapter 转成 Completions / Responses / Messages。工具调用保留 provider 签发的 id。只有 vision 模型接收 base64 图片。

Usage 映射成 Harness input/output。pi-ai 按 context capacity clamp maxTokens。

## 已知限制

- CodexHub 留下的 `~/.dsh/.credentials.yaml.lock`（`codexhub-atomic-lock=1`）会卡住所有 DSH `credentials.set`，需删掉该 sidecar。见 CodexHub `docs/tasks/dsh-credentials-lock-interop.md`。
- 本包不为 `opencode-go` 调用 `registerConfigurableProviders`（与 llm-pi-ai 目录冲突）。
- 共享 PiAiAdapter 不支持 GenerateOptions.stop。
## LLM Providers UI ownership

**LLM 供应商**设置页（`settings.section` `id: providers` 及子槽 `settings.provider.item`）与共享的 `llm-providers` 排序存储完全由 `dsh-llm-providers-ui` 拥有。

- 本插件仅贡献自己的卡片（`key: llm-opencode-go`）和 Host 上的 `llm` 路由；不安装页面或共享命名空间。加载顺序不影响归属。
- 未安装 owner 时（Headless 或 Web 未装 `dsh-llm-providers-ui`）：Host 侧模型路由 `opencode-go` 仍可工作；Web 侧 Providers 页面与本卡片不显示，并在浏览器控制台提示缺少 owner。正式 Web 发版的组合测试会拒绝缺少 owner 的图。
- 导航地球图标为 ``Alpha.4`` 临时 DOM 适配器，仅由 `dsh-llm-providers-ui` 持有；本插件不含该适配。

请在 profile 中与 provider 插件一起显式安装 `dsh-llm-providers-ui`（见其 `cordis.patch.yml`）。

## 正式版安装（Latest）

OpenCode Go models with per-model protocol routing, discovery, and usage. 正式成品按上方兼容性记录运行；发布包只包含构建后的 Host/Client 产物，不包含兄弟仓库源码、本机路径或 link:/workspace: 依赖。

LLM Providers 页面、导航和共享排序由 dsh-llm-providers-ui 独占；本插件只提供卡片、模型和 Host 路由。Web 必须先装 Owner，headless 只使用 Host 路由时可以不装 Owner。

Owner（Latest）：

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/latest/download/dsh-llm-providers-ui-0.1.5.tgz
~~~

本 Provider（Latest）：

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-opencode-go/releases/latest/download/dsh-llm-opencode-go.tgz
~~~

固定版本（可复现）：

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/download/v0.1.5/dsh-llm-providers-ui-0.1.5.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-opencode-go/releases/download/v0.1.20/dsh-llm-opencode-go-0.1.20.tgz
~~~

更新、卸载与验证：

~~~sh
# 更新到最新 Release
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-opencode-go/releases/latest/download/dsh-llm-opencode-go.tgz
# 验证加载与版本
dsh plugin --profile web list
dsh plugin --profile web doctor
# 只卸载本插件
dsh plugin --profile web remove dsh-llm-opencode-go
~~~

配置入口：Web 使用「设置」中的本插件页面；Host-only 插件使用 profile 的 dsh.profile.bundles 配置。先复制本 README 的最小 YAML/JSON 示例，再填写凭据或后端地址。

回滚：重新执行固定版本 v0.1.17 命令，确认插件列表后只重启一次 Web 服务。失败时查看 journalctl --user -u dsh-web.service 与 dsh plugin --profile web doctor，不要把源码 checkout 写入 production profile。

Release 与完整性：[v0.1.19](https://github.com/NOirBRight/dsh-llm-opencode-go/releases/tag/v0.1.20) · [SHA256SUMS](https://github.com/NOirBRight/dsh-llm-opencode-go/releases/download/v0.1.20/SHA256SUMS)。
