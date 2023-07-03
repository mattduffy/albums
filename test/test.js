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
import { Exiftool } from '@mattduffy/exiftool' // eslint-disable-line import/no-unresolved
import { Album } from '../src/index.js'
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
let uploads = process.env.UPLOADSDIR ?? 'tmp/uploads'
uploads = path.resolve(uploads)
const archive = `${uploads}/marquetry.tgz`
let redis
let mongo

describe('First test for albums package', async () => {
  before(async () => {
    info('cwd: ', process.cwd())
    info(`rootDir: ${rootDir}`)
    info(`uploads: ${uploads}`)
    if (process.env.HAS_REDIS) {
      const { io } = await import('../lib/redis-client.js')
      redis = io.io
    }
    if (process.env.HAS_MONGO) {
      const { client } = await import('../lib/mongodb-client.js')
      mongo = client
    }
    try {
      await fs.stat(rootDir)
    } catch (e) {
      warn(`Test rootDir needs to be created: ${rootDir}`)
      const makeRootDir = await fs.mkdir(rootDir, { recursive: true })
      if (makeRootDir === undefined) {
        info(`made ${rootDir}`)
      } else {
        throw new Error(`failed to make ${rootDir}`)
      }
    }
    try {
      await fs.stat(uploads)
    } catch (e) {
      warn(`Test uploads dir needs to be created: ${uploads}`)
      const makeUploadsDir = await fs.mkdir(uploads, { recursive: true })
      if (makeUploadsDir === undefined) {
        info(`made ${uploads}`)
      } else {
        throw new Error(`failed to make ${uploads}`)
      }
    }
  })

  after(async () => {
    if (redis) {
      redis.quit()
    }
    if (mongo) {
      mongo.quit()
    }
  })
  const opts = {
    // mongo,
    // redis,
    rootDir,
  }
  let album = new Album(opts)
  let fileList
  let fileCount
  let extracted
  let exiftool

  it('should import and instantiate the Album class', () => {
    assert(album instanceof Album)
  })

  it('should have a rootDir path assigned', async () => {
    log(path.resolve(album.rootDir))
    assert.notStrictEqual(album.rootDir, undefined)
  })

  it('should successfully unpack the given album archive file first.', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(archive)
    fileList = await unpacker.list()
    fileCount = fileList.list.length
    info(`Archive ${archive} has ${fileCount} images.`)
    extracted = await unpacker.unpack(rootDir, {}, { rename: true, newName: '00001' })
    info(extracted)
    assert.ok(extraced.unpacked, 'Unpack operation failed.')
  })

  it('should have a rootDir that actually exists', async () => {
    exiftool = new Exiftool()
    exiftool = await exiftool.init(extracted.finalPath)
    const metadata = await exiftool.getMetadata()
    info(metadata)
    album = await album.init()
    const stats = await fs.stat(path.resolve(album.rootDir))
    log(`stats.isDirectory: ${stats.isDirectory()}`)
    assert.strictEqual(rootDir, album.rootDir)
  })


})
