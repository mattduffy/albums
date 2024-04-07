import * as Dotenv from 'dotenv'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import {
  after,
  before,
  describe,
  it,
} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { Unpacker } from '@mattduffy/unpacker' // eslint-disable-line import/no-unresolved
import { Exiftool } from '@mattduffy/exiftool' // eslint-disable-line import/no-unresolved
import { Album } from '../src/index.js'
import { _log, _error } from '../src/utils/debug.js'

const testEnv = {}
const env = path.resolve('.', 'test/test.env')
console.log(`dotenv config file: ${env}`)
Dotenv.config({
  path: env,
  processEnv: testEnv,
  debug: true,
  encoding: 'utf8',
})
const log = _log.extend('test')
const error = _error.extend('test') // eslint-disable-line no-unused-vars
log(testEnv)
const rootDir = path.resolve('test', testEnv.ROOTDIR)
const uploads = path.resolve('test', testEnv.UPLOADSDIR)
const archive = `${uploads}/marquetry.tar.gz`
let ioredis
let collection
let close
const skip = { skip: true }
describe('First test for albums package', async () => {
  before(async () => {
    log('cwd: ', process.cwd())
    log(`rootDir: ${rootDir}`)
    log(`uploads: ${uploads}`)
    if (testEnv.HAS_REDIS) {
      const { redisConn } = await import('../lib/redis-client.js')
      ioredis = await redisConn('config/redis.env')
    }
    if (testEnv.HAS_MONGO) {
      const { mongodb } = await import('../lib/mongodb-client.js')
      // { collection, close } = await mongodb('config/mongodb.env')
      const tmp = await mongodb('config/mongodb.env')
      collection = tmp.collection
      close = tmp.close
    }
    try {
      await fs.stat(rootDir)
    } catch (e) {
      error(`Test rootDir needs to be created: ${rootDir}`)
      const makeRootDir = await fs.mkdir(rootDir, { recursive: true })
      if (makeRootDir === undefined) {
        error(`made ${rootDir}`)
      } else {
        throw new Error(`failed to make ${rootDir}`)
      }
    }
    try {
      await fs.stat(uploads)
    } catch (e) {
      error(`Test uploads dir needs to be created: ${uploads}`)
      const makeUploadsDir = await fs.mkdir(uploads, { recursive: true })
      if (makeUploadsDir === undefined) {
        error(`made ${uploads}`)
      } else {
        throw new Error(`failed to make ${uploads}`)
      }
    }
  })

  after(async () => {
    if (ioredis) {
      ioredis.quit()
    }
    if (collection) {
      await close()
    }
  })
  const opts = {
    collection,
    // ioredis,
    rootDir,
    user: randomBytes(8).toString('base64url'),
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
    log(`album.rootDir: ${path.resolve(album.rootDir)}`)
    assert.notStrictEqual(album.rootDir, undefined)
  })

  it('should successfully unpack the given album archive file first.', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(archive)
    fileList = await unpacker.list()
    fileCount = fileList.list.length - 1
    log(`Archive ${archive} has ${fileCount} images.`)
    const newName = `${unpacker.getFileBasename()}-${randomBytes(4).toString('base64url')}`
    extracted = await unpacker.unpack(rootDir, {}, { rename: true, newName })
    log(extracted)
    assert.ok(extracted.unpacked, 'Unpack operation failed.')
  })

  it('should have a rootDir that actually exists', skip, async () => {
    exiftool = new Exiftool()
    exiftool = await exiftool.init(extracted.finalPath)
    const metadata = await exiftool.getMetadata()
    log(metadata)
    album.albumDir = extracted.finalPath
    album = await album.init()
    const stats = await fs.stat(path.resolve(album.rootDir))
    log(`stats.isDirectory: ${stats.isDirectory()}`)
    assert.strictEqual(rootDir, album.rootDir)
  })
})
