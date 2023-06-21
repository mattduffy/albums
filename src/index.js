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

  #albumUrl

  #albumName

  #albumOwner

  /**
   * Create an instance of Album.
   * @summary Create an instance of Album.
   * @param { Object } config - An object literal contain configuration properties.
   * @return { Album }
   */
  constructor(config = {}) {
    this.#log = _log.extend('constructor')
    this.#error = _error.extend('constructor')
    this.#redis = config?.redis ?? null
    this.#mongo = config?.mongo ?? config?.db ?? null
    this.#rootDir = config?.rootDir ?? process.env.ALBUMS_ROOT_DIR ?? './albums'
    this.#albumId = config?.albumId ?? config.Id ?? null
    this.#albumUrl = config?.albumUrl ?? config.url ?? null
    this.#albumName = config?.albumName ?? config.name ?? null
    this.#albumOwner = config?.albumOwner ?? config.owner ?? null
  }

  async init() {
    const log = _log.extend('init')
    const error = _error.extend('init')
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
    return this
  }

  async #checkRootDirExists() {
    const log = _log.extend('checkRootDirExists')
    const info = _info.extend('checkRootDirExists')
    const warn = _warn.extend('checkRootDirExists')
    const error = _error.extend('checkRootDirExists')
    let dir
    let stats
    try {
      dir = path.resolve(this.#rootDir)
      stats = await fs.stat(dir)
    } catch (e) {
      warn(e)
      warn(`Expected album root dir is missing: ${dir}`)
      // throw new Error(e)
      return false
    }
    info(stats.isDirectory())
    return stats.isDirectory()
  }

  async #makeRootDir(dirPath) {
    const log = _log.extend('makeRootDir')
    const info = _info.extend('makeRootDir')
    const error = _error.extend('makeRootDir')
    let dir
    try {
      info(`rootDir: ${path.resolve(this.#rootDir)} ?= dirPath: ${path.resolve(dirPath)}`)
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

  set redisClient(client) {
    this.#redis = client
  }

  set mongoClieng(client) {
    this.#mongo = client
  }

  get rootDir() {
    return this.#rootDir
  }

  async setRootDir(dirPath) {
    let root
    const exists = await this.#checkRootDirExists(dirPath)
    this.#log(`root dir exists: ${exists}`)
    if (exists) {
      this.#log('ok')
    } else {
      this.#log('no root dir yet.')
      root = await this.#makeRootDir(dirPath)
      if (!root) {
        this.#error('mkdir failed')
        throw new Error(`Failed to make album root dir: ${dirPath}`)
      } else {
        this.#rootDir = root
        this.#log(this.#rootDir)
      }
    }
    return this
  }

  get id() {
    return this.#albumId
  }

  set id(id) {
    this.#albumId = id
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
