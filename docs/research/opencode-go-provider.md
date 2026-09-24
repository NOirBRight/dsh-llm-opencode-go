# OpenCode Go provider research

Research date: 2026-08-26

- Docs: https://opencode.ai/docs/zh-cn/go/
- Base: https://opencode.ai/zen/go/v1
- Models: GET /models
- Usage: GET /usage
- Auth: Authorization Bearer

Official protocol table: Grok / GPT 5.6 Luna / Muse Spark use Responses (`…/zen/go/v1/responses`); MiniMax and Qwen use Anthropic Messages (`…/zen/go/v1/messages`, Anthropic SDK base `…/zen/go`); GLM, Kimi, LongCat, DeepSeek, MiMo, Hy3 use Chat Completions (`…/zen/go/v1/chat/completions`).
