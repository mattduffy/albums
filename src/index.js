/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/index.js The Album class definition file.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import {
  _log,
  _info,
  _warn,
  _error,
} from './utils/debug.js'

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

  #redis

  #cached

  #rootDir

  #albumId

  #albumDir

  #albumUrl

  #albumName

  #albumOwner

  /**
   * Create an instance of Album.
   * @summary Create an instance of Album.
   * @param { Object } config - An object literal contain configuration properties.
   * @param { string } config.rootDir - A string path for the root directory for albums.
   * @param { string } config.albumId - A string of the unique album id.
   * @param { string } config.albumDir - A string of the album file system path.
   * @param { string } config.albumUrl - Path portion of public url for the album.
   * @param { string } config.albumName - The name of the album.
   * @param { string } config.albumOwer - The name of the album owner.
   * @param { Object } config.redis - An instance of a redis connection.
   * @param { Object } config.mongo - An instance of a mongoDB connection.
   * @return { Album }
   */
  constructor(config = {}) {
    // private properties
    this.#log = _log.extend('constructor')
    this.#error = _error.extend('constructor')
    this.#redis = config?.redis ?? null
    this.#mongo = config?.mongo ?? config?.db ?? null
    // this.#rootDir = config?.rootDir ?? process.env.ALBUMS_ROOT_DIR ?? './albums'
    this.#rootDir = config?.rootDir ?? process.env.ALBUMS_ROOT_DIR ?? null
    this.#rootDir = (this.#rootDir) ? path.resolve(this.#rootDir) : null
    this.#albumId = config?.albumId ?? config.Id ?? null
    this.#albumDir = config?.albumDir ?? config.dir ?? null
    this.#albumUrl = config?.albumUrl ?? config.url ?? null
    this.#albumName = config?.albumName ?? config.name ?? null
    this.#albumOwner = config?.albumOwner ?? config.owner ?? null
    // pseudo-protected properties
    this._directoryIterator = null
  }

  /**
   * Run all the async operations to initialize the album.
   * @summary Run all the async operations to initialize the album.
   * @async
   * @throws Error
   * @return { Album } Return a fully iniitialized album instance.
   */
  async init() {
    const log = _log.extend('init')
    const error = _error.extend('init')
    if (this.#rootDir === null && this.#albumDir !== null) {
      log(this.#rootDir, '/', this.#albumDir)
      const parsedAlbumPath = path.parse(this.#albumDir)
      if (parsedAlbumPath.root === '') {
        throw new Error('No rootDir given and albumDir is incomplete.')
      } else {
        log('parsedAlbumPath: ', parsedAlbumPath)
      }
    }
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
      this._directoryIterator = await this.#dir()
    } catch (e) {
      error(`Failed to set the directory iterator on ${this.#albumDir}`)
      throw new Error(e)
    }
    return this
  }

  /**
   * Resolve the given album directory name into a full file system path.
   * @summary Resolve the given album directory name into a full file system path.
   * @throws { Error } If directory can't be accessed.
   * @return { undefined }
   */
  #resolveAlbumDirPath() {
    const log = _log.extend('resolveAlbumDirPath')
    const error = _error.extend('resolveAlbumDirPath')
    let fullPath
    log(`rootDir: ${this.#rootDir}`)
    log(`albumDir: ${this.#albumDir}`)
    const p = path.parse(this.#albumDir)
    log(p)
    if (p.root === '' && this.#rootDir === '') {
      error(`${this.#rootDir}/${this.#albumDir}`)
      throw new Error('No valid path to album given.')
    } else if (p.dir === '') {
      // just the album directory name
      fullPath = path.resolve(this.#rootDir, this.#albumDir)
      log(`Full album path: ${fullPath}`)
    } else {
      fullPath = path.resolve(this.#albumDir)
    }
    log('composed path: ', this.#rootDir, '/', p.name)
    log('fullPath:      ', fullPath)
    log(`this.#albumDir: ${this.#albumDir}`)
    if (fullPath !== `${this.#rootDir}/${p.name}`) {
      // ../rootDir/albumDir
      throw new Error(`Album dir ${this.#albumDir} is not in ${this.#rootDir}`)
    }
    this.#albumDir = fullPath
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

  set redisClient(client) {
    this.#redis = client
  }

  set mongoClieng(client) {
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
    return this.#albumId
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
}

export { Album }
