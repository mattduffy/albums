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
  #rootDir

  /**
   * Create an instance of Album.
   * @summary Create an instance of Album.
   * @param { Object } config - An object literal contain configuration properties.
   * @return { Album }
   */
  constructor(config = {}) {
    const log = _log.extend('constructor')
    const error = _error.extend('constructor')
    this.#rootDir = config?.rootDir ?? process.env.ALBUMS_ROOT_DIR ?? './albums'
  }

  get rootDir() {
    return this.#rootDir
  }

  set rootDir(dirPath) {
    this.#rootDir = dirPath
  }

}

export { Album }
