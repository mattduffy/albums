/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/index.js The Album class definition file.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { Exiftool } from '@mattduffy/exiftool' // eslint-disable-line import/no-unresolved
import {
  _log as Log,
  _info as Info,
  _warn as Warn,
  _error as Error,
} from './utils/debug.js'

const _log = Log.extend('album')
const _info = Info.extend('album')
const _warn = Warn.extend('album')
const _error = Error.extend('album')
const ALBUMS = 'albums'

/**
 * A class to model the shape a properties of an album of items, usually photos.
 * @summary A class to model the shape a properties of an album of items, usually photos.
 * @class Album
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
class Album {
  #log

  #error

  #mongo

  #collection

  #db

  #redis

  #cached

  #rootDir

  #images

  #albumId

  #albumDir

  #albumUrl

  #albumName

  #albumOwner

  #albumJson

  #albumDescription

  #directoryIterator

  /**
   * Create an instance of Album.
   * @summary Create an instance of Album.
   * @param { Object } config - An object literal contain configuration properties.
   * @param { string } config.rootDir - A string path for the root directory for all albums.
   * @param { string } config.albumId - A string of the unique album id.
   * @param { string } config.albumDir - A string of the album file system path.
   * @param { string } config.albumUrl - Path portion of public url for the album.
   * @param { string } config.albumName - The name of the album.
   * @param { string } config.albumOwer - The name of the album owner.
   * @param { Boolean } config.public - The visibilty status of the album.
   * @param { Object } config.redis - An instance of a redis connection.
   * @param { string } config.dbName - A string with the db name if needed.
   * @param { Object } config.mongo - An instance of a mongoDB connection.
   * @param { Object } config.collection - A refernce to a mongoDB collection.
   * @return { Album }
   */
  constructor(config = {}) {
    // private properties
    this.#log = _log.extend('constructor')
    this.#error = _error.extend('constructor')
    this.#redis = config?.redis ?? null
    this.#mongo = config?.mongo ?? config?.db ?? null
    if ((!config.collection) && (!this.#mongo?.s?.namespace?.collection)) {
      console.log(this.#mongo)
      this.#db = this.#mongo.db(config.dbName ?? process.env.DB_NAME).collection(ALBUMS)
    } else if (config.collection?.collectionName === ALBUMS) {
      this.#db = config.collection
    } else {
      this.#db = null
    }
    this.#rootDir = config?.rootDir ?? process.env.ALBUMS_ROOT_DIR ?? null
    this.#rootDir = (this.#rootDir) ? path.resolve(this.#rootDir) : null
    this.#albumId = config?.albumId ?? config.Id ?? null
    this.#albumDir = config?.albumDir ?? config.dir ?? null
    this.#albumUrl = config?.albumUrl ?? config.url ?? null
    this.#albumName = config?.albumName ?? config.name ?? null
    this.#albumOwner = config?.albumOwner ?? config.owner ?? null
    this.#albumDescription = config?.albumDescription ?? config.description ?? null
    // pseudo-protected properties
    // this._directoryIterator = null
    this._albumPublic = config?.public ?? false
    this._numberOfImages = 0
    this._metadata = null
  }

  /**
   * Run all the async operations to initialize the album.
   * @summary Run all the async operations to initialize the album.
   * @async
   * @throws Error
   * @param { String } dirPath - A string path to the album directory.
   * @return { Album } Return a fully iniitialized album instance.
   */
  async init(dirPath = null) {
    const log = _log.extend('init')
    const error = _error.extend('init')
    if (path !== null || path !== undefined) {
      this.#albumDir = path.resolve(dirPath)
    }
    const parsedAlbumPath = path.parse(this.#albumDir)
    log(parsedAlbumPath)
    if (this.#rootDir === null && this.#albumDir !== null) {
      log(this.#rootDir, '/', this.#albumDir)
      if (parsedAlbumPath.root === '') {
        throw new Error('No rootDir given and albumDir is incomplete.')
      } else {
        log('parsedAlbumPath: ', parsedAlbumPath)
      }
    }
    this.#albumUrl += parsedAlbumPath.base
    log(`#album url: ${this.#albumUrl}`)
    let dir
    try {
      dir = await this.#checkRootDirExists()
      log(dir)
      if (!dir) {
        dir = await this.#makeRootDir(this.#rootDir)
      }
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    try {
      await this.#resolveAlbumDirPath()
    } catch (e) {
      error('Problem resolving album directory path.')
      throw new Error(e)
    }
    try {
      this.#directoryIterator = await this.#dir()
      this.#images = await fs.readdir(this.#albumDir)
      this._numberOfImages = this.#images.length
    } catch (e) {
      const msg = `Failed to set the directory iterator on ${this.#albumDir}`
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      const exiftool = await new Exiftool().init(this.#albumDir)
      this._metadata = await exiftool.getMetadata('', null, '-File:FileName -IPTC:ObjectName -MWG:all')
      console.log(this._metadata)
      this.#images.forEach((x, y, z) => {
        const image = this._metadata.find((m) => m['File:FileName'] === x) ?? {}
        if (image) {
          // eslint-disable-next-line
          z[y] = {
            url: (this.#albumUrl) ? `${this.#albumUrl}${(this.#albumUrl.slice(-1) !== '/') ? '/' : ''}${x}` : '',
            title: image?.['IPTC:ObjectName'] ?? image?.['XMP:Title'],
            keywords: image?.['Composite:Keywords'],
            description: image?.['Composite:Description'],
            creator: image?.['Composite:Creator'],
          }
        }
      })
    } catch (e) {
      error('Exiftool failed.')
      throw new Error('Exiftool failed.', { cause: e })
    }
    this.#albumJson = await this.createAlbumJson()
    return this
  }

  /**
   * Save album json to db.
   * @summary Save album json to db.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @throws { Error } If no db collection is available.
   * @return { ObjectId|Boolean } Return the new monogdb objectId if successfully saved to db, otherwise false.
   */
  async save() {
    const log = _log.extend('save')
    const error = _error.extend('save')
    if (!this.#db) {
      const msg = `No connection to client collection ${ALBUMS}`
      throw new Error(msg)
    }
    if (!this.#albumJson) {
      this.#albumJson = await this.createAlbumJson()
    }
    let saved
    try {
      saved = await this.#db.insertOne(this.#albumJson)
      log('Album save results: %o', saved)
    } catch (e) {
      const err = 'Failed to save album json to db.'
      error(err)
      throw new Error(err, { cause: e })
    }
    if (!saved?.insertedId) {
      return false
    }
    this.#albumId = saved.insertedId.toString()
    return saved.insertedId
  }

  /**
   * Resolve the given album directory name into a full file system path.
   * @summary Resolve the given album directory name into a full file system path.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @throws { Error } If directory can't be accessed.
   * @return { undefined }
   */
  #resolveAlbumDirPath() {
    const log = _log.extend('resolveAlbumDirPath')
    const error = _error.extend('resolveAlbumDirPath')
    log(`rootDir: ${this.#rootDir}`)
    log(`albumDir: ${this.#albumDir}`)
    const p = path.parse(this.#albumDir)
    log(p)
    const pathDiff = path.relative(this.#rootDir, this.#albumDir)
    if (`${this.#rootDir}/${pathDiff}` !== this.#albumDir) {
      error(`rootDir:         ${this.#rootDir}`)
      error(`albumDir:        ${this.#albumDir}`)
      error(`path difference: ${pathDiff}`)
      throw new Error(`Album dir ${this.#albumDir} is not in ${this.#rootDir}`)
    }
    this.#albumDir = path.resolve(this.#albumDir)
  }

  /**
   * Check if the given path to rootDir is valid.
   * @summary Check if the given path to rootDir is valid.
   * @async
   * @param { string } rootPath - A string file system path for the root album directory.
   * @return { boolean } - True if directory exists, false otherwise.
   */
  async #checkRootDirExists(rootPath = null) {
    // const log = _log.extend('checkRootDirExists')
    const info = _info.extend('checkRootDirExists')
    const warn = _warn.extend('checkRootDirExists')
    // const error = _error.extend('checkRootDirExists')
    let stats
    let rootPathTest
    if (rootPath !== null) {
      rootPathTest = rootPath
    } else {
      rootPathTest = this.#rootDir
    }
    if (rootPathTest !== null) {
      try {
        stats = await fs.stat(rootPathTest)
      } catch (e) {
        warn(e)
        warn(`Expected album root dir is missing: ${rootPathTest}`)
        // throw new Error(e)
        return false
      }
      info('rootDir is directory: ', stats.isDirectory())
      return stats.isDirectory()
    }
    const p = path.parse(this.#albumDir)
    if (p.dir !== '') {
      info('p.dir: ', p.dir)
      this.#rootDir = p.dir
      return true
    }
    return false
  }

  /**
   * Make the album root directory if it doesn't already exist.
   * @summary Make the album root directory if it doesn't already exist.
   * @async
   * @param { string } dirPath - A string with the file system path to root dir location.
   * @throws Error If fails to make new directory at rootDir path.
   * @return { string } The path of the newly created rootDir.
   */
  async #makeRootDir(dirPath) {
    const log = _log.extend('makeRootDir')
    const info = _info.extend('makeRootDir')
    const error = _error.extend('makeRootDir')
    let dir
    try {
      info(`rootDir: ${this.#rootDir} ?= dirPath: ${path.resolve(dirPath)}`)
      dir = await fs.mkdir(path.resolve(dirPath), { recursive: true })
      log(dir)
      if (!dir) {
        return false
      }
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    return dir
  }

  /**
   * Provide an async iterator of the album directory.
   * @summary Provide an async iterator of the album directory.
   * @async
   * @throws Error If album directory doesn't exist.
   * @return { fs.Dirent } AsyncIterator of the fs.Dirent
   */
  async #dir() {
    const log = _log.extend('dir')
    const error = _error.extend('dir')
    try {
      log(`Opening album dir: ${this.#albumDir}`)
      const dirIt = await fs.opendir(this.#albumDir, { encoding: 'utf8', bufferSize: 32, recursive: true })
      return dirIt
    } catch (e) {
      error(`Error: ${this.#albumDir}`)
      throw new Error(e)
    }
  }

  /**
   * Provide a public interface to an iteratable directory read handle.
   * @summary Provide a public interface to an interable directory read handle.
   * @async
   * @retuun { fs.Dir|null} - AsyncIterator of fs.Dir instance.
   */
  async next() {
    if (this.#directoryIterator) {
      return this.#directoryIterator.read()
    }
    return null
  }

  /*
   * Build the JSON object for the album.
   * @summary Build the JSON object for the album.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @throws Error
   * @return { Object }
   */
  async createAlbumJson() {
    return {
      _id: this.#albumId,
      creator: this.#albumOwner,
      name: this.#albumName,
      url: this.#albumUrl,
      description: this.#albumDescription,
      public: this._albumPublic,
      images: this.#images,
    }
  }

  set redisClient(client) {
    this.#redis = client
  }

  set mongoClient(client) {
    this.#mongo = client
  }

  set rootDir(noop) {
    this.#error('No-op')
  }

  get rootDir() {
    return this.#rootDir
  }

  async setRootDir(dirPath) {
    const log = this.#log.extend('setRootDir')
    const error = this.#error.extend('setRootDir')
    log('         dirPath: ', dirPath)
    log('resolved dirPath: ', path.resolve(dirPath))
    let root
    const exists = await this.#checkRootDirExists(dirPath)
    log(`root dir exists: ${exists}`)
    if (exists) {
      log(`${dirPath} exists and setting as new rootDir`)
      this.#rootDir = dirPath
    } else {
      log('no root dir yet.')
      root = await this.#makeRootDir(dirPath)
      if (!root) {
        error('mkdir failed')
        throw new Error(`Failed to make album root dir: ${dirPath}`)
      } else {
        this.#rootDir = root
        log(this.#rootDir)
      }
    }
    return this.init()
  }

  get id() {
    if (this.#albumId) {
      return this.#albumId
    }
    return undefined
  }

  set id(id) {
    this.#albumId = id
  }

  get albumDir() {
    return this.#albumDir
  }

  set albumDir(albumDirPath) {
    this.#albumDir = albumDirPath
    this.#resolveAlbumDirPath()
  }

  get url() {
    return this.#albumUrl
  }

  set url(url) {
    this.#albumUrl = url
  }

  get name() {
    return this.#albumName
  }

  set name(name) {
    this.#albumName = name
  }

  get owner() {
    return this.#albumOwner
  }

  set owner(owner) {
    this.#albumOwner = owner
  }

  set description(desc) {
    this.#albumDescription = desc
  }

  get description() {
    return this.#albumDescription
  }

  get public() {
    return this._albumPublic
  }

  set public(isPublic = false) {
    this._albumPublic = isPublic
  }

  async getJson() {
    if (this.#albumJson) {
      return this.#albumJson
    }
    return this.createAlbumJson()
  }

  get json() {
    this.#error('no-op: get json()')
    return undefined
  }

  set json(j) {
    this.#error('no-op: set json()')
  }
}

export { Album }
export { Albums } from './Albums.js'
