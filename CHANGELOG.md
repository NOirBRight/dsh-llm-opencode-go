## v0.1.25

- 详情页改用共享模板 `ProviderDetail`（由设置页通过 slot 上下文下发，插件不再自带模板与样式）。
- 模型行交给模板渲染：`items`（行数据）+ `extra`（该行的上下文窗口、能力勾选、默认思考等级等私有字段），插件不再画行卡片；行内字段固定列槽、排序态只读并收起、单层圆角。
- 详情模式下插件不再自行请求额度（`props.mode === 'detail'` 时直接返回），额度由设置页的共享缓存提供，右上角刷新走 `props.onRefresh`。
- 高级设置按原型：分隔线区块 + 折叠箭头 + 右侧说明，选项为「复选框 + 缩进说明」。
- 移动端：工具栏与标题同一行（无换行、无溢出），窄屏自动收紧。
- 依赖 `dsh-llm-providers-ui` 升级到 `0.2.0`（破坏性接口：必须使用 slot 下发的 `template`/`copy` 与 `items`/`extra`）。

# Changelog

## Unreleased

## [0.1.24] - 2026-09-10

- Send `x-opencode-session` on every zen/go/v1 request (chat Completions/Responses/Messages, GET /models, GET /usage). Chat uses the DSH session id when present so Go can route and cache per conversation.

## [0.1.23] - 2026-09-10

- Register OpenCode Go with the shared Provider Directory usage reader (same path as Antigravity) so quota is cached and shown in the task panel. Paint remaining quota from a local cache on first open, then refresh in the background. Saving no longer blanks the meter.
- Adopt Approved A provider chrome (LLM badge, weekly remaining meter) and inner Connection/quota copy to match Command Code: remaining meters, replace-key placeholder, official endpoint hint.
- Fetch refreshes the models.dev overlay when GET /models returns an id the 24h cache does not know, so new Go models are not stuck as blank rows until tomorrow.
- Empty catalogs select the full live list; models missing from the current catalog sort to the top of the picker as `Name (id)`.
- Document `deepseek-flash` as DeepSeek V4.1 Flash for the offline snapshot fallback.
- Advertise official Grok 4.6 reasoning (`low` / `medium` / `high` / `xhigh`); 4.5 stays three levels.
- Stop filling undocumented families with Codex five-level `max`. GLM-5 / LongCat are thinking on/off; Qwen 3.5–3.7 are hybrid on/off; Qwen 3.8 stays `low` / `medium` / `xhigh`; MiMo including Pro stays `low` / `medium` / `xhigh`; Hy3 stays three levels; MiniMax M3 is on/off.

## [0.1.20] - 2026-09-04

- fix: publish the accepted settings revision after save so a second Save does not hit a stale fence.
- fix: accept K/M context spellings (`1m`, `256k`) on the catalog card.
- feat: Fetch available models overlays live models.dev metadata so new Go ids such as `omen-alpha` arrive with context, vision, and reasoning instead of a blank row. Vision follows `modalities.input` (not `attachment`); effort menus persist `reasoning_options`. Fetch does not wait on a slow models.dev download; the parsed overlay is reused from disk for 24h.

## [0.1.19] - 2026-09-03

### Changed

- DSH compatibility declarations cover the verified Alpha.4 and rc.1 runtimes.
- Unknown runtimes warn once and use the normal best-effort mount path; only reproduced failures may be blocklisted.


## 0.1.18 - 2026-09-03

- Add `hy4-preview`, `qwen3.8-flash`, and `muse-spark-1.3-contributor` with their official protocol, context, vision, output, and reasoning metadata.
- Correct the current OpenCode Go context and vision catalog from the 2026-09-03 OpenCode/models.dev snapshot while preserving existing GPT/Grok effort tables and defaults.
- Keep Muse Spark 1.3 Contributor's forward `max` option visible; the current upstream still rejects that value with HTTP 400, while `xhigh` succeeds.

## 0.1.15

- Settings → LLM Providers: drag cards to reorder; chat picker follows `llm-providers.order` via dsh-llm-providers-ui.


## 0.1.14 - 2026-08-30
- fix: filter `sandbox_permissions` escalation schemas that cannot be strictly wider than the current DSH file policy. Scans both `options.system` and `options.messages` context-injection text for `Current DSH file policy: (read-only|workspace-write|danger-full-access).` and narrows tool `parameters.properties.sandbox_permissions.enum` to only wider modes, removing `sandbox_permissions` and `justification` when none remain. Applied on both direct `stream` and prepared `prepareCall` streams across all pi-ai protocols (openai-completions, openai-responses, anthropic-messages). TDD coverage for all modes, message injection, and immutability. Ported from `dsh-llm-codex` narrow fix.

## 0.1.13 - 2026-08-30
- release: v0.1.13
