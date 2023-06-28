import {
  after,
  before,
  describe,
  it,
} from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs/promises'
import { Unpacker } from '@mattduffy/unpacker' // eslint-disable-line import/no-unresolved
import { Album } from '../src/index.js'
import { io as redis } from '../lib/redis-client.js'
// import { client as mongo } from '../lib/mongodb-client.js'
import {
  _log,
  _info,
  _warn,
  _error,
} from '../src/utils/debug.js'

const log = _log.extend('test')
const info = _info.extend('test')
const warn = _warn.extend('test') // eslint-disable-line no-unused-vars
const error = _error.extend('test') // eslint-disable-line no-unused-vars
let rootDir = process.env.ROOTDIR ?? 'tmp/albums'
rootDir = path.resolve(rootDir)
info('rootDir: ', rootDir)
let uploads = process.env.UPLOADSDIR ?? 'tmp/uploads'
uploads = path.resolve(uploads)
const archive = `${uploads}/marquetry.tgz`
info('archive: ', archive)

describe('First test for albums package', async () => {
  before(async () => {
    info('cwd: ', process.cwd())
  })

  after(async () => {
    redis.quit()
    // mongo.quit()
  })
  const opts = {
    // mongo,
    redis,
    rootDir,
  }
  let album = new Album(opts)
  it('should import and instantiate the Album class', () => {
    assert(album instanceof Album)
  })

  it('should have a rootDir path assigned', async () => {
    log(path.resolve(album.rootDir))
    assert.notStrictEqual(album.rootDir, undefined)
  })

  it('should have a rootDir that actually exists', async () => {
    album = await album.init()
    const stats = await fs.stat(path.resolve(album.rootDir))
    log(`stats.isDirectory: ${stats.isDirectory()}`)
    assert.strictEqual(rootDir, album.rootDir)
  })

  it('should ...', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(archive)
  })
})
