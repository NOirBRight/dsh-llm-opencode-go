#!/usr/bin/env node

import { builtinModules, createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs'
import { join, posix, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PACKAGE_NAME = 'dsh-llm-opencode-go'
const PACKAGE_VERSION = '0.1.17'
const ALPHA_VERSION = '0.1.2-alpha.4'
const ALPHA_REVISION = '4e84901e6471b79ec0338099867ebb4606d12bb5'
const INVALID_REGISTRY = 'http://127.0.0.1:9/'
const DEPENDENCY_SECTIONS = ['dependencies', 'optionalDependencies', 'peerDependencies']
const BUILTIN_MODULES = new Set([...builtinModules, ...builtinModules.map(name => 'node:' + name)])
const REQUIRED_FILES = [
  'LICENSE',
  'README.md',
  'README.zh.md',
  'package.json',
  'cordis.patch.yml',
  'lib/index.js',
  'lib/invariant.js',
  'lib/client.js',
  'lib/types/index.d.ts',
  'lib/types/invariant.d.ts',
  'lib/types/client/index.d.ts',
]

const CHILD_ENV_ALLOWLIST = [
  'PATH', 'HOME', 'USER', 'LANG', 'TMP', 'TMPDIR', 'TEMP', 'CI',
  'SystemRoot', 'WINDIR', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'COMSPEC', 'PATHEXT',
]
const CHILD_ENV_OVERRIDES = new Set(['DSH_PROVIDERS_UI_ARTIFACT', 'DSH_PROVIDERS_UI_SHA256'])
let childUserConfig

function fail(message) {
  throw new Error('pack gate failed: ' + message)
}

function childEnvironment(overrides = {}) {
  if (childUserConfig === undefined) fail('child environment was used before its isolated userconfig was created')
  const env = {}
  for (const name of CHILD_ENV_ALLOWLIST) {
    const value = process.env[name]
    if (value !== undefined) env[name] = value
  }
  env.NODE_PATH = ''
  env.NODE_OPTIONS = ''
  env.npm_config_userconfig = childUserConfig
  env.npm_config_registry = INVALID_REGISTRY
  for (const [name, value] of Object.entries(overrides)) {
    if (!CHILD_ENV_OVERRIDES.has(name)) fail('unsafe pack child environment override: ' + (name || '<empty>'))
    if (typeof value !== 'string' || value.length === 0) fail('empty pack child environment override: ' + name)
    env[name] = value
  }
  return env
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: childEnvironment(options.env),
    encoding: 'utf8',
    input: options.input,
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const stdout = typeof result.stdout === 'string' ? result.stdout : ''
  const stderr = typeof result.stderr === 'string' ? result.stderr : ''
  if (result.error || result.status !== 0) {
    const detail = [stdout, stderr].filter(Boolean).join('\n').trim()
    fail(command + ' ' + args.join(' ') + (detail ? ':\n' + detail : ''))
  }
  return stdout
}

function verifyChildEnvironment() {
  const poisonNames = [
    'OPENAI_API_KEY', 'AWS_SECRET_ACCESS_KEY', 'AUTH_TOKEN', 'DB_PASSWORD',
    'CREDENTIALS_JSON', 'GOOGLE_APPLICATION_CREDENTIALS', 'CLOUDSDK_CONFIG',
    'NPM_CONFIG_USERCONFIG', 'NPM_CONFIG_REGISTRY', 'npm_config_cache',
    'PNPM_HOME', 'COREPACK_HOME', 'DSH_PACK_NEGATIVE_SECRET', 'NODE_PATH', 'NODE_OPTIONS',
  ]
  const previous = new Map(poisonNames.map(name => [name, process.env[name]]))
  let output
  try {
    for (const name of poisonNames) process.env[name] = 'dsh-pack-gate-negative'
    output = run(process.execPath, ['-e', "process.stdout.write(JSON.stringify({ keys: Object.keys(process.env), nodePath: process.env.NODE_PATH, nodeOptions: process.env.NODE_OPTIONS, registry: process.env.npm_config_registry, userconfig: process.env.npm_config_userconfig }))"])
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
  const observed = readJsonFromText(output, 'child environment probe')
  const keys = new Set(observed.keys)
  const leaked = poisonNames.filter(name => name !== 'NODE_PATH' && name !== 'NODE_OPTIONS' && keys.has(name))
  if (leaked.length > 0) fail('pack child inherited forbidden environment names: ' + leaked.join(', '))
  if (observed.nodePath !== '' || observed.nodeOptions !== '') fail('pack child did not clear NODE_PATH/NODE_OPTIONS')
  if (observed.registry !== INVALID_REGISTRY) fail('pack child registry is not invalidated')
  if (observed.userconfig !== childUserConfig) fail('pack child userconfig is not isolated')
  let emptyRejected = false
  try {
    childEnvironment({ ['']: 'dsh-pack-gate-negative' })
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('<empty>')) throw error
    emptyRejected = true
  }
  if (!emptyRejected) fail('pack child environment accepted an empty override name')
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(label + ' is not valid JSON: ' + (error instanceof Error ? error.message : String(error)))
  }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function sha512(path) {
  return 'sha512-' + createHash('sha512').update(readFileSync(path)).digest('base64')
}

function assertRegularFile(path, label) {
  let stat
  try { stat = lstatSync(path) } catch { fail(label + ' is missing: ' + path) }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) fail(label + ' is not a non-empty regular file: ' + path)
  return stat
}

function archiveManifest(path, label) {
  const entries = run('tar', ['-tzf', path]).split(/\r?\n/u).filter(Boolean)
  const manifestPath = entries.find(entry => entry === 'package/package.json')
    ?? entries.find(entry => /^(?:[^/]+)\/package\.json$/u.test(entry))
  if (manifestPath === undefined) fail(label + ' has no package-root package.json')
  const packageRoot = manifestPath.slice(0, manifestPath.lastIndexOf('/'))
  const files = new Set()
  for (const entry of entries) {
    if (entry !== packageRoot && entry !== packageRoot + '/' && !entry.startsWith(packageRoot + '/')) {
      fail(label + ' contains an entry outside its package root: ' + entry)
    }
    if (entry.includes('\0') || entry.includes('..') || entry.includes('\\')) fail(label + ' contains an unsafe tar entry: ' + entry)
    if (/(?:^|\/)node_modules(?:\/|$)|(?:^|\/)\.git(?:\/|$)|(?:^|\/)pnpm-lock\.yaml$/u.test(entry)) fail(label + ' contains a forbidden tar entry: ' + entry)
    if (entry !== packageRoot && !entry.endsWith('/')) {
      const value = entry.slice(packageRoot.length + 1)
      if (files.has(value)) fail(label + ' contains a duplicate path: ' + value)
      files.add(value)
    }
  }
  const verbose = run('tar', ['-tvzf', path])
  if (/^(?:l|h)/mu.test(verbose) || / -> /u.test(verbose)) fail(label + ' contains a symbolic or hard link')
  const manifest = readJsonFromText(run('tar', ['-xOf', path, manifestPath]), label + ' package.json')
  if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') fail(label + ' has no package identity')
  return { manifest, files, manifestPath }
}

function readJsonFromText(text, label) {
  try { return JSON.parse(text) } catch (error) { fail(label + ' is not valid JSON: ' + (error instanceof Error ? error.message : String(error))) }
}

function cleanTarget(value, label, dotRequired = true) {
  if (typeof value !== 'string' || value.length === 0 || value.startsWith('/') || value.startsWith('\\') || (dotRequired && !value.startsWith('./'))) {
    fail(label + ' is not a relative export target: ' + String(value))
  }
  const target = value.startsWith('./') ? value.slice(2) : value
  if (!target || target.includes('..') || target.includes('*') || target.includes('\\') || target.startsWith('src/')) fail(label + ' is not a concrete shipped target: ' + value)
  return target
}

function collectExportTargets(value, label = 'exports') {
  if (typeof value === 'string') return [{ label, target: value }]
  if (Array.isArray(value)) return value.flatMap((entry, index) => collectExportTargets(entry, label + '[' + String(index) + ']'))
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([key, entry]) => collectExportTargets(entry, label + '.' + key))
  fail(label + ' has no concrete export target')
}

function dependencyMap(manifest) {
  const result = new Map()
  for (const section of DEPENDENCY_SECTIONS) for (const [name, spec] of Object.entries(manifest[section] ?? {})) result.set(name, spec)
  return result
}

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/u.exec(String(value).trim())
  if (match === null) return undefined
  return { major: Number(match[1]), minor: Number(match[2]), patch: match[3] === undefined ? 0 : Number(match[3]), partial: match[3] === undefined, prerelease: match[4] === undefined ? [] : match[4].split('.') }
}

function compareVersions(leftValue, rightValue) {
  const left = typeof leftValue === 'string' ? parseVersion(leftValue) : leftValue
  const right = typeof rightValue === 'string' ? parseVersion(rightValue) : rightValue
  if (left === undefined || right === undefined) return String(leftValue).localeCompare(String(rightValue))
  for (const field of ['major', 'minor', 'patch']) if (left[field] !== right[field]) return left[field] < right[field] ? -1 : 1
  if (left.prerelease.length === 0 && right.prerelease.length !== 0) return 1
  if (left.prerelease.length !== 0 && right.prerelease.length === 0) return -1
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
    const a = left.prerelease[index]
    const b = right.prerelease[index]
    if (a === undefined) return -1
    if (b === undefined) return 1
    if (a === b) continue
    const an = /^\d+$/u.test(a) ? Number(a) : undefined
    const bn = /^\d+$/u.test(b) ? Number(b) : undefined
    if (an !== undefined && bn !== undefined) return an < bn ? -1 : 1
    if (an !== undefined) return -1
    if (bn !== undefined) return 1
    return a < b ? -1 : 1
  }
  return 0
}

function satisfiesComparator(version, token) {
  const match = /^(\^|~|>=|<=|>|<)?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/u.exec(token.trim())
  if (match === null) return false
  const bound = { major: Number(match[2]), minor: match[3] === undefined ? 0 : Number(match[3]), patch: match[4] === undefined ? 0 : Number(match[4]), prerelease: match[5] === undefined ? [] : match[5].split('.') }
  const comparison = compareVersions(version, bound)
  const operator = match[1]
  if (operator === '>') return comparison > 0
  if (operator === '>=') return comparison >= 0
  if (operator === '<') return comparison < 0
  if (operator === '<=') return comparison <= 0
  if (operator === '^') {
    const upper = bound.major > 0 ? { major: bound.major + 1, minor: 0, patch: 0, prerelease: [] } : bound.minor > 0 ? { major: 0, minor: bound.minor + 1, patch: 0, prerelease: [] } : { major: 0, minor: 0, patch: bound.patch + 1, prerelease: [] }
    return comparison >= 0 && compareVersions(version, upper) < 0
  }
  if (operator === '~') return comparison >= 0 && compareVersions(version, match[3] === undefined
    ? { major: bound.major + 1, minor: 0, patch: 0, prerelease: [] }
    : { major: bound.major, minor: bound.minor + 1, patch: 0, prerelease: [] }) < 0
  if (match[4] === undefined) return comparison >= 0 && compareVersions(version, match[3] === undefined
    ? { major: bound.major + 1, minor: 0, patch: 0, prerelease: [] }
    : { major: bound.major, minor: bound.minor + 1, patch: 0, prerelease: [] }) < 0
  return comparison === 0
}

function satisfiesRange(version, range) {
  if (typeof range !== 'string') return false
  const value = range.trim()
  if (value === '*' || value === '') return true
  return value.split('||').some(alternative => {
    const tokens = alternative.match(/(?:\^|~|>=|<=|>|<)?\s*\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?/gu)
    return tokens !== null && tokens.length > 0 && tokens.every(token => satisfiesComparator(version, token))
  })
}

function checkDependencySpecs(manifest, label) {
  for (const section of DEPENDENCY_SECTIONS) {
    for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
      if (typeof spec !== 'string') fail(label + ' has a non-string ' + section + '.' + name)
      if (/^(?:file|link|workspace|npm|github|git\+|https?):/iu.test(spec) || spec.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(spec)) fail(label + ' contains a local or alias dependency at ' + section + '.' + name)
      if (name.startsWith('@deepseek-ai/dsh-') && label === 'packed package' && spec !== ALPHA_VERSION) fail(label + ' DSH dependency ' + name + ' is not pinned to ' + ALPHA_VERSION)
    }
  }
}

function checkPackedManifest(manifest, files) {
  if (manifest.name !== PACKAGE_NAME || manifest.version !== PACKAGE_VERSION) fail('packed package identity is wrong')
  checkDependencySpecs(manifest, 'packed package')
  if (manifest.main === undefined || manifest.types === undefined) fail('packed package must declare main and types')
  for (const [field, target] of [['main', manifest.main], ['types', manifest.types]]) if (!files.has(cleanTarget(target, 'packed package ' + field, false))) fail('packed package ' + field + ' target is missing')
  for (const { label, target } of collectExportTargets(manifest.exports)) if (!files.has(cleanTarget(target, 'packed package ' + label))) fail('packed package export target is missing: ' + target)
  if (JSON.stringify(manifest.exports) !== JSON.stringify({
    '.': { types: './lib/types/index.d.ts', default: './lib/index.js' },
    './client': { types: './lib/types/client/index.d.ts', default: './lib/client.js' },
    './invariant': { types: './lib/types/invariant.d.ts', default: './lib/invariant.js' },
    './package.json': './package.json',
  })) fail('packed package exports changed')
}

function packPlugin(work) {
  const output = join(work, 'pack')
  mkdirSync(output)
  run('pnpm', ['pack', '--pack-destination', output], { cwd: ROOT })
  const archives = readdirSync(output).filter(file => file.endsWith('.tgz'))
  if (archives.length !== 1) fail('pnpm pack did not produce one tarball')
  const archive = join(output, archives[0])
  const { manifest, files } = archiveManifest(archive, 'plugin tarball')
  for (const required of REQUIRED_FILES) if (!files.has(required)) fail('packed plugin is missing ' + required)
  for (const file of files) {
    if (!file || file.startsWith('/') || file.startsWith('../') || file.includes('/../') || file.includes('\\')
      || /^(?:src|tests|scripts|node_modules)\//u.test(file)
      || /(?:^|\/)\.(?:env|git|npmrc)(?:$|\.)/u.test(file)
      || (/(?:\.ts|\.tsx|\.map)$/u.test(file) && !file.endsWith('.d.ts'))) fail('packed plugin contains a private or source path: ' + file)
  }
  checkPackedManifest(manifest, files)
  return { archive, manifest, files }
}

function assertPortableLockKey(value, label, fallback) {
  if (typeof value !== 'string' || value.length === 0) fail(label + ' is empty')
  if (value.includes('\0') || value.includes('\\') || value.startsWith('/') || value.startsWith('//') || /^[A-Za-z]:[\\/]/u.test(value) || value.startsWith('file:')) {
    fail(label + ' contains a machine-specific path: ' + value)
  }
  if (value !== fallback && value !== 'root' && !value.startsWith('node_modules/')) {
    fail(label + ' is not a portable lock key: ' + value)
  }
}

function optionalPeer(manifest, field, name) {
  return field === 'peerDependencies' && manifest.peerDependenciesMeta?.[name]?.optional === true
}

function validateReachability(provenance, records, target) {
  const roots = provenance.roots
  const targetKey = target.name + '@' + target.version
  if (!Array.isArray(roots) || roots.length === 0 || new Set(roots).size !== roots.length || !roots.includes(targetKey)) {
    fail('fixture provenance roots do not identify the target package')
  }
  const manifests = new Map([[targetKey, target]])
  for (const root of roots) {
    if (root === targetKey) continue
    const record = records.get(root)
    if (record === undefined) fail('fixture provenance root is absent: ' + root)
    manifests.set(root, record.manifest)
  }
  const edgesByFrom = new Map()
  const edgeSignatures = new Set()
  for (const edge of provenance.edges ?? []) {
    if (!['dependencies', 'optionalDependencies', 'peerDependencies'].includes(edge.field)
      || typeof edge.from !== 'string' || typeof edge.name !== 'string' || edge.name.length === 0
      || typeof edge.range !== 'string' || typeof edge.to !== 'string'
      || typeof edge.fromLockKey !== 'string' || typeof edge.toLockKey !== 'string') fail('invalid provenance edge')
    assertPortableLockKey(edge.fromLockKey, 'provenance edge fromLockKey', edge.from)
    assertPortableLockKey(edge.toLockKey, 'provenance edge toLockKey', edge.to)
    const parent = manifests.get(edge.from) ?? records.get(edge.from)?.manifest
    if (parent === undefined) fail('provenance edge source is absent: ' + edge.from)
    const declared = parent[edge.field]?.[edge.name]
    if (declared === undefined || edge.range !== declared) fail('provenance edge range mismatch for ' + edge.from + ' > ' + edge.name)
    const child = records.get(edge.to)
    if (child === undefined || child.name !== edge.name || !satisfiesRange(child.version, edge.range)) fail('provenance edge target is absent or out of range: ' + edge.to)
    const signature = edge.from + '\0' + edge.field + '\0' + edge.name
    if (edgeSignatures.has(signature)) fail('duplicate provenance manifest edge: ' + edge.from + ' > ' + edge.name)
    edgeSignatures.add(signature)
    const outgoing = edgesByFrom.get(edge.from) ?? []
    outgoing.push(edge)
    edgesByFrom.set(edge.from, outgoing)
  }

  const reachable = new Set()
  const queue = [...roots]
  const visited = new Set()
  while (queue.length > 0) {
    const from = queue.shift()
    if (from === undefined || visited.has(from)) continue
    visited.add(from)
    const manifest = manifests.get(from) ?? records.get(from)?.manifest
    if (manifest === undefined) fail('fixture provenance reachability source is absent: ' + from)
    const outgoing = edgesByFrom.get(from) ?? []
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) {
        const matches = outgoing.filter(edge => edge.field === field && edge.name === name)
        if (matches.length === 0) {
          if (optionalPeer(manifest, field, name)) continue
          fail('provenance is missing manifest edge: ' + from + ' > ' + name)
        }
        if (matches.length !== 1) fail('provenance has duplicate manifest edges: ' + from + ' > ' + name)
        const child = records.get(matches[0].to)
        if (child === undefined || child.name !== name || !satisfiesRange(child.version, range)) fail('provenance edge target is invalid: ' + from + ' > ' + name)
        if (!reachable.has(matches[0].to)) {
          reachable.add(matches[0].to)
          queue.push(matches[0].to)
        }
      }
    }
    for (const edge of outgoing) {
      if (manifest[edge.field]?.[edge.name] === undefined) fail('provenance contains an undeclared manifest edge: ' + from + ' > ' + edge.name)
    }
  }
  const unreferenced = [...records.keys()].filter(key => !reachable.has(key))
  if (unreferenced.length > 0) fail('fixture archives are unreferenced from provenance roots: ' + unreferenced.join(', '))
  return [...(provenance.edges ?? [])]
}

function fixtureData() {
  const provenance = readJson(join(ROOT, 'fixtures', 'provenance.json'), 'fixture provenance')
  if (provenance.format !== 3 || provenance.source?.repository !== 'https://github.com/deepseek-ai/deepseek-harness.git'
    || provenance.source?.checkout !== 'dsh-alpha4-clean' || provenance.source?.revision !== ALPHA_REVISION
    || provenance.source?.packageVersion !== ALPHA_VERSION) fail('fixture provenance does not identify the clean alpha.4 source')
  const serialized = JSON.stringify(provenance)
  if (/(?:providersUi|provisional-input|staging|dsh-staging)/iu.test(serialized)) fail('fixture provenance contains owner or dirty-staging data')
  const packageDir = join(ROOT, 'fixtures', 'dsh-alpha4', 'packages')
  if (existsSync(join(ROOT, 'fixtures', 'providers-ui'))) fail('permanent Providers owner fixture directory exists')
  const files = readdirSync(packageDir).filter(file => file.endsWith('.tgz')).sort()
  if (!Array.isArray(provenance.packages) || provenance.packages.length !== files.length) fail('fixture package files and provenance records differ')
  const records = new Map()
  const byName = new Map()
  for (const record of provenance.packages) {
    if (typeof record.key !== 'string' || record.key !== record.name + '@' + record.version || records.has(record.key)) fail('invalid or duplicate fixture package identity')
    if (typeof record.archive !== 'string' || !record.archive.startsWith('dsh-alpha4/packages/') || record.archive.includes('..') || record.archive.includes('\\')) fail('invalid fixture archive path')
    const archiveName = record.archive.slice('dsh-alpha4/packages/'.length)
    if (!files.includes(archiveName)) fail('provenance names missing fixture archive: ' + archiveName)
    const archive = join(ROOT, 'fixtures', record.archive)
    const stat = assertRegularFile(archive, 'fixture archive')
    if (!Number.isSafeInteger(record.bytes) || record.bytes !== stat.size) fail('fixture byte-size mismatch for ' + record.key)
    if (record.sha256 !== sha256(archive) || !/^[0-9a-f]{64}$/u.test(record.sha256)) fail('fixture SHA-256 mismatch for ' + record.key)
    if (record.sha512 !== sha512(archive) || !/^sha512-[A-Za-z0-9+/]+=*$/u.test(record.sha512)) fail('fixture SHA-512 mismatch for ' + record.key)
    const { manifest } = archiveManifest(archive, 'fixture ' + record.key)
    if (manifest.name !== record.name || manifest.version !== record.version) fail('fixture manifest identity mismatch for ' + record.key)
    if (JSON.stringify(manifest) !== JSON.stringify(record.manifest)) fail('fixture manifest provenance mismatch for ' + record.key)
    if (record.name.startsWith('@deepseek-ai/dsh-') && record.version !== ALPHA_VERSION) fail('fixture DSH package is not alpha.4: ' + record.key)
    if (record.source?.kind !== 'official-alpha4' && record.source?.kind !== 'npm-registry') fail('fixture source kind is invalid for ' + record.key)
    if (record.source.kind === 'official-alpha4' && (record.source.checkout !== 'dsh-alpha4-clean' || record.source.revision !== ALPHA_REVISION)) fail('official fixture source provenance is invalid for ' + record.key)
    if (record.source.kind === 'npm-registry' && (!Array.isArray(record.source.lockKeys) || record.source.lockKeys.length === 0 || typeof record.source.resolved !== 'string' || !record.source.resolved.startsWith('https://registry.npmjs.org/'))) fail('registry fixture source provenance is incomplete for ' + record.key)
    if (Array.isArray(record.source.lockKeys)) {
      for (const lockKey of record.source.lockKeys) assertPortableLockKey(lockKey, 'fixture ' + record.key + ' lockKey', record.key)
    }
    records.set(record.key, { ...record, archive })
    const candidates = byName.get(record.name) ?? []
    candidates.push({ ...record, archive })
    byName.set(record.name, candidates)
  }
  if (new Set([...records.values()].map(record => record.archive)).size !== files.length) fail('fixture archives are duplicated in provenance')
  if (files.some(file => ![...records.values()].some(record => record.archive.endsWith('/' + file)))) fail('fixture archive has no provenance record')
  for (const candidates of byName.values()) candidates.sort((left, right) => compareVersions(left.version, right.version))
  const edges = provenance.edges
  if (!Array.isArray(edges)) fail('fixture provenance has no explicit dependency edges')
  validateReachability(provenance, records, readJson(join(ROOT, 'package.json'), 'target package.json'))
  const multiVersionNames = new Set()
  for (const item of byName.values()) if (item.length > 1) multiVersionNames.add(item[0].manifest.name)
  if (multiVersionNames.size === 0) fail('fixture graph has no multi-version package')
  return { provenance, records, byName }
}

function staticSpecifiers(source) {
  const result = new Set()
  for (const pattern of [
    /\bfrom\s*["']([^"']+)["']/gu,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/gu,
  ]) for (const match of source.matchAll(pattern)) result.add(match[1])
  return result
}

function packageName(specifier) {
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
}

function fileExists(path) {
  try { return statSync(path).isFile() } catch { return false }
}

function checkStaticClosure(installedRoot, consumer, manifest) {
  const declared = dependencyMap(manifest)
  const requireFromInstalled = createRequire(pathToFileURL(join(installedRoot, 'lib', 'index.js')))
  const files = []
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile() && /\.(?:c|m)?js$/u.test(entry.name)) files.push(path)
    }
  }
  visit(join(installedRoot, 'lib'))
  for (const file of files) {
    const packagePath = relative(installedRoot, file).split(sep).join('/')
    for (const specifier of staticSpecifiers(readFileSync(file, 'utf8'))) {
      if (BUILTIN_MODULES.has(specifier)) continue
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        if (specifier.startsWith('/')) fail('packed JS has an absolute import ' + specifier)
        const normalized = posix.normalize(posix.join(posix.dirname(packagePath), specifier))
        if (normalized.startsWith('../') || normalized === '..') fail('packed JS escapes package root in ' + packagePath)
        const candidates = [normalized, normalized + '.js', normalized + '.mjs', normalized + '.cjs', posix.join(normalized, 'index.js')]
        if (!candidates.some(candidate => fileExists(join(installedRoot, ...candidate.split('/'))))) fail('packed JS has an unresolved relative import ' + specifier + ' in ' + packagePath)
        continue
      }
      const name = packageName(specifier)
      if (name === PACKAGE_NAME) fail('packed JS retains a self import: ' + specifier)
      if (name === 'dsh-llm-providers-ui') fail('packed browser JS retains the Providers owner import: ' + specifier)
      if (!declared.has(name)) fail('packed JS imports undeclared package ' + specifier)
      try { requireFromInstalled.resolve(specifier) } catch {
        try { import.meta.resolve(specifier, pathToFileURL(file).href) }
        catch { fail('packed JS import is not installed: ' + specifier) }
      }
    }
  }
}

function ownerInput() {
  const pathInput = process.env.DSH_LLM_PROVIDERS_UI_ARTIFACT ?? process.env.DSH_PROVIDERS_UI_ARTIFACT ?? process.env.DSH_PROVIDERS_UI_TARBALL
  const expected = (process.env.DSH_LLM_PROVIDERS_UI_SHA256 ?? process.env.DSH_PROVIDERS_UI_SHA256)?.toLowerCase()
  if (pathInput === undefined || expected === undefined || !/^[0-9a-f]{64}$/u.test(expected)) fail('Providers owner artifact and DSH_LLM_PROVIDERS_UI_SHA256 are required')
  const path = resolve(pathInput)
  if (path.startsWith(ROOT + sep) || !path.endsWith('-' + expected + '.tgz')) fail('Providers owner input must be external and content-addressed')
  const stat = assertRegularFile(path, 'Providers owner artifact')
  if (sha256(path) !== expected) fail('Providers owner SHA-256 mismatch')
  const { manifest } = archiveManifest(path, 'Providers owner artifact')
  if (manifest.name !== 'dsh-llm-providers-ui' || manifest.version !== '0.1.3') fail('Providers owner artifact identity is wrong')
  return { path, manifest, bytes: stat.size, sha256: expected }
}

function selectCandidate(byName, name, range, owner) {
  if (name === owner.manifest.name) return undefined
  const candidates = (byName.get(name) ?? []).filter(record => satisfiesRange(record.version, range))
  if (candidates.length === 0) fail('no fixture matches ' + name + '@' + String(range))
  return candidates[candidates.length - 1]
}

function createConsumer(work, packed, owner, fixture) {
  const consumer = join(work, 'consumer')
  const store = join(work, 'store')
  mkdirSync(consumer)
  mkdirSync(store)
  if (readdirSync(store).length !== 0) fail('fresh pnpm store is not empty')
  const rootManifest = readJson(join(ROOT, 'package.json'), 'target package.json')
  const dependencies = new Map([
    [PACKAGE_NAME, 'file:' + packed.archive],
    [owner.manifest.name, 'file:' + owner.path],
  ])
  for (const section of ['peerDependencies', 'dependencies', 'optionalDependencies']) {
    for (const [name, range] of Object.entries(rootManifest[section] ?? {})) {
      const candidate = selectCandidate(fixture.byName, name, range, owner)
      if (candidate !== undefined) dependencies.set(name, 'file:' + candidate.archive)
    }
    for (const [name, range] of Object.entries(owner.manifest[section] ?? {})) {
      const candidate = selectCandidate(fixture.byName, name, range, owner)
      if (candidate !== undefined) dependencies.set(name, 'file:' + candidate.archive)
    }
  }
  const directEdges = new Map()
  for (const edge of fixture.provenance.edges) {
    const child = fixture.records.get(edge.to)
    if (child === undefined) continue
    const previous = directEdges.get(child.name)
    if (previous === undefined || compareVersions(previous.version, child.version) < 0) directEdges.set(child.name, child)
  }
  for (const [name, child] of directEdges) {
    if (!dependencies.has(name)) dependencies.set(name, 'file:' + child.archive)
  }
  const overrides = {}
  for (const [name, candidates] of fixture.byName) {
    overrides[name] = 'file:' + candidates[candidates.length - 1].archive
  }
  for (const edge of fixture.provenance.edges) {
    if (edge.from === fixture.provenance.roots?.[0]) continue
    const child = fixture.records.get(edge.to)
    if (child !== undefined) overrides[edge.from + '>' + edge.name] = 'file:' + child.archive
  }
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({
    name: 'dsh-llm-opencode-go-pack-consumer',
    private: true,
    type: 'module',
    dependencies: Object.fromEntries([...dependencies].sort(([left], [right]) => left.localeCompare(right))),
    pnpm: { overrides },
  }, null, 2) + '\n')
  writeFileSync(join(consumer, '.npmrc'), 'registry=' + INVALID_REGISTRY + '\n')
  return { consumer, store }
}

function startRegistry(owner) {
  const child = spawn(process.execPath, ['scripts/fixture-registry.mjs'], {
    cwd: ROOT,
    env: childEnvironment({ DSH_PROVIDERS_UI_ARTIFACT: owner.path, DSH_PROVIDERS_UI_SHA256: owner.sha256 }),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return new Promise((resolvePromise, rejectPromise) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (value, error) => {
      if (settled) return
      settled = true
      if (error !== undefined) rejectPromise(error)
      else resolvePromise({ child, url: value })
    }
    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
      const match = /http:\/\/127\.0\.0\.1:\d+/u.exec(stdout)
      if (match !== null) finish(match[0])
    })
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.once('error', error => finish(undefined, error))
    child.once('exit', (code, signal) => {
      if (!settled) finish(undefined, new Error('fixture registry exited before binding (' + String(code) + ', ' + String(signal) + ')\n' + stderr))
    })
  })
}

function isMissing(error) {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
}

function safeRemoveTree(target) {
  let rootStat
  try { rootStat = lstatSync(target) } catch (error) {
    if (isMissing(error)) return
    throw error
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    rmSync(target, { force: true })
    return
  }
  const rootReal = realpathSync(target)
  const visit = path => {
    let stat
    try { stat = lstatSync(path) } catch (error) {
      if (isMissing(error)) return
      throw error
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      rmSync(path, { force: true })
      return
    }
    const resolved = realpathSync(path)
    if (resolved !== rootReal && !resolved.startsWith(rootReal + sep)) {
      throw new Error('refusing to clean directory outside pack work root: ' + path)
    }
    for (const entry of readdirSync(path)) visit(join(path, entry))
    rmdirSync(path)
  }
  visit(target)
}

async function stopRegistry(registry) {
  if (registry === undefined) return
  const child = registry.child
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise((resolvePromise, rejectPromise) => {
    let settled = false
    const finish = (error) => {
      if (settled) return
      settled = true
      child.removeListener('exit', onExit)
      child.removeListener('error', onError)
      if (error === undefined) resolvePromise()
      else rejectPromise(error)
    }
    const onExit = () => finish()
    const onError = error => finish(error)
    child.once('exit', onExit)
    child.once('error', onError)
    if (!child.kill('SIGTERM')) {
      if (child.exitCode !== null || child.signalCode !== null) finish()
      else finish(new Error('could not stop fixture registry'))
    }
  })
}

function smokeFactories(consumer, installedRoot) {
  const smoke = join(consumer, 'factory-smoke.mjs')
  writeFileSync(smoke, [
    "import { createRequire } from 'node:module'",
    "import { Context } from '@deepseek-ai/cordis'",
    "import LlmRuntime from '@deepseek-ai/dsh-llm'",
    "import * as host from 'dsh-llm-opencode-go'",
    "import * as invariant from 'dsh-llm-opencode-go/invariant'",
    "import { readFile } from 'node:fs/promises'",
    "import vm from 'node:vm'",
    "import { join } from 'node:path'",
    "const requireFromConsumer = createRequire(join(process.cwd(), 'factory-smoke.mjs'))",
    "if (typeof host.apply !== 'function' || (typeof host.Config !== 'object' && typeof host.Config !== 'function')) throw new Error('Host exports missing')",
    "const bad = () => host.apply(new Context(), { remoteManagement: true })",
    "if (!(() => { try { bad(); return false } catch (error) { return String(error).includes('remoteManagement is unsupported by the Alpha.4 Host RPC') } })()) throw new Error('remoteManagement rejection missing')",
    "if (typeof invariant.assertOpenCodeGoInvariant !== 'function') throw new Error('invariant export missing')",
    "invariant.assertOpenCodeGoInvariant(true, 'factory')",
    "const ctx = new Context()",
    "await ctx.plugin(LlmRuntime).await()",
    "const calls = []",
    "ctx.provide('connection', { rpc: { handle(...args) { calls.push(args); return () => Promise.resolve() } } })",
    "ctx.provide('credentials', { resolve: async () => ({ value: 'factory-key' }) })",
    "const fiber = ctx.plugin({ inject: host.inject, Config: host.Config, apply: host.apply }, {})",
    "await fiber.await()",
    "if (calls.length !== 1 || calls[0].length !== 2 || typeof calls[0][1] !== 'function') throw new Error('Host RPC registration is not alpha.4 two-argument')",
    "await fiber.dispose()",
    "await ctx.fiber.dispose()",
    "const browserSource = await readFile(join(process.cwd(), 'node_modules', 'dsh-llm-opencode-go', 'lib', 'client.js'), 'utf8')",
    "const rows = []",
    "vm.runInNewContext(browserSource, { window: { __ModuleLoader__: { load(row) { rows.push(row) } } } }, { filename: 'installed-client.js' })",
    "if (rows.length !== 1 || rows[0].id !== 'dsh-llm-opencode-go' || typeof rows[0].factory !== 'function') throw new Error('browser ModuleLoader factory missing')",
    "const required = []",
    "const client = rows[0].factory(specifier => { required.push(specifier); if (specifier === 'dsh-llm-providers-ui' || specifier.startsWith('dsh-llm-providers-ui/')) throw new Error('browser factory imported owner'); return requireFromConsumer(specifier) })",
    "if (typeof client.apply !== 'function' || client.name !== 'dsh-llm-opencode-go-client') throw new Error('browser client exports missing')",
    "client.apply({ effect() {}, locale: { register() { return () => {} }, bind() { return key => key } }, reflect: { get() { return { rpc: { call: async () => ({ ok: false, error: { message: 'not called' } }) } } } }, slots: { inject() {}, entries() { return [] }, subscribe() { return () => {} } } })",
    "if (required.some(specifier => specifier === 'dsh-llm-providers-ui' || specifier.startsWith('dsh-llm-providers-ui/'))) throw new Error('browser factory retained owner require')",
    "console.log('Host, invariant, and browser factories passed')",
  ].join('\n'))
  run(process.execPath, [smoke], { cwd: consumer })
  if (!existsSync(installedRoot)) fail('installed plugin root is missing after factory smoke')
}

async function main() {
  const work = mkdtempSync(join(tmpdir(), 'dsh-llm-opencode-go-pack-'))
  childUserConfig = join(work, 'npmrc')
  let registry
  let primaryFailure = false
  try {
    writeFileSync(childUserConfig, '# isolated pack-gate userconfig\n')
    verifyChildEnvironment()
    const owner = ownerInput()
    const fixture = fixtureData()
    const packed = packPlugin(work)
    registry = await startRegistry(owner)
    process.env.DSH_FIXTURE_REGISTRY_URL = registry.url
    const consumer = createConsumer(work, packed, owner, fixture)
    run('pnpm', ['install', '--offline', '--ignore-scripts', '--no-frozen-lockfile', '--registry=' + INVALID_REGISTRY, '--store-dir', consumer.store], { cwd: consumer.consumer })
    const installedRoot = join(consumer.consumer, 'node_modules', PACKAGE_NAME)
    if (!existsSync(join(installedRoot, 'package.json'))) fail('initial pnpm install did not install the plugin')
    checkStaticClosure(installedRoot, consumer.consumer, packed.manifest)
    await stopRegistry(registry)
    registry = undefined
    safeRemoveTree(join(consumer.consumer, 'node_modules'))
    run('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts', '--registry=' + INVALID_REGISTRY, '--store-dir', consumer.store], { cwd: consumer.consumer })
    if (!existsSync(join(installedRoot, 'package.json'))) fail('offline pnpm install did not install the plugin')
    checkStaticClosure(installedRoot, consumer.consumer, packed.manifest)
    smokeFactories(consumer.consumer, installedRoot)
    console.log('strict pack gate passed: real tarball, fixture closure, fresh-store offline install, and factory smokes')
  } catch (error) {
    primaryFailure = true
    throw error
  } finally {
    const cleanupErrors = []
    try { await stopRegistry(registry) } catch (error) { cleanupErrors.push(error) }
    if (process.env.DSH_KEEP_PACK_WORK !== '1') {
      try { safeRemoveTree(work) } catch (error) { cleanupErrors.push(error) }
    }
    if (cleanupErrors.length > 0) {
      const detail = cleanupErrors.map(error => error instanceof Error ? error.message : String(error)).join('; ')
      if (primaryFailure) console.error('pack gate cleanup failed after primary error: ' + detail)
      else throw new Error('pack gate cleanup failed: ' + detail)
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
