# Architecture: OpenCode Go capabilities with mixed pi-ai chat

English | [中文](architecture.zh.md)

The accepted protocol decision is recorded in [ADR 0001](adr/0001-one-route-triple-protocol.md).

## Capability ownership

The package owns one provider identity, `opencode-go`, but it does not treat every Go endpoint as one protocol.

Chat uses the shared pi-ai-backed adapter. Each catalog model names its wire protocol, and `createProvider` dispatches on `model.api`:

    DSH GenerateOptions
      -> OpenCodeGoAdapter
      -> PiAiAdapter
      -> POST <base>/chat/completions | /responses | /messages
      -> DSH StreamChunk

OpenCode Go-specific independent capabilities remain native Host calls:

    model discovery  -> GET /models, enriched with documented metadata
    subscription usage -> GET /usage

This follows the Ollama plugin split: the plugin does not own a private SSE translator.

## Endpoint mapping

The settings section stores `https://opencode.ai/zen/go/v1`. Chat, listing, and usage all use that origin.

## Model catalog

`GET /models` currently returns OpenAI-shaped ids without `context_length`. The plugin copies live fields when present, then fills documented name, context, vision, thinking, and protocol from a local table. Unknown ids are listed without inventing a context window.
