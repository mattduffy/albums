/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/index.js The Album class definition file.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { _log, _error } from './utils/debug.js'

/**
 * A class to model the shape a properties of an album of items, usually photos.
 * @summary A class to model the shape a properties of an album of items, usually photos.
 * @class Album
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
class Album {
  #redis

  #mongo

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
    const log = _log.extend('constructor')
    const error = _error.extend('constructor')
    this.#redis = config?.redis ?? null
    this.#mongo = config?.mongo ?? config?.db ?? null
    this.#rootDir = config?.rootDir ?? process.env.ALBUMS_ROOT_DIR ?? './albums'
    this.#albumId = config?.albumId ?? config.Id ?? null
    this.#albumUrl = config?.albumUrl ?? config.url ?? null
    this.#albumName = config?.albumName ?? config.name ?? null
    this.#albumOwner = config?.albumOwner ?? config.owner ?? null
  }

  async #checkRootDirExists() {

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

  set rootDir(dirPath) {
    this.#rootDir = dirPath
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
