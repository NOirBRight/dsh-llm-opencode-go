# dsh-llm-opencode-go

English | [中文](README.zh.md)

OpenCode Go integration for DeepSeek Harness. Chat uses the shared pi-ai adapter. Completions, Responses, or Anthropic Messages are selected per model from the official Go table. Model discovery and subscription usage stay on native Go endpoints because those capabilities are not part of the chat protocol.

The package root exposes the Cordis plugin contract and OpenCodeGoAdapter. The same artifact exports `./client`, which contributes the OpenCode Go card under Settings → LLM Providers. The protocol split is recorded in [ADR 0001](docs/adr/0001-one-route-triple-protocol.md).

## Compatibility

Verified runtimes are DeepSeek Harness `0.1.2-alpha.4` and `0.1.2-rc.1` on Cordis `4.0.2`; this record is evidence, not an allowlist.

Unknown newer runtimes are attempted on a best-effort basis after one warning, and the plugin keeps its normal mount path.

A reproduced failure is blocklisted only afterward; see the [compatibility records](package.json) for the affected version, reason, and evidence.


## LLM Providers UI ownership

The **LLM Providers** Settings page (`settings.section` `id: providers` with child `settings.provider.item`) and the shared `llm-providers` order store are owned solely by `dsh-llm-providers-ui`.

- This plugin contributes only its keyed card (`key: llm-opencode-go`) and its Host ``llm`` route; it does not install the page or the shared `llm-providers` namespace. Load order with the owner does not matter.
- Without the owner (Headless or Web without `dsh-llm-providers-ui`): the Host model route `opencode-go` still works; in Web the Providers page and this card are omitted and the browser console warns that the owner is missing. A Web release composition test rejects a bundle graph that ships provider cards without the owner.
- The nav globe glyph is a temporary `Alpha.4` DOM adapter owned only by `dsh-llm-providers-ui` (`src/client/nav-icon.ts`); this plugin does not ship that adapter.

Install `dsh-llm-providers-ui` explicitly in the profile alongside provider plugins (see that package's `cordis.patch.yml`).

## Installation

Install the published package through the profile manager:

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/download/v0.1.5/dsh-llm-providers-ui-0.1.5.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-opencode-go/releases/download/v0.1.19/dsh-llm-opencode-go-0.1.19.tgz
dsh web
~~~

The package contains release-ready `lib` artifacts. Install `dsh-llm-providers-ui` alongside this plugin to provide the shared LLM Providers page.

The Host Connection RPC authenticates browser requests through the Web trust fence. Durable settings remain enabled only for loopback pages; non-loopback pages keep their settings process-local even when their authority is trusted. Use SSH forwarding when remote editing is needed.

Put this plugin in the profile bundle with `dsh-llm-providers-ui`; the owner enumerates every installed provider card.

## Web configuration

Open Settings → LLM Providers → OpenCode Go. The provider-management RPC returns only decoded settings, revision, and value-free credential status; API keys are write-only and never echoed or logged. The Connection RPC authenticates through the Web trust fence, while durable settings writes require a loopback settings scope; use SSH forwarding when the browser is remote.

The card saves the public base URL and model catalog together as one revision-fenced `llm-opencode-go` settings mutation. Fetch available models opens the picker immediately. The Host reads `GET /zen/go/v1/models` (OpenAI-shaped ids only) and fills name, context, vision, thinking, and protocol from a local snapshot, then from a live [models.dev](https://models.dev) `opencode-go` overlay so newly published ids such as `omen-alpha` are not blank after Fetch.

When a key is stored, expanding the card refreshes subscription usage. With no key, the usage section stays idle. The Host reads `GET &lt;baseURL&gt;/usage` and renders the 5-hour, weekly, and monthly windows as consumed-percentage meters. The credential never crosses to the browser.

The model catalog starts collapsed and lists one row per model: a drag handle reorders rows (the order persists with the catalog), the chevron opens that row's context and capability flags, and the trash button removes it.

### Plugin configuration

![OpenCode Go Plugin card: API key, usage, and model catalog](docs/images/opencode-go-settings.png)

The Models page lists saved `opencode-go` models and can select them. Current Harness releases do not expose a third-party editor slot inside that page, so this package owns its editor under LLM Providers.

## Capability and protocol split

Chat uses one `opencode-go` route. The adapter does **not** re-register that route as a configurable provider (the pi-ai catalog already owns the directory entry). Per-model `api` selects:

    openai-completions   POST /zen/go/v1/chat/completions
    openai-responses     POST /zen/go/v1/responses
    anthropic-messages   POST /zen/go/v1/messages

Native independent capabilities remain Host-only:

    model discovery   GET /zen/go/v1/models
    subscription usage   GET /zen/go/v1/usage

Official provider documentation: https://opencode.ai/docs/zh-cn/go/

## Config

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

The provider route remains `opencode-go` and the settings namespace remains `llm-opencode-go`. Only configured catalog models are accepted for chat. Per-row `contextWindow` is the DSH compaction budget. The fallback context window is 262,144 tokens.

### Model capabilities

`vision` controls text/image input modalities. `thinking` enables selectable reasoning efforts. Known Go families pin a plugin `defaultEffort` when the session has not picked one. `api` is required for dispatch; unknown ids fall back to the documented family table.

Muse Spark requires the OpenCode workspace toggle for training-data models. DeepSeek V4 Flash requires the toggle for models hosted in China. Those are account flags on https://opencode.ai, not plugin settings. The forward `max` option for Muse Spark 1.3 Contributor is intentionally shown, but the current OpenCode Go upstream rejects that value with HTTP 400; select `xhigh` until the upstream enum is expanded.

## Model experience

The system prompt and provider-neutral messages are translated by PiAiAdapter into Completions, Responses, or Messages. Tool calls retain provider-issued ids. Images are encoded as base64 data URLs only for vision models.

Usage maps to Harness input/output counts. maxTokens is clamped against the configured context capacity by pi-ai.

## Known limitations

- A leftover `~/.dsh/.credentials.yaml.lock` written by CodexHub (`codexhub-atomic-lock=1`) blocks every DSH `credentials.set` until the sidecar is deleted. See CodexHub `docs/tasks/dsh-credentials-lock-interop.md`.
- This package does not call `registerConfigurableProviders` for `opencode-go` (duplicate directory with llm-pi-ai).
- GenerateOptions.stop is not supported by the shared PiAiAdapter.

## Release installation (Latest)

OpenCode Go models with per-model protocol routing, discovery, and usage. The release artifact targets DeepSeek Harness 0.1.2-alpha.4 and contains built Host/Client files only; it has no sibling-repository source, workstation path, link:, or workspace: dependency.

The dsh-llm-providers-ui package owns the LLM Providers page, navigation, and shared order store. This package owns only its provider card, models, credentials, and Host route. Install the Owner first for Web; headless Host routing works without the Owner.

Owner (Latest):

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/latest/download/dsh-llm-providers-ui-0.1.5.tgz
~~~

Provider (Latest):

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-opencode-go/releases/latest/download/dsh-llm-opencode-go.tgz
~~~

Fixed versions (reproducible):

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/download/v0.1.5/dsh-llm-providers-ui-0.1.5.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-opencode-go/releases/download/v0.1.19/dsh-llm-opencode-go-0.1.19.tgz
~~~

Update, uninstall, and verify:

~~~sh
# Update to the latest Release
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-opencode-go/releases/latest/download/dsh-llm-opencode-go.tgz
# Verify the loaded version
dsh plugin --profile web list
dsh plugin --profile web doctor
# Uninstall only this plugin
dsh plugin --profile web remove dsh-llm-opencode-go
~~~

Configuration: use the plugin section in Settings for Web UI plugins, or the profile dsh.profile.bundles entry for Host-only plugins. Start with this README's minimal YAML/JSON example and provide credentials/backend addresses explicitly.

Rollback: rerun the fixed v0.1.17 command, verify the profile list, then restart the Web service once. Inspect journalctl --user -u dsh-web.service and dsh plugin --profile web doctor; never put a source checkout in the production profile.

Release and integrity: [v0.1.19](https://github.com/NOirBRight/dsh-llm-opencode-go/releases/tag/v0.1.19) · [SHA256SUMS](https://github.com/NOirBRight/dsh-llm-opencode-go/releases/download/v0.1.19/SHA256SUMS).
