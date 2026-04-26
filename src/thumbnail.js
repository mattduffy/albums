/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @summary The Thumbnail class definition file.
 * @file src/thumbnail.js
 */

// import path from 'node:path'
// import fs from 'node:fs/promises'
// import { Exiftool } from '@mattduffy/exiftool' // eslint-disable-line import/no-unresolved
// import { ObjectId } from '../lib/mongodb-client.js'
import {
  _log as Log,
  _info as Info,
  _warn as Warn,
  _error as Error,
} from './utils/debug.js'

const _log = Log.extend('thumbnail')
const _info = Info.extend('thumbnail')
const _warn = Warn.extend('thumbnail')
const _error = Error.extend('thumbnail')
const THUMBNAILS = 'thumbnails'

/**
 * A class to model the shape and properties of a Thumbnail image in an album.
 * @summary A class to model the shape and properties of an Thumbnail image in an album.
 * @class Thumbnail
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
class Thumbnail {
  #log

  #info

  #warn

  #error

  /**
   * Create an instance of Thumbnail.
   * @summary Create an instance of Thumbnail.
   * @param { Object } config - An object literal contain configuration properties.
   * @param { string } config.albumThumbnailPath - Path of the thumbnail image on the file system.
   * @param { string } config.dbName - A string with the db name if needed.
   * @param { Object } config.mongo - An instance of a mongoDB connection.
   * @param { Object } config.collection - A refernce to a mongoDB collection.
   * @return { Album }
   */
  constructor(config = {}) {
    // private properties
    this.#log = _log.extend('constructor')
    this.#info = _info.extend('constructor')
    this.#warn = _warn.extend('contructor')
    this.#error = _error.extend('constructor')
    if (!config.collection) {
      this.#warn('collection should be ', THUMBNAILS)
    }
  }
}

export { Thumbnail }
