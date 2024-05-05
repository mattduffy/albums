/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/thumbnail.js The Thumbnail class definition file.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { Exiftool } from '@mattduffy/exiftool' // eslint-disable-line import/no-unresolved
import { ObjectId } from '../lib/mongodb-client.js'
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
 * A class to model the shape a properties of a Thumbnail in an album.
 * @summary A class to model the shape a properties of an Thumbnail in an album.
 * @class Thumbnail
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
class Thumbnail {
  #log

  #error

  /**
   * Create an instance of Thumbnail.
   * @summary Create an instance of Thumbnail.
   * @param { Object } config - An object literal contain configuration properties.
   * @param { string } config.rootDir - A string path for the root directory for all albums.
   * @param { string } config.albumId - A string of the unique album id.
   * @param { string } config.albumDir - A string of the album file system path.
   * @param { string } config.albumUrl - Path portion of public url for the album.
   * @param { string } config.albumImageUrl - Path portion of the public href url from the album images.
   * @param { string } config.albumName - The name of the album.
   * @param { string } config.albumOwer - The name of the album owner.
   * @param { Object[] } config.albumImages - An array of JSON objects, each describing an image.
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
  }
}

export { Thumbnail }
