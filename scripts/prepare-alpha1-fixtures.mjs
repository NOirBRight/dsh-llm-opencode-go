#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OFFICIAL_ALPHA1_CHECKOUT = resolve(process.env.DSH_ALPHA1_CLEAN_CHECKOUT ?? join(ROOT, '..', '.dsh-decoupling-artifacts', 'dsh-alpha1-clean'))
const OFFICIAL_ALPHA1_VERSION = '0.1.2-alpha.1'
const OFFICIAL_ALPHA1_TAG = 'dsh-v0.1.2-alpha.1'
const OFFICIAL_ALPHA1_REVISION = 'cd5ef8148158c3a752a658978873241fdf8e2bbc'
const FIXTURE_ROOT = join(ROOT, 'fixtures', 'dsh-alpha1')
const FIXTURE_PACKAGE_DIR = join(FIXTURE_ROOT, 'packages')
const PROVENANCE_PATH = join(ROOT, 'fixtures', 'provenance.json')
const DEPENDENCY_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies']
const GRAPH_FIELDS = ['dependencies', 'optionalDependencies', 'devDependencies', 'peerDependencies']

function fail(message) {
  throw new Error('fixture preparation failed: ' + message)
}

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: options.cwd ?? ROOT,
      encoding: 'utf8',
      stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...(options.env ?? {}) },
    })
  } catch (error) {
    const text = value => typeof value === 'string' ? value : Buffer.isBuffer(value) ? value.toString('utf8') : ''
    const stdout = text(error?.stdout)
    const stderr = text(error?.stderr)
    fail(command + ' ' + args.join(' ') + ' failed\n' + stdout + stderr)
  }
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(label + ' is invalid: ' + (error instanceof Error ? error.message : String(error)))
  }
}

function packageKey(name, version) {
  return name + '@' + version
}

function portableLockKey(value, fallback) {
  const normalized = String(value ?? fallback).replaceAll('\\', '/')
  const nodeModules = normalized.indexOf('node_modules/')
  if (nodeModules >= 0) return normalized.slice(nodeModules)
  if (/^(?:\/|[A-Za-z]:[\/])/u.test(normalized)) return fallback
  return normalized || fallback
}

function hashFile(path, algorithm, encoding) {
  return createHash(algorithm).update(readFileSync(path)).digest(encoding)
}

function assertRegularFile(path, label) {
  let stat
  try {
    stat = lstatSync(path)
  } catch {
    fail(label + ' is missing: ' + path)
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) fail(label + ' is not a non-empty regular file: ' + path)
  return stat
}

function assertNoAlias(value, label) {
  if (typeof value !== 'string') return
  if (/^(?:file|link|workspace|github|git\+|https?):/iu.test(value) || value.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(value)) {
    fail(label + ' contains a source or URL dependency: ' + value)
  }
}

function assertManifestDependencies(manifest, label) {
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, value] of Object.entries(manifest[field] ?? {})) assertNoAlias(value, label + '.' + field + '.' + name)
  }
}

function assertArchive(path, label) {
  assertRegularFile(path, label)
  const listing = run('tar', ['-tzf', path])
  const entries = listing.split(/\r?\n/u).filter(Boolean)
  const manifestEntry = entries.find(entry => entry === 'package/package.json')
    ?? entries.find(entry => /^(?:[^/]+)\/package\.json$/u.test(entry))
  if (manifestEntry === undefined) fail(label + ' has no package-root package.json entry')
  const packageRoot = manifestEntry.slice(0, manifestEntry.lastIndexOf('/'))
  for (const entry of entries) {
    if ((entry !== packageRoot && entry !== packageRoot + '/' && !entry.startsWith(packageRoot + '/')) || entry.includes('\0') || entry.includes('..')) fail(label + ' contains an unsafe tar entry: ' + entry)
    if (/(?:^|\/)node_modules(?:\/|$)|(?:^|\/)\.git(?:\/|$)|(?:^|\/)pnpm-lock\.yaml$/u.test(entry)) fail(label + ' contains forbidden entry: ' + entry)
  }
  const verbose = run('tar', ['-tvzf', path])
  if (/^(?:l|h)/mu.test(verbose) || / -> /u.test(verbose)) fail(label + ' contains a link entry')
  const manifest = readJsonFromText(run('tar', ['-xOf', path, manifestEntry]), label + ' package.json')
  if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') fail(label + ' package.json has no exact identity')
  assertManifestDependencies(manifest, label + ' package.json')
  return { manifest, bytes: statSync(path).size, sha256: hashFile(path, 'sha256', 'hex'), sha512: 'sha512-' + hashFile(path, 'sha512', 'base64') }
}

function readJsonFromText(text, label) {
  try {
    return JSON.parse(text)
  } catch (error) {
    fail(label + ' is invalid: ' + (error instanceof Error ? error.message : String(error)))
  }
}

function sourceStatus() {
  return run('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: OFFICIAL_ALPHA1_CHECKOUT }).trim()
}

function assertOfficialCheckout() {
  if (!existsSync(join(OFFICIAL_ALPHA1_CHECKOUT, 'package.json'))) fail('official alpha.1 checkout is missing: ' + OFFICIAL_ALPHA1_CHECKOUT)
  if (sourceStatus() !== '') fail('official alpha.1 checkout is dirty')
  const rootManifest = readJson(join(OFFICIAL_ALPHA1_CHECKOUT, 'package.json'), 'official alpha.1 root package.json')
  if (rootManifest.version !== OFFICIAL_ALPHA1_VERSION) fail('official alpha.1 root version is not ' + OFFICIAL_ALPHA1_VERSION)
  const revision = run('git', ['rev-parse', 'HEAD'], { cwd: OFFICIAL_ALPHA1_CHECKOUT }).trim()
  if (revision !== OFFICIAL_ALPHA1_REVISION) fail('official alpha.1 revision is not ' + OFFICIAL_ALPHA1_REVISION)
  const tag = run('git', ['describe', '--exact-match', '--tags', 'HEAD'], { cwd: OFFICIAL_ALPHA1_CHECKOUT }).trim()
  if (tag !== OFFICIAL_ALPHA1_TAG) fail('official alpha.1 checkout is not at ' + OFFICIAL_ALPHA1_TAG)
  const remote = run('git', ['config', '--get', 'remote.origin.url'], { cwd: OFFICIAL_ALPHA1_CHECKOUT }).trim()
  if (remote !== 'https://github.com/deepseek-ai/deepseek-harness.git') fail('official alpha.1 checkout has an unexpected origin')
}

function collectSourcePackages() {
  const output = new Map()
  for (const group of ['packages', 'vendor']) {
    const start = join(OFFICIAL_ALPHA1_CHECKOUT, group)
    const visit = directory => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue
        const path = join(directory, entry.name)
        if (entry.isDirectory()) visit(path)
        else if (entry.name === 'package.json') {
          try {
            const manifest = JSON.parse(readFileSync(path, 'utf8'))
            if (typeof manifest.name === 'string') output.set(manifest.name, { directory, manifest })
          } catch {
            // Ignore non-package JSON files.
          }
        }
      }
    }
    visit(start)
  }
  return output
}

function ownerInput() {
  const path = process.env.DSH_LLM_PROVIDERS_UI_ARTIFACT ?? process.env.DSH_PROVIDERS_UI_ARTIFACT ?? process.env.DSH_PROVIDERS_UI_TARBALL
  const expected = (process.env.DSH_LLM_PROVIDERS_UI_SHA256 ?? process.env.DSH_PROVIDERS_UI_SHA256)?.toLowerCase()
  if (path === undefined || expected === undefined) fail('Providers owner artifact and DSH_LLM_PROVIDERS_UI_SHA256 are required for this temporary run')
  if (!/^[0-9a-f]{64}$/u.test(expected)) fail('DSH_LLM_PROVIDERS_UI_SHA256 must be a lowercase SHA-256 digest')
  const resolved = resolve(path)
  if (resolved.startsWith(ROOT + sep)) fail('Providers owner input must be external to this checkout')
  const name = resolved.split(sep).at(-1) ?? ''
  if (!name.endsWith('-' + expected + '.tgz')) fail('Providers owner input filename must carry its supplied SHA-256')
  const archive = assertArchive(resolved, 'Providers owner artifact')
  if (archive.sha256 !== expected) fail('Providers owner SHA-256 does not match DSH_LLM_PROVIDERS_UI_SHA256')
  if (archive.manifest.name !== 'dsh-llm-providers-ui' || archive.manifest.version !== '0.1.1') fail('Providers owner artifact must be dsh-llm-providers-ui@0.1.1')
  return { path: resolved, manifest: archive.manifest }
}

function graphData() {
  const text = run('pnpm', ['list', '--json', '--depth', 'Infinity', '--lockfile-only'], { cwd: ROOT })
  const root = readJsonFromText(text, 'pnpm lock graph')
  if (!Array.isArray(root) || root[0] === undefined) fail('pnpm lock graph is empty')
  const rootNode = root[0]
  const nodes = new Map()
  const edges = new Map()
  const seen = new WeakSet()
  const identity = node => typeof node?.from === 'string' && typeof node?.version === 'string' ? packageKey(node.from, node.version) : undefined
  const visit = node => {
    if (node === null || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    const key = identity(node)
    if (key !== undefined) {
      const records = nodes.get(key) ?? []
      records.push(node)
      nodes.set(key, records)
      const outgoing = edges.get(key) ?? []
      for (const field of GRAPH_FIELDS) {
        for (const [name, child] of Object.entries(node[field] ?? {})) {
          const childKey = identity(child)
          if (childKey === undefined) continue
          outgoing.push({ field, name, childKey, fromLockKey: portableLockKey(node.path, key), toLockKey: portableLockKey(child.path, childKey) })
          visit(child)
        }
      }
      edges.set(key, outgoing)
    } else {
      for (const field of GRAPH_FIELDS) for (const child of Object.values(node[field] ?? {})) visit(child)
    }
  }
  visit(rootNode)
  for (const [key, outgoing] of edges) {
    const unique = new Map(outgoing.map(edge => [JSON.stringify(edge), edge]))
    edges.set(key, [...unique.values()])
  }
  return { root: rootNode, nodes, edges }
}

function topLevelNode(root, name) {
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const candidate = root[field]?.[name]
    if (candidate !== undefined && typeof candidate === 'object') return candidate
  }
  return undefined
}

function graphClosure(graph, target, ownerManifest) {
  const roots = []
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(target[field] ?? {})) {
      const node = topLevelNode(graph.root, name)
      if (node !== undefined) roots.push(node)
    }
  }
  const ownerNode = topLevelNode(graph.root, ownerManifest.name)
  if (ownerNode !== undefined) roots.push(ownerNode)
  const selected = new Set()
  const queue = roots.map(node => packageKey(node.from, node.version))
  while (queue.length > 0) {
    const key = queue.shift()
    if (key === undefined || selected.has(key)) continue
    selected.add(key)
    for (const edge of graph.edges.get(key) ?? []) if (!selected.has(edge.childKey)) queue.push(edge.childKey)
  }
  return { roots, selected }
}

function officialNames(sourcePackages, selected) {
  const names = new Set()
  for (const key of selected) {
    const at = key.lastIndexOf('@')
    const name = key.slice(0, at)
    if (name.startsWith('@deepseek-ai/') && sourcePackages.has(name)) names.add(name)
  }
  return names
}

function archiveName(name, version) {
  const stem = name.startsWith('@') ? name.slice(1).replaceAll('/', '-') : name.replaceAll('/', '-')
  return stem + '-' + version + '.tgz'
}

function packOfficial(name, sourceRecord, destination) {
  const temporary = mkdtempSync(join(destination, '.alpha-pack-'))
  try {
    run('pnpm', ['pack', '--pack-destination', temporary], {
      cwd: sourceRecord.directory,
      env: { npm_config_ignore_scripts: 'true' },
      stdio: 'ignore',
    })
    const archives = readdirSync(temporary).filter(file => file.endsWith('.tgz'))
    if (archives.length !== 1) fail('official package did not produce exactly one archive: ' + name)
    const archive = join(temporary, archives[0])
    const manifest = assertArchive(archive, 'official alpha.1 ' + name).manifest
    if (manifest.name !== name || manifest.version !== sourceRecord.manifest.version) fail('official archive identity mismatch for ' + name)
    const destinationPath = join(destination, archiveName(name, manifest.version))
    copyFileSync(archive, destinationPath)
    return destinationPath
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}

function packRegistry(name, version, destination) {
  const temporary = mkdtempSync(join(destination, '.registry-pack-'))
  try {
    let packed = false
    for (let attempt = 0; attempt < 5 && !packed; attempt += 1) {
      try {
        run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary, name + '@' + version], {
          cwd: ROOT,
          env: { npm_config_registry: 'https://registry.npmjs.org' },
          stdio: 'ignore',
        })
        packed = true
      } catch (error) {
        if (attempt === 4) throw error
      }
    }
    const archives = readdirSync(temporary).filter(file => file.endsWith('.tgz'))
    if (archives.length !== 1) fail('registry package did not produce exactly one archive: ' + name + '@' + version)
    const archive = join(temporary, archives[0])
    const manifest = assertArchive(archive, 'registry ' + name + '@' + version).manifest
    if (manifest.name !== name || manifest.version !== version) fail('registry archive identity mismatch for ' + name + '@' + version)
    const destinationPath = join(destination, archiveName(name, version))
    copyFileSync(archive, destinationPath)
    return destinationPath
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}

function edgeRange(parentManifest, field, name) {
  return parentManifest[field]?.[name]
}

function main() {
  assertOfficialCheckout()
  const owner = ownerInput()
  const target = readJson(join(ROOT, 'package.json'), 'target package.json')
  const sourcePackages = collectSourcePackages()
  const graph = graphData()
  const closure = graphClosure(graph, target, owner.manifest)
  const names = officialNames(sourcePackages, closure.selected)
  rmSync(FIXTURE_PACKAGE_DIR, { recursive: true, force: true })
  mkdirSync(FIXTURE_PACKAGE_DIR, { recursive: true })
  rmSync(join(ROOT, 'fixtures', 'providers-ui'), { recursive: true, force: true })
  const archives = new Map()
  for (const name of [...names].sort()) {
    const sourceRecord = sourcePackages.get(name)
    if (sourceRecord === undefined) fail('no official alpha.1 package source for ' + name)
    const path = packOfficial(name, sourceRecord, FIXTURE_PACKAGE_DIR)
    const archive = assertArchive(path, 'prepared official package ' + name)
    archives.set(packageKey(archive.manifest.name, archive.manifest.version), { path, archive, source: { kind: 'official-alpha1', checkout: 'dsh-alpha1-clean', revision: OFFICIAL_ALPHA1_REVISION } })
  }
  const ownerKey = packageKey(owner.manifest.name, owner.manifest.version)
  for (const key of [...closure.selected].sort()) {
    if (key === ownerKey || archives.has(key)) continue
    const records = graph.nodes.get(key)
    const selected = records?.find(record => typeof record.resolved === 'string') ?? records?.[0]
    if (selected === undefined) fail('lock graph has no package record for ' + key)
    const path = packRegistry(selected.from, selected.version, FIXTURE_PACKAGE_DIR)
    const archive = assertArchive(path, 'prepared registry package ' + key)
    archives.set(key, { path, archive, source: { kind: 'npm-registry', registry: 'https://registry.npmjs.org', resolved: selected.resolved ?? null, lockKeys: records?.map(record => portableLockKey(record.path, key)).sort() ?? [] } })
  }
  const packages = [...archives.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => ({
    key,
    name: value.archive.manifest.name,
    version: value.archive.manifest.version,
    archive: 'dsh-alpha1/packages/' + value.path.split(sep).at(-1),
    bytes: value.archive.bytes,
    sha256: value.archive.sha256,
    sha512: value.archive.sha512,
    source: value.source,
    manifest: value.archive.manifest,
  }))
  const packageByKey = new Map(packages.map(record => [record.key, record]))
  const edges = []
  const addEdge = (from, fromLockKey, field, name, childKey, toLockKey) => {
    if (!packageByKey.has(childKey) || childKey === ownerKey) return
    const parent = packageByKey.get(from)
    let declaredField = field
    let range = parent === undefined ? target[field]?.[name] : edgeRange(parent.manifest, field, name)
    if (range === undefined && parent !== undefined) {
      declaredField = DEPENDENCY_FIELDS.find(candidate => parent.manifest[candidate]?.[name] !== undefined) ?? field
      range = edgeRange(parent.manifest, declaredField, name)
    }
    edges.push({ from, fromLockKey, field: declaredField, name, range: range ?? null, to: childKey, toLockKey })
  }
  for (const key of closure.selected) {
    if (key === ownerKey || !packageByKey.has(key)) continue
    for (const edge of graph.edges.get(key) ?? []) addEdge(key, edge.fromLockKey, edge.field, edge.name, edge.childKey, edge.toLockKey)
  }
  const rootKey = packageKey(target.name, target.version)
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(target[field] ?? {})) {
      const node = topLevelNode(graph.root, name)
      if (node === undefined) continue
      addEdge(rootKey, 'root', field, name, packageKey(node.from, node.version), portableLockKey(node.path, packageKey(node.from, node.version)))
    }
  }
  const uniqueEdges = new Map(edges.map(edge => [JSON.stringify(edge), edge]))
  const provenance = {
    format: 3,
    source: {
      repository: 'https://github.com/deepseek-ai/deepseek-harness.git',
      checkout: 'dsh-alpha1-clean',
      revision: OFFICIAL_ALPHA1_REVISION,
      packageVersion: OFFICIAL_ALPHA1_VERSION,
    },
    roots: [rootKey],
    packages,
    edges: [...uniqueEdges.values()].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  }
  writeFileSync(PROVENANCE_PATH, JSON.stringify(provenance, null, 2) + '\n')
  assertOfficialCheckout()
  console.log('prepared ' + String(packages.length) + ' exact alpha.1 and registry fixture archives')
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
