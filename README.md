# dsh-llm-opencode-go

English | [中文](README.zh.md)

OpenCode Go integration for DeepSeek Harness. Chat uses the shared pi-ai adapter with per-model Completions, Responses, or Anthropic Messages. Model discovery and subscription usage stay on native Go endpoints.

## Installation

Lab (linked checkout, port 3082):

    pnpm install
    pnpm run build
    DSH_HOME=~/.dsh-lab dsh plugin --profile web add /home/noirbright/Workstation/dsh-llm-opencode-go

Production (tagged GitHub install, port 3080):

    DSH_HOME=~/.dsh dsh plugin --profile web add github:NOirBRight/dsh-llm-opencode-go#v0.1.2

## Configuration

    - id: llm-opencode-go
      name: dsh-llm-opencode-go
      config:
        apiKeyEnv: OPENCODE_GO_API_KEY
        baseURL: https://opencode.ai/zen/go/v1

## Verification

    pnpm test
    pnpm run build
    pnpm run pack:check

Provider documentation: https://opencode.ai/docs/zh-cn/go/
