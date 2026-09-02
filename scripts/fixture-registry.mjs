#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const provenancePath = join(root, 'fixtures', 'provenance.json')
const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'))
const packageRecords = new Map()
const tarballs = new Map()

function fail(message) {
  throw new Error('fixture registry failed: ' + message)
}

function packageKey(name, version) {
  return name + '@' + version
}

function packageManifestFromArchive(path) {
  const entries = execFileSync('tar', ['-tzf', path], { encoding: 'utf8' }).split(/\r?\n/u).filter(Boolean)
  const manifestPath = entries.find(entry => entry === 'package/package.json')
    ?? entries.find(entry => /^(?:[^/]+)\/package\.json$/u.test(entry))
  if (manifestPath === undefined) fail('archive has no package-root package.json: ' + path)
  return JSON.parse(execFileSync('tar', ['-xOf', path, manifestPath], { encoding: 'utf8' }))
}

function addRecord(manifest, path, source) {
  let stat
  try {
    stat = lstatSync(path)
  } catch {
    fail('missing ' + source + ' archive: ' + path)
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) fail('invalid ' + source + ' archive: ' + path)
  const bytes = readFileSync(path)
  const key = packageKey(manifest.name, manifest.version)
  const record = {
    name: manifest.name,
    version: manifest.version,
    manifest,
    path,
    bytes,
    filename: basename(path),
    integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64'),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    source,
  }
  if (packageRecords.has(key)) fail('duplicate package identity: ' + key)
  const versions = packageRecords.get(manifest.name) ?? new Map()
  versions.set(manifest.version, record)
  packageRecords.set(manifest.name, versions)
  tarballs.set(record.filename, record)
  const registryFilename = manifest.name.startsWith('@')
    ? manifest.name.slice(manifest.name.indexOf('/') + 1) + '-' + manifest.version + '.tgz'
    : manifest.name + '-' + manifest.version + '.tgz'
  tarballs.set(registryFilename, record)
}

for (const record of provenance.packages ?? []) {
  const path = resolve(root, 'fixtures', record.archive)
  const manifest = record.manifest ?? packageManifestFromArchive(path)
  if (manifest.name !== record.name || manifest.version !== record.version) fail('provenance identity mismatch: ' + record.key)
  addRecord(manifest, path, 'fixture')
}

const ownerPathInput = process.env.DSH_PROVIDERS_UI_ARTIFACT ?? process.env.DSH_PROVIDERS_UI_TARBALL
const ownerSha = process.env.DSH_PROVIDERS_UI_SHA256?.toLowerCase()
if (ownerPathInput === undefined || ownerSha === undefined || !/^[0-9a-f]{64}$/u.test(ownerSha)) {
  fail('DSH_PROVIDERS_UI_ARTIFACT and DSH_PROVIDERS_UI_SHA256 are required')
}
const ownerPath = resolve(ownerPathInput)
if (ownerPath.startsWith(root + sep) || !basename(ownerPath).endsWith('-' + ownerSha + '.tgz')) fail('owner input must be an external content-addressed archive')
const ownerManifest = packageManifestFromArchive(ownerPath)
if (ownerManifest.name !== 'dsh-llm-providers-ui' || ownerManifest.version !== '0.1.3') fail('owner input must be dsh-llm-providers-ui@0.1.3')
const ownerBytes = readFileSync(ownerPath)
const computedOwnerSha = createHash('sha256').update(ownerBytes).digest('hex')
if (computedOwnerSha !== ownerSha) fail('owner input SHA-256 mismatch')
addRecord(ownerManifest, ownerPath, 'temporary-owner')

function compareVersions(left, right) {
  const parse = value => value.split(/[.+-]/u).map(part => /^\d+$/u.test(part) ? Number(part) : part)
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const x = a[index] ?? 0
    const y = b[index] ?? 0
    if (typeof x === 'number' && typeof y === 'number' && x !== y) return x - y
    if (String(x) !== String(y)) return String(x).localeCompare(String(y))
  }
  return 0
}

function decodePath(rawPath) {
  try {
    return decodeURIComponent(rawPath)
  } catch {
    return undefined
  }
}

function send(response, status, contentType, body) {
  response.writeHead(status, { 'content-type': contentType, 'content-length': Buffer.byteLength(body) })
  response.end(body)
}

const server = createServer((request, response) => {
  const rawPath = request.url?.split('?', 1)[0] ?? '/'
  const path = decodePath(rawPath)
  if (path === undefined) return send(response, 400, 'text/plain; charset=utf-8', 'invalid URL encoding')
  if (path.startsWith('/-/')) {
    const filename = path.slice(3)
    const record = tarballs.get(filename)
    if (record === undefined) return send(response, 404, 'text/plain; charset=utf-8', 'not found')
    response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': record.bytes.length })
    return response.end(record.bytes)
  }
  const tarballMarker = path.lastIndexOf('/-/')
  if (tarballMarker >= 0) {
    const record = tarballs.get(path.slice(tarballMarker + 3))
    if (record === undefined) return send(response, 404, 'text/plain; charset=utf-8', 'not found')
    response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': record.bytes.length })
    return response.end(record.bytes)
  }
  if (path.startsWith('/') && path.length > 1) {
    const name = path.slice(1)
    const versions = packageRecords.get(name)
    if (versions === undefined) return send(response, 404, 'text/plain; charset=utf-8', 'not found')
    const ordered = [...versions.values()].sort((left, right) => compareVersions(left.version, right.version))
    const latest = ordered.at(-1)
    const port = server.address()?.port
    if (latest === undefined || typeof port !== 'number') return send(response, 503, 'text/plain; charset=utf-8', 'registry unavailable')
    const metadata = {
      name,
      'dist-tags': { latest: latest.version },
      versions: Object.fromEntries(ordered.map(record => [record.version, {
        ...record.manifest,
        dist: {
          tarball: 'http://127.0.0.1:' + String(port) + '/-/' + record.filename,
          integrity: record.integrity,
        },
      }])),
    }
    return send(response, 200, 'application/json', JSON.stringify(metadata))
  }
  return send(response, 404, 'text/plain; charset=utf-8', 'not found')
})

const port = Number(process.env.DSH_FIXTURE_REGISTRY_PORT ?? 0)
server.listen(port, '127.0.0.1', () => {
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('fixture registry did not bind a TCP port')
  console.log('http://127.0.0.1:' + String(address.port))
})
