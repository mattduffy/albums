import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs/promises'
import { Album } from '../src/index.js'
import { io as redis } from '../lib/redis-client.js'
import { client as mongo } from '../lib/mongodb-client.js'
import {
  _log,
  _info,
  _warn,
  _error,
} from '../src/utils/debug.js'

const log = _log.extend('test')
const info = _info.extend('test')
const warn = _warn.extend('test')
const error = _error.extend('test')

describe('First test for albums package', async () => {
  after(() => {
    redis.quit()
    mongo.quit()
  })
  const opts = {
    redis,
    mongo,
  }
  const album = new Album(opts)
  it('should import and instantiate the Album class', () => {
    assert(album instanceof Album)
  })
  it('should have a rootDir path assigned', async () => {
    assert.notStrictEqual(album.rootDir, undefined)
    log(path.resolve(album.rootDir))
  })
  it('should have a rootDir that actually exists', async () => {
    const stats = await fs.stat(path.resolve(album.rootDir))
    log(`stats.isDirectory: ${stats.isDirectory()}`)
  })
})
