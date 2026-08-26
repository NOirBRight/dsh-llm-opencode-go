import type { UserConfig } from 'tsdown'

const PACKAGE_ID = 'dsh-llm-opencode-go'

/** Specifiers the web module table can answer. Everything else must inline or fail the purity gate. */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-api-remotes/client',
  '@deepseek-ai/dsh-client-connection/client',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-ui-settings-plugins/client',
  '@deepseek-ai/dsh-client-ui-slots',
] as const

const isClientExternal = (id: string): boolean =>
  (CLIENT_EXTERNALS as readonly string[]).includes(id)

const host: UserConfig = {
  name: PACKAGE_ID,
  entry: ['lib/types/index.js', 'lib/types/invariant.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  deps: {
    neverBundle: [
      '@deepseek-ai/cordis',
      '@deepseek-ai/schemastery',
      '@deepseek-ai/dsh-attachment',
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-credentials',
      '@deepseek-ai/dsh-launch-environment',
      '@deepseek-ai/dsh-invariants',
      '@deepseek-ai/dsh-llm',
      '@deepseek-ai/dsh-llm-pi-ai',
      '@deepseek-ai/dsh-settings',
      '@deepseek-ai/dsh-timeout',
    ],
  },
}

const client: UserConfig = {
  name: `${PACKAGE_ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  clean: false,
  deps: {
    neverBundle: [...CLIENT_EXTERNALS],
    alwaysBundle: (id: string) => !isClientExternal(id),
  },
  plugins: [{
    name: 'dsh-client-bundle-purity',
    resolveId(source: string) {
      if (!source.startsWith('@deepseek-ai/')) return null
      if (isClientExternal(source)) return null
      throw new Error(
        `client bundle purity: "${source}" is not a web module-table entry — `
        + 'type-only imports are erased; a value import becomes require() the table cannot answer',
      )
    },
  }],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default ({ env }: Pick<UserConfig, 'env'>): UserConfig[] => {
  const face = env?.DSH_BUILD_FACE
  if (face === 'host') return [host]
  if (face === 'client') return [client]
  if (face !== undefined) throw new Error(`unknown DSH build face: ${String(face)}`)
  return [host, client]
}
