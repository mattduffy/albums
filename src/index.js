/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/index.js The Album class definition file.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { Magick } from 'magickwand.js'
import { Exiftool } from '@mattduffy/exiftool' // eslint-disable-line import/no-unresolved
// import { Image } from './image.js'
import { ObjectId } from '../lib/mongodb-client.js'
import {
  _log as Log,
  _info as Info,
  _warn as Warn,
  _error as _Error,
} from './utils/debug.js'

const _log = Log.extend('album')
const _info = Info.extend('album')
const _warn = Warn.extend('album')
const _error = _Error.extend('album')
const ALBUMS = 'albums'
const LANDSCAPE_BIG = '900x900'
const LANDSCAPE_MED = '600x600'
const LANDSCAPE_SML = '350x350'
const PORTRAIT_BIG = '600x600'
const PORTRAIT_MED = '400x400'
const PORTRAIT_SML = '350x350'
const THUMBNAIL = '133x133'

/**
 * A class to model the shape a properties of an album of items, usually photos.
 * @summary A class to model the shape a properties of an album of items, usually photos.
 * @class Album
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
class Album {
  #log

  #error

  #newAlbum

  #mongo

  #collection

  #db

  #redis

  #streamId

  #cached

  #rootDir

  #images

  #albumId

  #albumDir

  #albumUrl

  #albumPreviewImage

  #albumImageUrl

  #albumName

  #albumSlug

  #albumOwner

  #albumJson

  #albumKeywords

  #albumDescription

  #directoryIterator

  #postId

  #noop

  /**
   * Create an instance of Album.
   * @summary Create an instance of Album.
   * @param { Object } config - An object literal containing configuration properties.
   * @param { Boolean } [config.new = false] - True only if creating a new album.
   * @param { string } config.rootDir - A string path for the root directory for all albums.
   * @param { string } config.albumId - A string of the unique album id.
   * @param { string } config.albumDir - A string of the album file system path.
   * @param { string } config.albumUrl - Path portion of public url for the album.
   * @param { string } config.albumPreviewImage - Path portion of the url to show album
   * preview image.
   * @param { string } config.albumImageUrl - Path portion of the public href url from
   * the album images.
   * @param { string } config.albumName - The name of the album.
   * @param { string } config.albumSlug - Slugified string version of the album name.
   * @param { string } config.albumOwer - The name of the album owner.
   * @param { string } config.albumKeywords - The keywords of the album.
   * @param { string } config.albumDescription - The description of the album.
   * @param { Object[] } config.albumImages - An array of JSON objects, each describing an
   * image.
   * @param { Boolean } config.public - The visibilty status of the album.
   * @param { String } [config.postId = null] - If the album belongs to a blog post, the
   * _id of the post.
   * @param { string } [config.streamId = null] - A stream id for redis recently added stream.
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
    this.#newAlbum = config?.new ?? false
    this.#redis = config?.redis ?? null
    this.#streamId = config?.streamId ?? null
    this.#mongo = config?.mongo ?? config?.db ?? null
    if ((!config.collection) && (!this.#mongo?.s?.namespace?.collection)) {
      console.log(this.#mongo)
      this.#db = this.#mongo.db(config.dbName ?? process.env.DB_NAME).collection(ALBUMS)
    // } else if (config.collection?.collectionName === ALBUMS) {
    } else if (config.collection?.collectionName !== undefined) {
      this.#db = config.collection
    } else {
      this.#db = null
    }
    this.#rootDir = config?.rootDir ?? process.env.ALBUMS_ROOT_DIR ?? null
    this.#rootDir = (this.#rootDir) ? path.resolve(this.#rootDir) : null
    this.#albumId = config?.albumId ?? config.Id ?? config?.id ?? config?._id ?? null
    this.#albumDir = config?.albumDir ?? config?.dir ?? null
    this.#albumPreviewImage = config.albumPreviewImage ?? config.previewImage ?? null
    this.#albumUrl = config?.albumUrl ?? config?.url ?? null
    this.#albumImageUrl = config?.albumImageUrl ?? config?.imageUrl ?? null
    this.#albumName = config?.albumName ?? config.name ?? null
    this.#albumSlug = config?.albumSlug ?? config.slug ?? null
    this.#albumOwner = config?.albumOwner ?? config.owner ?? config?.creator ?? null
    if (config?.albumKeywords) {
      this.#albumKeywords = new Set(config.albumKeywords)
    } else if (config?.keywords) {
      this.#albumKeywords = new Set(config.keywords)
    } else {
      this.#albumKeywords = new Set()
    }
    this.#albumDescription = config?.albumDescription ?? config?.description ?? null
    this.#images = config?.albumImages ?? config?.images ?? []
    this.#postId = config?.postId ?? null
    // pseudo-protected properties
    // this._directoryIterator = null
    this._albumPublic = config?.public ?? false
    this._numberOfImages = this.#images?.length ?? 0
    this._metadata = null
  }

  /**
   * A custom toString() method.
   * @summary A custom toString() method.
   * @author Matthew Dufffy <mattduffy@gmail.com>
   * @return { String }
   */
  toString() {
    const p = 16
    const str = 'Album configuration details: \n'
              + `${'name:'.padEnd(p)} ${this.#albumName}\n`
              + `${'id:'.padEnd(p)} ObjectId(${this.#albumId})\n`
              + `${'author:'.padEnd(p)} ${this.#albumOwner}\n`
              + `${'slug:'.padEnd(p)} ${this.#albumSlug}\n`
              + `${'root dir:'.padEnd(p)} ${this.#rootDir}\n`
              + `${'album dir:'.padEnd(p)} ${this.#albumDir}\n`
              + `${'album Image Url:'.padEnd(p)} ${this.#albumImageUrl}\n`
              + `${'album url:'.padEnd(p)} ${this.#albumUrl}\n`
    return str
  }

  /**
   * Run all the async operations to initialize the album.
   * @summary Run all the async operations to initialize the album.
   * @async
   * @throws Error
   * @param { String } dirPath - A string path to the album directory.
   * @param { Object } [skip={}] - An object literal with steps to skip.
   * @param { Boolean } [skip.sizes] - If True, skip generating sizes.
   * @param {Boolean } [skip.metadata] - If True, skio exiftool metatdta step.
   * @return { Album } Return a fully iniitialized album instance.
   */
  async init(dirPath = null, skip = {}) {
    const log = _log.extend('init')
    const error = _error.extend('init')
    if (dirPath) {
      this.#albumDir = path.resolve(dirPath)
      log(`init using dirPath param: ${dirPath}`)
    } else {
      this.#albumDir = path.resolve(this.#albumDir)
      log(`init using #albumDir property: ${this.#albumDir}`)
    }
    const parsedAlbumPath = path.parse(this.#albumDir)
    log(parsedAlbumPath)
    if (this.#rootDir === null && this.#albumDir !== null) {
      if (parsedAlbumPath.root === '') {
        throw new Error('No rootDir given and albumDir is incomplete.')
      } else {
        // log('parsedAlbumPath: ', parsedAlbumPath)
        this.#rootDir = parsedAlbumPath.dir
      }
    }
    log(this.#rootDir, '\n', this.#albumDir)
    if (!this.#albumUrl) {
      this.#albumUrl += parsedAlbumPath.base
      log(`#album url: ${this.#albumUrl}`)
    }
    if (!this.#albumImageUrl) {
      const basePath = /public\/(?<p>.*)$/.exec(parsedAlbumPath.dir)
      this.#albumImageUrl = `${basePath.groups.p}/${parsedAlbumPath.base}`
      log(`#album image url being set to: ${this.#albumImageUrl}`)
    }
    let dir
    try {
      dir = await this.#checkRootDirExists()
      log(dir)
      if (!dir) {
        dir = await this.#makeRootDir(this.#rootDir)
      }
    } catch (e) {
      const msg = 'Failed to create directory iterator on album dir.'
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      await this.#resolveAlbumDirPath()
    } catch (e) {
      const msg = 'Problem resolving album directory path.'
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      this.#directoryIterator = await this.#dir()
      if (this.#images.length > 0) {
        this._numberOfImages = this.#images.length
      } else {
        this.#images = await fs.readdir(this.#albumDir)
        this._numberOfImages = this.#images.length
      }
    } catch (e) {
      const msg = `Failed to set the directory iterator on ${this.#albumDir}`
      error(msg)
      throw new Error(msg, { cause: e })
    }
    if (!skip?.metadata) {
      try {
        await this.getMetadata()
      } catch (e) {
        const msg = 'Exiftool failed.'
        error(msg)
        throw new Error(msg, { cause: e })
      }
    }
    if (!skip?.sizes) {
      try {
        this.#images.forEach(async (img) => {
          await this.generateSizes(img.name)
        })
        log(`is album preview image set?: ${this.#albumPreviewImage}`)
        if (!this.#albumPreviewImage) {
          this.#albumPreviewImage = this.#images[0].thumbnail
          log(`setting album preview image to: ${this.#albumPreviewImage}`)
        }
      } catch (e) {
        const msg = 'Image Magick resising failed.'
        throw new Error(msg, { cause: e })
      }
    }
    try {
      if (!this.#albumJson) {
        this.#albumJson = await this.createAlbumJson()
      }
    } catch (e) {
      const msg = 'Creating album json failed.'
      error(msg)
      throw new Error(msg, { cause: e })
    }
    return this
  }

  /**
   * Remove album from the redis new albums stream.
   * @summary Remove album from the redis new albums stream.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return { Boolean|undefined } - Returns true if successfully removed from the redis
   * stream.
   */
  async removeFromRedisStream() {
    const log = _log.extend('removeFromRedisStream')
    const error = _error.extend('removeFromRedisStream')
    // if (!this._albumPublic) {
    //   return undefined
    // }
    if (this.#streamId) {
      try {
        // ioredis command version
        // const response = await this.#redis.xdel('albums:recent:10', this.#streamId)
        // official redis command
        const response = await this.#redis.xDel('mmt:albums:recent:10', this.#streamId)
        this.#streamId = null
        log(response)
      } catch (e) {
        error(e)
        return false
      }
    }
    return true
  }

  /**
   * Add newly created album to the redis new albums stream.
   * @summary Add newly created album to the redis new albums stream.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return { Boolean } - Returns true if successfully added to redis stream.
   */
  async addToRedisStream() {
    const log = _log.extend('addToRedisStream')
    const error = _error.extend('addToRedisStream')
    if (!this.#redis) {
      const msg = 'no redis connection provided'
      error(msg)
      error(msg)
      return false
    }
    if (!this.#albumId) {
      // only add albums with _id values to the redis stream
      log('No #albumId was provided to add to redis stream')
      return false
    }
    if (!this._albumPublic) {
      // only add public albums to the redis stream
      log('Album is not public, not added to redis stream.')
      return false
    }
    if (this.#streamId) {
      log(`album already has a streamId: ${this.#streamId}, clear it and re-add.`)
      try {
        // ioredis command version
        // const clear = await this.#redis.xdel('albums:recent:10', this.#streamId)
        // official redis command
        const clear = await this.#redis.xDel('mmt:albums:recent:10', this.#streamId)
        log(clear)
      } catch (e) {
        error(e)
        error(`Failed to remove streamId: ${this.#streamId}`)
      }
    }
    let response
    try {
      log(`adding new album (id: ${this.#albumId}) to redis stream`)
      const entry = {
        id: this.#albumId,
        slug: this.#albumSlug,
        name: this.#albumName,
        owner: this.#albumOwner,
        access: this._albumPublic,
        preview: this.#albumPreviewImage,
        description: this.#albumDescription,
      }
      response = await this.#redis.xAdd(
        'mmt:albums:recent:10',
        '*',
        'album',
        JSON.stringify(entry),
      )
      log('xadd response: ', response)
      this.#streamId = response
    } catch (e) {
      error(e)
      return false
    }
    return true
  }

  /**
   * Delete an image.
   * @summary Delete an image.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { String } imageName=null - The name of the image to delete from the album.
   * @throws { Error } Throws an Error if imageName parameter is not provided.
   * @return { Boolean }
   */
  async deleteImage(imageName = null) {
    const log = _log.extend('deleteImage')
    const error = _error.extend('deleteImage')
    if (!imageName) {
      const err = 'Missing required image name parameter.'
      error(err)
      throw new Error(err)
    }
    let deleted = false
    let index
    const image = this.#images.find((i, x) => {
      if (i.name === imageName) {
        index = x
        return true
      }
      return false
    })
    if (image) {
      const parts = path.parse(imageName)
      const imageStar = `${parts.name}*`
      let imagePath
      // const imagePath = path.join(this.#albumDir, imageStar)
      // log(imagePath)
      let files
      const re = new RegExp(imageStar)
      try {
        files = await fs.readdir(this.#albumDir)
      } catch (e) {
        error(e)
        throw new Error('readdir failed', { cause: e })
      }
      try {
        await files
          .filter((file) => re.test(file))
          .forEach(async (file) => {
            imagePath = path.join(this.#albumDir, file)
            log(`about to delete ${imagePath}`)
            deleted = (await fs.rm(imagePath) === undefined)
            log(`Image ${imagePath} was deleted? ${deleted}`)
          })
      } catch (e) {
        const err = `Failed to delete image file ${imageName}`
        error(err)
        error(e)
        throw new Error(err, { cause: e })
      }
      try {
        this.#images.splice(index, 1)
        const saved = await this.save()
        if (!saved) {
          throw new Error('Save() failed, but did not cause an exception.')
        }
      } catch (e) {
        const err = 'Image deleted, but failed to update gallery in db.'
        error(err)
        throw new Error(err, { cause: e })
      }
    }
    return deleted
  }

  /**
   * Delete the album.
   * @summary Delete the album.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @return { Booloean } - True if album is successfully deleted.
   */
  async deleteAlbum() {
    const log = _log.extend('deleteAlbum')
    const error = _error.extend('deleteAlbum')
    log(`About to delete album: ${this.#albumName}`)
    log(this.#albumDir)
    let deleted
    try {
      log(`Redis streamId: ${this.#streamId}`)
      const removed = await this.removeFromRedisStream()
      log(`streamId: ${removed}`)
      if (!removed) {
        deleted = false
      }
    } catch (e) {
      error(`failed to remove albumId ${this.#albumId}, `
        + `streamId ${this.#streamId} from redis stream.`)
      error(e)
      deleted = false
    }
    try {
      deleted = await fs.rm(path.resolve(this.#albumDir), { force: true, recursive: true })
    } catch (e) {
      error(e)
      return false
    }
    try {
      const filter = { _id: new ObjectId(this.#albumId) }
      const response = await this.#db.deleteOne(filter)
      if (response.deletedCount !== 1) {
        deleted = false
      }
    } catch (e) {
      error(`failed to remove albumId ${this.#albumId} from db.`)
      error(e)
      deleted = false
    }
    return (deleted === undefined)
  }

  /**
   * Save album json to db.
   * @summary Save album json to db.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @throws { Error } If no db collection is available.
   * @return { ObjectId|Boolean } Return the new monogdb objectId if successfully saved
   * to db, otherwise false.
   */
  async save() {
    const log = _log.extend('save')
    const error = _error.extend('save')
    if (!this.#db) {
      const msg = `No connection to client collection ${ALBUMS}`
      throw new Error(msg)
    }
    let saved
    let filter
    let theId
    if (this.#newAlbum) {
      theId = new ObjectId()
      this.#albumId = theId
      this.#newAlbum = false
    } else {
      theId = new ObjectId(this.#albumId)
    }
    log(`the _id is ${theId}`)
    if (!this.#albumJson) {
      this.#albumJson = await this.createAlbumJson()
    }
    try {
      if (this._albumPublic) {
        const add = await this.addToRedisStream()
        log(`album id: ${theId} was added to the redis recent10 stream?`, add)
      } else {
        log(`album id: ${theId}, streamId: ${this.#streamId}`)
        const remove = await this.removeFromRedisStream()
        log(`album id: ${theId} was removed from the redis recent10 stream.`, remove)
      }
    } catch (e) {
      saved.redis = { msg: 'Failed to add new album to redis stream.', e }
      error(e)
    }
    try {
      filter = { _id: new ObjectId(theId) }
      const options = { upsert: true }
      if (!this.#albumId) {
        this.#albumId = new ObjectId(this.#albumId)
        this.#albumJson._id = this.#albumId
        saved = await this.#db.insertOne(this.#albumJson)
      } else {
        log('save filter: %o', filter)
        log('replace doc: %O', this.#albumJson)
        // saved = await this.#db.replaceOne(filter, this.#albumJson, options)
        const update = {
          $set: {
            streamId: this.#streamId,
            dir: this.#albumDir,
            slug: this.#albumSlug,
            imageUrl: this.#albumImageUrl,
            creator: this.#albumOwner,
            name: this.#albumName,
            url: this.#albumUrl,
            previewImage: this.#albumPreviewImage,
            description: this.#albumDescription,
            keywords: Array.from(this.#albumKeywords),
            public: this._albumPublic,
            images: this.#images,
            post_id: this.#postId,
          },
        }
        if (this.#newAlbum) {
          update.$set._id = theId
        }
        log('the update doc: %o', update)
        saved = await this.#db.updateOne(filter, update, options)
        saved.insertedId = this.#albumId
      }
      log('Album save results: %o', saved)
    } catch (e) {
      const err = 'Failed to save album json to db.'
      error(err)
      throw new Error(err, { cause: e })
    }

    // modifiedCount, upsertedCount, upsertedId
    // if (!saved?.insertedId || saved?.upsertedCount < 1 || saved?.modifiedCount < 1) {
    if (saved?.modifiedCount < 1 && saved?.upsertedCount < 1 && saved?.matchedCount < 1) {
      return false
    }
    if (!this.#albumId) {
      this.#albumId = saved.insertedId.toString()
    }
    return saved
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
      const err = `Album dir ${this.#albumDir} is not in ${this.#rootDir}`
      throw new Error(err)
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
      const dirIt = await fs.opendir(
        this.#albumDir,
        { encoding: 'utf8', bufferSize: 32, recursive: true },
      )
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
   * @retuun { fs.Dir|null} - AsyncIterator of fs.Dir instance.  */
  async next() {
    if (this.#directoryIterator) {
      return this.#directoryIterator.read()
    }
    return null
  }

  /**
   * Add a new image to the gallery.
   * @summary Add a new image to the gallery.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { Object } newImage - An object containing new image to be added to the gallery.
   * @param { String } newImage.name - The name of the new image.
   * @param { Boolean } [skipSizes=false] - Don't make new sizes if True.
   * @throws { Error } - Throws an error for any async method.
   * @return { Object } result - Details of new image, sizes, urls, etc.
   */
  async addImage(newImage, skipSizes = false) {
    const log = _log.extend('addImage')
    const error = _error.extend('addImage')
    const result = {}
    log(`Adding new image to the gallery: ${newImage}`)
    if (!newImage) {
      const err = 'Missing required image.'
      error(err)
      return false
    }
    let exiftool
    let metadata
    let image
    try {
      exiftool = await new Exiftool().init(newImage)
    } catch (e) {
      error(`Failed to init exiftool with ${newImage}`)
      error(e)
    }
    try {
      exiftool.enableBinaryTagOutput(true)
      metadata = await exiftool.getMetadata(
        '',
        null,
        '-File:FileName -IPTC:ObjectName -MWG:all -preview:all -Composite:ImageSize',
      )
      log(metadata);
      [image] = metadata
    } catch (e) {
      const err = `Failed to get metadata for  ${newImage}`
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
    const img = image['File:FileName']
    const imageUrl = (this.#albumImageUrl)
      ? `${this.#albumImageUrl}${(this.#albumImageUrl.slice(-1) !== '/') ? '/' : ''}${img}`
      : ''
    let thumbName
    let thumbUrl
    if (image?.['EXIF:ThumbnailImage']) {
      const sourceParts = path.parse(imageUrl)
      thumbName = `${sourceParts.name}_thumbnail${sourceParts.ext}`
      const thumbPath = `${sourceParts.dir}/${thumbName}`
      const fullThumbPath = path.resolve('public', thumbPath)
      // log('thumb full path: ', fullThumbPath)
      thumbUrl = `${this.#albumImageUrl}${(this.#albumImageUrl.slice(-1) !== '/')
        ? '/'
        : ''}${thumbName}`
      log(`thumbUrl: ${thumbUrl} \n`)
      const buffer = Buffer.from(image['EXIF:ThumbnailImage'].slice(7), 'base64')
      try {
        await fs.writeFile(fullThumbPath, buffer)
      } catch (e) {
        const err = `Failed to create thumbnail image for ${image.SourceFile}\n`
                  + `save path: ${fullThumbPath}`
        error(err)
        error(e)
        throw new Error(err, { cause: e })
      }
    }
    let keywords
    log('keywords array? ', Array.isArray(image?.['Composite:Keywords']))
    if (image?.['Composite:Keywords']) {
      if (Array.isArray(image['Composite:Keywords'])) {
        keywords = image['Composite:Keywords']
      } else {
        keywords = [image['Composite:Keywords']]
      }
    }
    log('keywords array? ', Array.isArray(keywords))
    const tempImage = {
      name: img,
      url: imageUrl,
      big: null,
      med: null,
      sml: null,
      thumbnail: thumbUrl,
      title: image?.['IPTC:ObjectName'] ?? image?.['XMP:Title'],
      // keywords: image?.['Composite:Keywords'] ?? [],
      keywords: keywords ?? [],
      description: image?.['Composite:Description'],
      creator: image?.['Composite:Creator'] ?? this.#albumOwner,
      hide: false,
    }
    log('tempImage: %o', tempImage)
    result.title = tempImage.title
    result.keywords = tempImage.keywords
    result.description = tempImage.description
    this.#images.push(tempImage)
    let makeThumb = false
    if (!tempImage.thumbnail) {
      makeThumb = true
    }
    let sizes
    if (!skipSizes) {
      try {
        sizes = await this.generateSizes(img, makeThumb)
        result.sizes = sizes
      } catch (e) {
        const err = `Failed to create image sizes for ${newImage}`
        error(err)
        error(e)
        throw new Error(err, { cause: e })
      }
    }
    try {
      await this.save()
    } catch (e) {
      const err = `Failed to save changes to gallery after adding ${img}`
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
    log(result)
    return result
  }

  /**
   * Update saved details about an image, including committing changes into metadata.
   * @summary Update saved details about an image, including committing changes into metadata.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { Object } image=null - An object literal containing image details to update.
   * @param { string } image.name - The name of the image to update.
   * @param { string } [image.title] - The new title of the image.
   * @param { string } [image.description] - The new description of the image.
   * @param { string[] } [image.keywords] - An array of keywords for the image.
   * @param { Boolean } [image.hide] - Hide of show image in gallery.
   * @param { Object } [image.resize] - An object literal containing size to resize image to.
   * @param { Number } [image.resize.w] - Resize width.
   * @param { Number } [image.resize.h] - Resize height.
   * @param { String } [image.rotateFullSize] - Rotate the full size image by the given
   * number of degress.
   * @param { String } [image.rotateThumbnail] - Rotate the image thumbnail by the given
   * number of degress.
   * @param { Boolean } [remakeThumb] - Force remaking thumbnail images.
   * @return { Object|Boolean } - ...
   */
  async updateImage(image = null, remakeThumb = false) {
    const log = _log.extend('updateImage')
    const error = _error.extend('updateImage')
    const result = {}
    let newThumb = remakeThumb
    let embedThumbs = false
    let exiftool = new Exiftool()
    log(image)
    if (!image) {
      result.error = 'Missing required parameter: image.'
      error(result.error)
      return result
    }
    const index = this.#images.findIndex((i) => i.name === image.name)
    if (index === -1) {
      result.message = `${image.name} not found in this album.`
      log(result.message)
      return result
    }
    const tagArray = []
    if (image?.title) {
      tagArray.push(`-XMP:Title="${image.title}"`)
      tagArray.push(`-IPTC:ObjectName="${image.title}"`)
    }
    if (image?.description) {
      tagArray.push(`-MWG:Description="${image.description}"`)
    }
    if (image?.keywords) {
      tagArray.push(`-MWG:Keywords="${image.keywords.join(', ')}"`)
    }
    const theImage = path.resolve(`${this.#albumDir}/${image.name}`)
    log(`The image to update:     ${theImage}`)
    let theThumb
    if (image?.thumbnailName) {
      theThumb = path.resolve(`${this.#albumDir}/${image.thumbnailName}`)
    } else {
      const parsedName = path.parse(image.name)
      theThumb = path.resolve(`${this.#albumDir}/${parsedName.name}_thumbnail${parsedName.ext}`)
    }
    log(`The thumbnail to update: ${theThumb}`)
    try {
      exiftool = await exiftool.init(theImage)
    } catch (e) {
      error(e)
      throw new Error('failed to init exiftool', { cause: e })
    }
    if (tagArray.length > 0) {
      log('tags to be updated:', tagArray)
      try {
        exiftool.setOverwriteOriginal(true)
        result.metadata = await exiftool.writeMetadataToTag(tagArray)
        log(result)
        delete result.metadata.command
        if (image?.title) {
          this.#images[index].title = image.title
        }
        if (image?.description) {
          this.#images[index].description = image.description
        }
        if (image?.keywords) {
          this.#images[index].keywords = image.keywords
        }
        if (image?.hide !== undefined) {
          this.#images[index].hide = image.hide
        }
        newThumb = false
      } catch (e) {
        const err = `Failed to update metadata for image: ${theImage}`
        result.error = err
        error(err)
        error(result)
        error(e)
      }
    }
    this.#images[index].hide = image.hide
    if (image?.rotateFullSize) {
      log(`about to rotate full size image by ${image.rotateFullSize} degrees.`)
      try {
        await this.rotateImage(theImage, image.rotateFullSize)
        newThumb = true
      } catch (e) {
        error(e.message)
        const msg = `Image Magick failed to rotate image: ${theImage} ${image.rotateFullSize} deg`
        error(msg)
        throw new Error(msg, { cause: e })
      }
      // log(`About to rotate thumbnail image by ${image.rotateFullSize} degrees...`)
      // log(`because the full size image was just rotated by ${image.rotateFullSize} degrees.`)
      // try {
      //   await this.rotateImage(theThumb, image.rotateFullSize)
      //   embedThumbs = true
      // } catch (e) {
      //   error(e.message)
      //   const msg = `Image Magick failed to rotate thumbnail image: `
      //     + `${theThumb} ${image.rotateFullSize} deg`
      //   error(msg)
      //   throw new Error(msg, { cause: e })
      // }
    }
    if (image?.rotateThumbnail) {
      log(`About to rotate thumbnail image by ${image.rotateThumbnail} degrees.`)
      try {
        await this.rotateImage(theThumb, image.rotateThumbnail)
        if (!image?.rotateFullSize) {
          newThumb = false
        }
        embedThumbs = true
      } catch (e) {
        error(e.message)
        const msg = `Image Magick failed to rotate thumbnail image: ${theThumb} `
          + `${image.rotateThumbnail} deg`
        error(msg)
        throw new Error(msg, { cause: e })
      }
    }
    if (embedThumbs) {
      log(`About to embed the thumbnail ${theThumb} \ninto the image ${theImage}`)
      try {
        const setThumbResult = await exiftool.setThumbnail(theThumb)
        log(setThumbResult)
        result.thumbnail = { didEmbed: true }
      } catch (e) {
        const msg = `Exiftool failed to embed new thumbnail ${theThumb} \ninto ${theImage}`
        error(msg)
        error(e)
        throw new Error(msg, { cause: e })
      }
    }
    if (image?.resize) {
      try {
        // TODO: create resizeImage() method
        // await this.resizeImage(image.resize)
        // newThumb = true // maybe
      } catch (e) {
        const msg = `Image Magick failed up resize image: ${theImage}`
        error(msg)
        throw new Error(msg, { cause: e })
      }
    }
    log('remakeThumb: ', remakeThumb)
    log('newThumb:    ', newThumb)
    if (image?.rotateFullSize) {
      try {
        let x = false
        if (remakeThumb || newThumb) {
          log(`remakeThumb: ${remakeThumb}, newThumb: ${newThumb}`)
          x = true
        }
        const sizes = await this.generateSizes(image.name, x)
        result.sizes = sizes
        log(sizes)
      } catch (e) {
        const msg = `Image Magick failed to regenerate the image sizes for: ${image.name}`
        error(msg)
        throw new Error(msg, { cause: e })
      }
    }
    try {
      result.save = await this.save()
    } catch (e) {
      const err = 'Failed to save changes to db.'
      result.error += `\n${err}`
      error(err)
      error(result)
      error(e)
    }
    return result
  }

  /*
   * Extract the metadata from the images in the album.
   * @summary Extract the metadata from the images in the album.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @return { Object|Boolean } - The extracted metadata in JSON format, or false if
   * no images found.
   */
  async getMetadata() {
    const log = _log.extend('getMetadata')
    const error = _error.extend('getMetadata')
    if (this.#images.length < 1) {
      return false
    }
    if (this.#images[0]?.url === undefined) {
      const tempImagesArray = []
      const exiftool = await new Exiftool().init(this.#albumDir)
      exiftool.enableBinaryTagOutput(true)
      this._metadata = await exiftool.getMetadata(
        '',
        null,
        '-File:FileName -IPTC:ObjectName -MWG:all -preview:all -Composite:ImageSize',
      )
      /* eslint-disable-next-line */
      for await (const img of this.#images) {
        const image = this._metadata.find((m) => m['File:FileName'] === img) ?? {}
        if (image) {
          // log(`this.#albumImageUrl: ${this.#albumImageUrl}`)
          const imageUrl = (this.#albumImageUrl)
            ? `${this.#albumImageUrl}${(this.#albumImageUrl.slice(-1) !== '/')
              ? '/'
              : ''}${img}`
            : ''
          log(`imageUrl: ${imageUrl}`)
          let thumbName
          let thumbUrl
          if (image?.['EXIF:ThumbnailImage']) {
            // log('has thumbnail data')
            const sourceParts = path.parse(imageUrl)
            thumbName = `${sourceParts.name}_thumbnail${sourceParts.ext}`
            const thumbPath = `${sourceParts.dir}/${thumbName}`
            const fullThumbPath = path.resolve('public', thumbPath)
            // log('thumb full path: ', fullThumbPath)
            thumbUrl = `${this.#albumImageUrl}${(this.#albumImageUrl.slice(-1) !== '/')
              ? '/'
              : ''}${thumbName}`
            log(`thumbUrl: ${thumbUrl} \n`)
            const buffer = Buffer.from(image['EXIF:ThumbnailImage'].slice(7), 'base64')
            try {
              await fs.writeFile(fullThumbPath, buffer)
            } catch (e) {
              error(`Failed to create thumbnail image for ${image.SourceFile}`)
              error(`save path: ${fullThumbPath}`)
              error(e)
            }
          }
          tempImagesArray.push({
            name: img,
            url: imageUrl,
            big: imageUrl,
            med: null,
            sml: null,
            // size: image?.['Composite:ImageSize'] ?? null,
            thumbnail: thumbUrl,
            title: image?.['IPTC:ObjectName'] ?? image?.['XMP:Title'],
            keywords: image?.['Composite:Keywords'] ?? [],
            description: image?.['Composite:Description'],
            creator: image?.['Composite:Creator'] ?? this.#albumOwner,
            hide: false,
          })
          log('tempImagesArray: %o', tempImagesArray)
        }
        this.#images = tempImagesArray
      }
    }
    return this._metadata
  }

  /**
   * Generate the various sizes plus a thumbnail for an image.
   * @summary Generate the various sizes plus a thumbnail for an image.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { String } image - A string name value of an image to create a thumbnail of.
   * @param { Boolean } remakeThumb - If true, force remaking thumbnail images.
   * @return { undefined }
   */
  async generateSizes(image, remakeThumb) {
    const log = this.#log.extend('generateSizes')
    const error = this.#error.extend('generateSizes')
    const imageUrl = (this.#albumImageUrl)
      ? `${this.#albumImageUrl}${(this.#albumImageUrl.slice(-1) !== '/') ? '/' : ''}${image}`
      : ''
    log(`imageUrl: ${imageUrl}`)
    let newJpegBig
    let newJpegMed
    let newJpegSml
    let big
    let med
    let sml
    let thb
    let orientation
    const magick = new Magick.Image()
    const parts = path.parse(image)
    log(parts)
    const original = `${this.#albumDir}/${image}`
    let format
    try {
      log(`opening ${original} in Image Magick`)
      await magick.readAsync(original)
      // magick.read(original)
      // const geometry = await magick.sizeAsync()
      const geometry = magick.size()
      if (geometry.width() > geometry.height()) {
        orientation = 'landscape'
        newJpegBig = `${parts.name}_${LANDSCAPE_BIG}.jpg`
        big = LANDSCAPE_BIG
        newJpegMed = `${parts.name}_${LANDSCAPE_MED}.jpg`
        med = LANDSCAPE_MED
        newJpegSml = `${parts.name}_${LANDSCAPE_SML}.jpg`
        sml = LANDSCAPE_SML
      } else {
        orientation = 'portrait'
        newJpegBig = `${parts.name}_${PORTRAIT_BIG}.jpg`
        big = PORTRAIT_BIG
        newJpegMed = `${parts.name}_${PORTRAIT_MED}.jpg`
        med = PORTRAIT_MED
        newJpegSml = `${parts.name}_${PORTRAIT_SML}.jpg`
        sml = PORTRAIT_SML
      }
      thb = `${parts.name}_thumbnail.jpg`
      log(`Image geometry is: ${geometry.toString()}, ${orientation}`)
    } catch (e) {
      const msg = `Image Magick failed to open image: ${original}`
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      // format = await magick.magickAsync()
      format = magick.magick()
      log(`Image file format: ${format}`)
    } catch (e) {
      const msg = 'Image Magick failed to get image file format.'
      throw new Error(msg, { cause: e })
    }
    if (!['jpeg', 'jpg', 'png'].includes(format.toLowerCase())) {
      try {
        log('convert file format to JPG')
        await magick.magick('jpg')
      } catch (e) {
        const msg = 'image Magick failed to convert to JPG.'
        throw new Error(msg, { cause: e })
      }
    }
    const theImage = this.#images.find((i) => i.name === image)
    log('theImage: ', theImage)
    let b
    try {
      log(`resizing to ${big}, ${orientation}`)
      await magick.resizeAsync(big)
    } catch (e) {
      const msg = `Imaged Magick failed to resize (${big}) ${b}.`
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    try {
      b = path.join(this.#albumDir, newJpegBig)
      log('b: ', b)
      await magick.writeAsync(b)
      theImage.big = path.join(this.#albumImageUrl, newJpegBig)
    } catch (e) {
      const msg = `Imaged Magick failed to save ${b}.`
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    let m
    try {
      log(`resizing to ${med}, ${orientation}`)
      await magick.resizeAsync(med)
    } catch (e) {
      const msg = `Imaged Magick failed to resize (${med}) ${m}.`
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    try {
      m = path.join(this.#albumDir, newJpegMed)
      log('m: ', m)
      await magick.writeAsync(m)
      theImage.med = path.join(this.#albumImageUrl, newJpegMed)
    } catch (e) {
      const msg = `Imaged Magick failed to save ${m}.`
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    let s
    try {
      log(`resizing to ${sml}, ${orientation}`)
      await magick.resizeAsync(sml)
    } catch (e) {
      const msg = `Imaged Magick failed to resize (${sml}) ${s}.`
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    try {
      s = path.join(this.#albumDir, newJpegSml)
      log('s: ', s)
      await magick.writeAsync(s)
      theImage.sml = path.join(this.#albumImageUrl, newJpegSml)
    } catch (e) {
      const msg = `Imaged Magick failed to save ${s}.`
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    if (remakeThumb || !theImage.thumbnail) {
      let t
      try {
        log(`creating thumbnail (${THUMBNAIL})`)
        await magick.stripAsync()
        await magick.resizeAsync(THUMBNAIL)
      } catch (e) {
        const msg = `Imaged Magick failed to resize (${THUMBNAIL}) ${t}.`
        error(msg)
        error(e)
        throw new Error(msg, { cause: e })
      }
      try {
        t = path.join(this.#albumDir, thb)
        log('t: ', t)
        await magick.writeAsync(t)
        theImage.thumbnail = path.join(this.#albumImageUrl, thb)
      } catch (e) {
        const msg = `Imaged Magick failed to save ${t}.`
        error(msg)
        error(e)
        throw new Error(msg, { cause: e })
      }
    }
    return {
      big: theImage.big,
      med: theImage.med,
      sml: theImage.sml,
      thb: theImage.thumbnail,
    }
  }

  /**
   * Rotate an image by the given number of degrees.
   * @summary Rotate an image by the given number of degrees.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { String } i - The name of the image to be rotated.
   * @param { Number } d - The number of degrees to rotate the image, counter-clockwise.
   * @throws { Error } Throws an error if Image Magick fails to rotate the image.
   * @return { undefined }
   */
  async rotateImage(i, d) {
    const log = this.#log.extend('rotateImage')
    const error = this.#error.extend('rotateImage')
    const imagePath = i
    log(`imagePath: ${imagePath}`)
    const deg = Number.parseInt(d, 10)
    log(`typeof deg: ${typeof deg}, value: ${deg}`)
    const magick = new Magick.Image()
    try {
      await magick.readAsync(imagePath)
      // magick.read(imagePath)
    } catch (e) {
      const err = `magick.readAsync(${imagePath}) failed to open image.`
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
    try {
      const rotated = await magick.rotateAsync(deg)
      // const rotated = magick.rotate(Number.parseInt(deg, 10))
      log(`Image Magick rotated ${imagePath} by ${deg} degrees (${rotated})`)
    } catch (e) {
      const err = `magick.rotateAsync(${deg}) failed to rotate ${deg} deg image: ${imagePath}`
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
    try {
      // TODO: something, something, something... dark siiiiiide...
      // magickwand.js can't encode (save) .HEIC files... so this causes
      // rotating image form widget to fail if original file is .HEIC
      // Need to think of something to do here.
      await magick.writeAsync(imagePath)
      // magick.write(imagePath)
    } catch (e) {
      const err = `magick.writeAsync(${imagePath}) failed to save rotated image.`
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
  }

  /**
   * Build the JSON object for the album.
   * @summary Build the JSON object for the album.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @throws Error
   * @return { Object }
   */
  async createAlbumJson() {
    const json = {
      _id: this.#albumId,
      dir: this.#albumDir,
      slug: this.#albumSlug,
      imageUrl: this.#albumImageUrl,
      creator: this.#albumOwner,
      name: this.#albumName,
      url: this.#albumUrl,
      description: this.#albumDescription,
      keywords: Array.from(this.#albumKeywords),
      public: this._albumPublic,
      images: this.#images,
    }
    if (this.#postId) {
      json.postId = this.#postId
    }
    return json
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
    const skip = { sizes: true, metadata: true }
    return this.init(null, skip)
  }

  addKeyword(word) {
    return Array.from(this.#albumKeywords.add(word))
  }

  removeKeyword(word) {
    return this.#albumKeywords.delete(word)
  }

  get id() {
    if (this.#albumId) {
      _log(`returning _id: ${this.#albumId}`)
      return this.#albumId
    }
    _log('undefined id')
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

  get imageUrl() {
    return this.#albumImageUrl
  }

  // set imageUrl(i) {
  //   this.#noop = undefined
  //   _log('imageUrl setter is a no-op property.')
  // }

  get images() {
    return this.#images
  }

  set previewImage(url) {
    this.#albumPreviewImage = url
  }

  get previewImage() {
    return this.#albumPreviewImage
  }

  get name() {
    return this.#albumName
  }

  set name(name) {
    this.#albumName = name
  }

  set slug(s) {
    this.#albumSlug = s
  }

  get slug() {
    return this.#albumSlug
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

  set keywords(words) {
    // console.log(words)
    words.forEach((word) => {
      this.#albumKeywords.add(word)
    })
  }

  get keywords() {
    console.log(this.#albumKeywords)
    return Array.from(this.#albumKeywords)
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

  get postId() {
    return this.#postId
  }

  set postId(id) {
    this.#postId = id
  }
}

export { Album }
// export { Albums } from './Albums.js'
