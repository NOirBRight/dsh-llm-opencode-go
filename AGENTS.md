# dsh-llm-opencode-go

This repository owns only the OpenCode Go provider plugin. The official DSH checkout is a read-only dependency; do not patch DSH core.

Develop in this checkout, run pnpm test and pnpm run build, and verify the web plugin only in DSH_HOME=~/.dsh-lab on port 3082. Production 3080 is read-only.

Chat is delegated to pi-ai. Account usage uses Host-only GET /usage; never send keys through the browser or logs.

## DSH 版本兼容

- 官方 DSH Host 包（`@deepseek-ai/dsh` 及其工作区 `@deepseek-ai/dsh-*` 包）在 `package.json` 的 `dependencies`、`optionalDependencies`、`devDependencies`、`peerDependencies` 中使用无上界的下限范围 `>=<最早已验证兼容版本>`；锁文件可固定实际验证的版本。独立发布的插件依赖按其发布渠道声明。
- 声明兼容新 DSH release 前，审查其公开 API 变化与插件实际调用，运行相关测试和 `pnpm run build`，并在 3082（`DSH_HOME=~/.dsh-lab`）验证；全部通过后再宣称兼容。
