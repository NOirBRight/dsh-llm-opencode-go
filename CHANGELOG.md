# Changelog
## [0.1.19] - 2026-09-03

### Changed

- DSH compatibility declarations cover the verified Alpha.4 and rc.1 runtimes.
- Unknown runtimes warn once and use the normal best-effort mount path; only reproduced failures may be blocklisted.


## Unreleased

- fix: publish the accepted settings revision after save so a second Save does not hit a stale fence.
- fix: accept K/M context spellings (`1m`, `256k`) on the catalog card.
- feat: Fetch available models overlays live models.dev metadata so new Go ids such as `omen-alpha` arrive with context, vision, and reasoning instead of a blank row. Vision follows `modalities.input` (not `attachment`); effort menus persist `reasoning_options`. Fetch does not wait on a slow models.dev download; the parsed overlay is reused from disk for 24h.

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
