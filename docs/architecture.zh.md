# 架构：OpenCode Go 能力与混合 pi-ai 聊天协议

[English](architecture.md) | 中文

协议决策见 [ADR 0001](adr/0001-one-route-triple-protocol.md)。

插件只暴露一个 `opencode-go` provider。聊天走共享 PiAiAdapter；每个模型用 `api` 字段选择 Completions、Responses 或 Messages。发现和额度仍是独立的 Host 原生调用。
