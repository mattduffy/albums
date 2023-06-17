import { describe, it } from 'node:test'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs/promises'
import { Album } from '../src/index.js'
import { _log, _error } from '../src/utils/debug.js'

const log = _log.extend('test')
const error = _error.extend('test')

describe('First test for albums package', async () => {
  const album = new Album()
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
