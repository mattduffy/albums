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

if (process.env.DB_NAME === undefined) {
  console.log(`Missing db name in environment var process.env.DB_NAME: ${process.env.DB_NAME}`)
  process.exit(1)
}

const testEnv = {}
const env = path.resolve('.', 'test/test.env')
console.log(`dotenv config file: ${env}`)
Dotenv.config({
  path: env,
  processEnv: testEnv,
  debug: true,
  encoding: 'utf8',
})
if (!process.env.DB_NAME) {
  testEnv.HAS_MONGO = false
} else {
  testEnv.DB_NAME = process.env.DB_NAME
}
const log = _log.extend('Albums:test')
const error = _error.extend('test') // eslint-disable-line no-unused-vars
log(testEnv)
const rootDir = path.resolve('test', testEnv.ROOTDIR)
const uploads = path.resolve('test', testEnv.UPLOADSDIR)
const archive = `${uploads}/marquetry.tar.gz`
let ioredis
let redis
let prefix
let mongodb
let ObjectId
let db
let collection
const skip = { skip: true }
log(skip)
describe('First test for albums package', async () => {
  before(async () => {
    log('cwd: ', process.cwd())
    log(`rootDir: ${rootDir}`)
    log(`uploads: ${uploads}`)
    if (testEnv.HAS_REDIS) {
      const { redisConn } = await import('../lib/redis-client.js')
      // ioredis = await redisConn('config/redis.env')
      redis = await redisConn('config/redis.env')
      prefix = testEnv.REDIS_PREFIX
    }
    if (testEnv.HAS_MONGO) {
      const mongo = await import('../lib/mongodb-client.js')
      log(mongodb)
      db = await mongo.mongodb('config/mongodb.env')
      collection = db.db(testEnv.DB_NAME).collection(testEnv.DB_COLLECTION)
      ObjectId = mongo.ObjectId
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
    // if (ioredis) {
    if (redis) {
      // const scan = ioredis.scanStream({ match: prefix, count: 2500 })
      // scan.on('data', (keys) => {
      //   for (let i = 0; i < keys.length; i += 1) {
      //     log(keys[i])
      //   }
      // })
      // scan.on('end', () => {
      //   log(`All test keys with prefix ${prefix} have been scanned.`)
      // })
      // prefix = undefined
      // ioredis.quit()

      /* eslint-disable no-restricted-syntax */
      for await (const keys of redis.scanIterator({ match: prefix, count: 2500 })) {
        log(keys)
      }
      /* eslint-enable no-restricted-syntax */
    }
    if (db) {
      await db.close()
    }
  })
  // const opts = {
  //   collection,
  //   ioredis,
  //   rootDir,
  //   user: randomBytes(4).toString('base64url'),
  // }
  // let album = new Album(opts)
  let fileList
  let fileCount
  let extracted
  let exiftool

  it('should import and instantiate the Album class', () => {
    const opts = {
      collection,
      // ioredis,
      redis,
      rootDir,
      albumOwner: randomBytes(4).toString('base64url'),
    }
    const album = new Album(opts)
    assert(album instanceof Album)
  })

  it('should have a rootDir path assigned', async () => {
    const opts = {
      collection,
      // ioredis,
      redis,
      rootDir,
      albumOwner: `user-${randomBytes(4).toString('base64url')}`,
    }
    const album = new Album(opts)
    log(`album.rootDir: ${path.resolve(album.rootDir)}`)
    assert.notStrictEqual(album.rootDir, undefined)
  })

  it('should successfully unpack the given album archive file first.', async () => {
    const opts = {
      collection,
      // ioredis,
      redis,
      rootDir,
      albumOwner: `user-${randomBytes(4).toString('base64url')}`,
    }
    let album = new Album(opts)
    const unpacker = new Unpacker()
    await unpacker.setPath(archive)
    fileList = await unpacker.list()
    fileCount = fileList.list.length - 1
    log(`Archive ${archive} has ${fileCount} images.`)
    const bytes = randomBytes(2).toString('base64url')
    // const userName = `user-${bytes}`
    log(opts.albumOwner)
    log(`unpack to ${rootDir}/${opts.albumOwner}`)
    extracted = await unpacker.unpack(path.join(rootDir, opts.albumOwner))
    log(extracted)
    album = await album.init(extracted.finalPath)
    album.albumId = new ObjectId()
    assert.ok(extracted.unpacked, 'Unpack operation failed.')

    const newName = `${unpacker.getFileBasename()}-${bytes}`
    const secondExtracted = await unpacker.unpack(
      path.join(rootDir, opts.albumOwner),
      null,
      { rename: true, newName },
    )
    assert.ok(
      secondExtracted.unpacked,
      `Second unpack (and rename ${newName} operation failed.`,
    )
  })

  it('should successfully iterate over the album directory.', async () => {
    let count = 0
    let image
    const opts = {
      collection,
      // ioredis,
      redis,
      rootDir,
      albumOwner: `user-${randomBytes(4).toString('base64url')}`,
    }
    let album = new Album(opts)
    album = await album.init(extracted.finalPath)
    /* eslint-disable-next-line */
    while ((image = await album.next()) !== null) {
      count += 1
      log(`found image: ${image.name}`)
    }
    assert.strictEqual(count, fileCount)
  })

  it('should be able to set the description for the album.', async () => {
    const descriptionText = 'This is my first test album being created.  '
      + 'I don\'t know when this package will be finished and put into use.'
    log(`album desciption: ${descriptionText}`)
    const opts = {
      collection,
      // ioredis,
      redis,
      rootDir,
      albumOwner: `user-${randomBytes(4).toString('base64url')}`,
    }
    let album = new Album(opts)
    album = await album.init(extracted.finalPath)
    album.description = descriptionText
    log(album.description)
    assert.ok(album.description !== null)
  })

  it('should have a rootDir that actually exists', async () => {
    // exiftool = new Exiftool()
    // exiftool = await exiftool.init(extracted.finalPath)
    // const metadata = await exiftool.getMetadata(null, null, '-MWG:all')
    // log(metadata)
    const opts = {
      collection,
      // ioredis,
      redis,
      rootDir,
      albumOwner: `user-${randomBytes(4).toString('base64url')}`,
    }
    let album = new Album(opts)
    album = await album.init(extracted.finalPath)
    const stats = await fs.stat(path.resolve(album.rootDir))
    log(`stats.isDirectory: ${stats.isDirectory()}`)
    assert.strictEqual(rootDir, album.rootDir)
  })

  it('should correctly extract metadata from images in album dir.', async () => {
    exiftool = new Exiftool()
    exiftool = await exiftool.init(extracted.finalPath)
    const metadata = await exiftool.getMetadata(null, null, '-MWG:all')
    // log(metadata)
    const opts = {
      collection,
      // ioredis,
      redis,
      rootDir,
      albumOwner: `user-${randomBytes(4).toString('base64url')}`,
      public: true,
    }
    let album = new Album(opts)
    album = await album.init(extracted.finalPath)
    assert.strictEqual(metadata[metadata.length - 1], album._numberOfImages)
  })

  it('should save an album json doc to the db collection.', async () => {
    const owner = 'arnold-96admonsterator'
    const opts = {
      collection,
      rootDir,
      albumName: 'Save my test album.',
      albumOwner: owner,
      albumUrl: `https://${testEnv.DB_NAME}.com/galleries/${owner}/`,
      albumDescription: 'Test extract an archive and save it as a new image gallery.',
      public: true,
    }
    const unpacker = await new Unpacker()
    await unpacker.setPath(archive)
    log(`unpack to ${rootDir}/${opts.albumOwner}`)
    extracted = await unpacker.unpack(path.join(rootDir, opts.albumOwner))
    let album = new Album(opts)
    album = await album.init(extracted.finalPath)
    const saved = await album.save()
    log(saved)
    assert.ok(saved, 'Failed to save album')
  })
})
