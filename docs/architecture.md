# Architecture: OpenCode Go capabilities with mixed pi-ai chat

English | [中文](architecture.zh.md)

The accepted protocol decision is recorded in [ADR 0001](adr/0001-one-route-triple-protocol.md).

## Capability ownership

The package owns one provider identity, `opencode-go`, but it does not treat every Go endpoint as one protocol.

Chat uses the shared pi-ai-backed adapter. Each catalog model names its wire protocol, and `createProvider` dispatches on `model.api`:

    DSH GenerateOptions
      -> OpenCodeGoAdapter
      -> PiAiAdapter
      -> Completions/Responses POST {openaiOrigin}/chat/completions|/responses
      -> Messages POST {anthropicOrigin}/v1/messages
      -> DSH StreamChunk

OpenCode Go-specific independent capabilities remain native Host calls:

    model discovery  -> GET /models, enriched with documented metadata
    subscription usage -> GET /usage

This follows the Ollama plugin split: the plugin does not own a private SSE translator.

## Endpoint mapping

Settings store the OpenAI-compatible origin `https://opencode.ai/zen/go/v1`. Listing (`GET /models`) and usage (`GET /usage`) always use that origin.

Chat follows the official Go endpoint table (https://opencode.ai/docs/zh-cn/go/):

- Completions (GLM, Kimi, DeepSeek, MiMo, Hy3, LongCat): `POST {origin}/chat/completions`
- Responses (Grok, GPT, Muse Spark): `POST {origin}/responses`
- Messages (MiniMax, Qwen): `POST {anthropicOrigin}/v1/messages`, where `anthropicOrigin` is `origin` without one trailing `/v1`. The Anthropic SDK appends `/v1/messages`; the published URL is `https://opencode.ai/zen/go/v1/messages`.

Every request includes `x-opencode-session` (DSH session id on chat; stable ids on listing and usage).

## Model catalog

`GET /models` currently returns OpenAI-shaped ids without `context_length`. The plugin copies live listing fields when present, fills a local snapshot, then overlays [models.dev](https://models.dev) `opencode-go.models`. A context window is omitted when the listing, the overlay, and the snapshot all omit one.
