import { describe, it, after } from 'node:test'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs/promises'
import { Album } from '../src/index.js'
import { _log, _error } from '../src/utils/debug.js'
import { io as redis } from '../lib/redis-client.js'
import { client as mongo } from '../lib/mongodb-client.js'

await mongo.connect()
const db = mongo.db(process.env.MONGODB_DBNAME)
const collection = mongo.collection(process.env.MONGODB_COLLECTION)
const log = _log.extend('test')
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
