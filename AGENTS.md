# dsh-llm-opencode-go

This repository owns only the OpenCode Go provider plugin. The official DSH checkout is a read-only dependency; do not patch DSH core.

Develop in this checkout, run pnpm test and pnpm run build, and verify the web plugin only in DSH_HOME=~/.dsh-lab on port 3082. Production 3080 is read-only.

Chat is delegated to pi-ai. Account usage uses Host-only GET /usage; never send keys through the browser or logs.
