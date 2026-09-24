# dsh-llm-opencode-go

[English](README.md) | 中文

DeepSeek Harness 的 OpenCode Go 集成。聊天走共享 PiAiAdapter，按官方 Go 表格为每个模型选择 Completions、Responses 或 Anthropic Messages。模型发现和订阅用量留在原生 Go 端点，因为这些能力不属于聊天协议。

包根入口公开 Cordis plugin contract 和 OpenCodeGoAdapter。同一 artifact 还导出 `./client`，在 Settings → LLM Providers 中提供 OpenCode Go 卡片。协议分离记录在 [ADR 0001](docs/adr/0001-one-route-triple-protocol.md)。

## 兼容性

此源码以官方 DSH `0.1.7-alpha.2` 为目标：DSH package peer 固定为该版本，Cordis 为 `~4.0.4`，Schemastery 为 `~3.18.4`。

`package.json#dsh.compatibility.dshReleases` 里的已验证宿主是证据，不是允许列表。未知的新宿主告警一次后仍按正常路径挂载。只有复现过的故障才会加入 blocklist。

`catalogId` 与未解析的 `unknown` 账户状态在运行时挂上。已发布的 `dsh-llm-providers-ui` 0.2.8 不含这些字段，并把 `unknown` 当成未连接；只有更新的 Owner 才会生效。

## 安装

通过 profile manager 安装已发布的软件包：

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/download/v0.2.12/dsh-llm-providers-ui-0.2.12.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-opencode-go/releases/download/v0.1.32/dsh-llm-opencode-go-0.1.32.tgz
dsh web
~~~

软件包包含可直接使用的 `lib` artifacts。请在 profile 中与本插件一起安装 `dsh-llm-providers-ui`，由它提供共享的 LLM Providers 页面。

客户端 RPC 通过经过认证的 `/api/plugin-rpc/opencode-go` Fetch 路由。物理 `/api` carrier 会在分发至插件路由前检查 Host/Origin 与 cookie 认证，并执行 body 大小限制。

请在 profile 中与 `dsh-llm-providers-ui` 一起安装本插件，由 owner 枚举所有已安装的 provider 卡片。

## Web 配置

打开 Settings → LLM Providers → OpenCode Go。配置通过 Loader 条目 `llm-opencode-go` 的 alpha2 `ConfigForm` 读取；volatile `baseURL` 和 `models` 字段在按快照 revision 提交之前，先由经过认证的 Host 路由校验地址和模型目录。凭据状态和写入同样使用经过认证的插件 RPC；API key 只写入，不会回显或记录。

卡片通过一次带 revision 防护的 `ConfigForm.mutate` 同时保存 API 地址和模型目录。Fetch available models 会立即打开 picker。Host 读取 `GET /zen/go/v1/models`（只有 OpenAI 形 id），先用本地快照再叠加 live [models.dev](https://models.dev) 的 `opencode-go` 元数据补全名称、上下文、视觉和推理，因此新 id（如 `omen-alpha`）不会是空白行。

已配置 key 时，卡片折叠也会加载账户额度（获取模型或刷新会再拉一次）。Host 读取 `GET &lt;baseURL&gt;/usage`；5 小时 / 周 / 月剩余额度首次打开用本地缓存，再后台刷新。凭据不会传到浏览器。

模型目录默认折叠，展开后一行一个模型：左侧把手可拖动排序（顺序随目录一起保存），右侧箭头展开该行的上下文和能力开关，垃圾桶按钮删除该行。

### 插件配置

![OpenCode Go 插件卡片：API key、用量与模型目录](docs/images/opencode-go-settings.png)

Models 页面会列出已保存的 `opencode-go` 模型并允许选择。当前 Harness 版本没有 Models 页里的第三方编辑器 slot，因此本包在 LLM Providers 持有完整编辑器。

## 能力与协议分离

聊天使用一条 `opencode-go` 路由。adapter **不会**再把该路由登记成 configurable provider（pi-ai 目录已经占了这个名字）。按模型 `api` 选择：

    openai-completions   POST {baseURL}/chat/completions
    openai-responses     POST {baseURL}/responses
    anthropic-messages   POST {去掉末尾 /v1 的 baseURL}/v1/messages

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

Provider route 仍是 `opencode-go`，Loader entry id 为 `llm-opencode-go`。只有目录里的模型可以聊天。行上的 `contextWindow` 是 DSH 压缩预算。Fallback 为 262,144 tokens。

### 模型能力

`vision` 决定 text/image 输入。`thinking` 启用 reasoning effort。已知 Go 家族在会话未选择时使用插件 `defaultEffort`。`api` 用于协议分发；未知 id 回退到文档中的家族表。

Muse Spark 需要 OpenCode 工作区打开训练数据模型开关。DeepSeek V4 Flash 和 V4.1 Flash（`deepseek-flash`）需要打开中国区托管模型开关。那是 https://opencode.ai 上的账号选项，不是插件配置。Muse Spark 1.3 Contributor 会按前瞻策略展示 `max`，但当前 OpenCode Go 上游会以 HTTP 400 拒绝该值；上游扩展枚举前请选 `xhigh`。

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

此版本面向官方 DeepSeek Harness `0.1.7-alpha.2`；Web 请同时安装已发布的 Provider UI `0.2.12`。

LLM Providers 页面、导航和共享排序由 dsh-llm-providers-ui 独占；本插件只提供卡片、模型和 Host 路由。Web 必须先装 Owner，headless 只使用 Host 路由时可以不装 Owner。

Latest（Owner + 本插件；Web 必须一起装）：

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/latest/download/dsh-llm-providers-ui-0.2.12.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-opencode-go/releases/latest/download/dsh-llm-opencode-go-0.1.32.tgz
~~~

固定版本（可复现）：

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/download/v0.2.12/dsh-llm-providers-ui-0.2.12.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-opencode-go/releases/download/v0.1.32/dsh-llm-opencode-go-0.1.32.tgz
~~~

更新、卸载与验证：

~~~sh
# 更新 Owner + 本插件到 Latest
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/latest/download/dsh-llm-providers-ui-0.2.12.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-opencode-go/releases/latest/download/dsh-llm-opencode-go-0.1.32.tgz
# 验证加载与版本
dsh plugin --profile web list
dsh plugin --profile web doctor
# 只卸载本插件
dsh plugin --profile web remove dsh-llm-opencode-go
~~~

配置入口：Web 使用「设置」中的本插件页面；Host-only 插件使用 profile 的 dsh.profile.bundles 配置。先复制本 README 的最小 YAML/JSON 示例，再填写凭据或后端地址。

回滚：一并恢复此前官方 Host 和配套 profile；旧版 OpenCode Go 不兼容此 Alpha.2 Host。失败时查看 journalctl --user -u dsh-web.service 与 dsh plugin --profile web doctor，不要把源码 checkout 写入 production profile。

Release 与完整性：[v0.1.32](https://github.com/NOirBRight/dsh-llm-opencode-go/releases/tag/v0.1.32) · [SHA256](https://github.com/NOirBRight/dsh-llm-opencode-go/releases/download/v0.1.32/dsh-llm-opencode-go-0.1.32.tgz.sha256)。
