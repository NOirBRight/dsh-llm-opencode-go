# ADR 0001: One OpenCode Go route with pi-ai mixed-API dispatch

- Status: accepted
- Date: 2026-08-27

## Decision

Expose one DSH provider route named `opencode-go`. Chat is delegated to `PiAiAdapter`. The pi-ai provider is built with an `api` map keyed by `model.api`, so Completions, Responses, and Messages share one route without a private serializer.

Keep discovery and subscription usage as native Host RPCs, following the Ollama capability split.
