/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/image.js The Image class definition file.
 */

// import path from 'node:path'
// import fs from 'node:fs/promises'
// import { Exiftool } from '@mattduffy/exiftool' // eslint-disable-line import/no-unresolved
// import { Thumbnail } from './thumbnail.js'
// import { ObjectId } from '../lib/mongodb-client.js'
import {
  _log as Log,
  _info as Info,
  _warn as Warn,
  _error as Error,
} from './utils/debug.js'

const _log = Log.extend('image')
const _info = Info.extend('image')
const _warn = Warn.extend('image')
const _error = Error.extend('image')
const ALBUMS = 'albums'
// const IMAGES = 'images'

/**
 * A class to model the shape and properties of an Image in an album.
 * @summary A class to model the shape and properties of an Image in an album.
 * @class Image
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
class Image {
  #log

  #info

  #warn

  #error

  #imagePath

  #mongo

  #db

  /**
   * Create an instance of Image.
   * @summary Create an instance of Image.
   * @param { Object } config - An object literal contain configuration properties.
   * @param { string } config.albumImagePath - Path of the image on the file system.
   * @param { string } config.dbName - A string with the db name if needed.
   * @param { Object } config.mongo - An instance of a mongoDB connection.
   * @param { Object } config.collection - A refernce to a mongoDB collection.
   * @return { Album }
   */
  constructor(config = {}) {
    // private properties
    this.#log = _log.extend('constructor')
    this.#error = _error.extend('constructor')
    this.#warn = _warn.extend('constructor')
    this.#info = _info.extend('constructor')
    this.#imagePath = config.albumImagePath
    this.#mongo = config?.mongo ?? config?.db ?? null
    if ((!config.collection) && (!this.#mongo?.s?.namespace?.collection)) {
      this.#log(this.#mongo)
      this.#db = this.#mongo.db(config.dbName ?? process.env.DB_NAME).collection(ALBUMS)
    } else if (config.collection?.collectionName !== undefined) {
      this.#info('collection', config.collection)
      this.#db = config.collection
    } else {
      this.#db = null
    }
  }
}

export { Image }
