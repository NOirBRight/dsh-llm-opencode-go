# Changelog

## 0.1.14 - 2026-08-30
- fix: filter `sandbox_permissions` escalation schemas that cannot be strictly wider than the current DSH file policy. Scans both `options.system` and `options.messages` context-injection text for `Current DSH file policy: (read-only|workspace-write|danger-full-access).` and narrows tool `parameters.properties.sandbox_permissions.enum` to only wider modes, removing `sandbox_permissions` and `justification` when none remain. Applied on both direct `stream` and prepared `prepareCall` streams across all pi-ai protocols (openai-completions, openai-responses, anthropic-messages). TDD coverage for all modes, message injection, and immutability. Ported from `dsh-llm-codex` narrow fix.

## 0.1.13 - 2026-08-30
- release: v0.1.13
