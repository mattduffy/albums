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

  #albumOwner

  #albumJson

  #albumKeywords

  #albumDescription

  #directoryIterator

  /**
   * Create an instance of Album.
   * @summary Create an instance of Album.
   * @param { Object } config - An object literal containing configuration properties.
   * @param { Boolean } [config.new = false] - True only if creating a new album.
   * @param { string } config.rootDir - A string path for the root directory for all albums.
   * @param { string } config.albumId - A string of the unique album id.
   * @param { string } config.albumDir - A string of the album file system path.
   * @param { string } config.albumUrl - Path portion of public url for the album.
   * @param { string } config.albumPreviewImage - Path portion of the url to show album preview image.
   * @param { string } config.albumImageUrl - Path portion of the public href url from the album images.
   * @param { string } config.albumName - The name of the album.
   * @param { string } config.albumOwer - The name of the album owner.
   * @param { string } config.albumKeywords - The keywords of the album.
   * @param { string } config.albumDescription - The description of the album.
   * @param { Object[] } config.albumImages - An array of JSON objects, each describing an image.
   * @param { Boolean } config.public - The visibilty status of the album.
   * @param { Object } config.redis - An instance of a redis connection.
   * @param { string } [config.streamId = null] - A stream id for redis recently added stream.
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
    // pseudo-protected properties
    // this._directoryIterator = null
    this._albumPublic = config?.public ?? false
    this._numberOfImages = this.#images?.length ?? 0
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
    if (dirPath) {
      this.#albumDir = path.resolve(dirPath)
    } else {
      this.#albumDir = path.resolve(this.#albumDir)
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
    log(this.#rootDir, '/', this.#albumDir)
    if (!this.#albumUrl) {
      this.#albumUrl += parsedAlbumPath.base
      log(`#album url: ${this.#albumUrl}`)
    }
    if (!this.#albumImageUrl) {
      this.#albumImageUrl += parsedAlbumPath.base
      log(`#album image url: ${this.#albumImageUrl}`)
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
    try {
      await this.getMetadata()
    } catch (e) {
      const msg = 'Exiftool failed.'
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      this.#images.forEach(async (img) => {
        this.generateSizes(img.name)
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
   * @return { Boolean|undefined } - Returns true if successfully removed from the redis stream.
   */
  async removeFromRedisStream() {
    const log = _log.extend('removeFromRedisStream')
    const error = _error.extend('removeFromRedisStream')
    // if (!this._albumPublic) {
    //   return undefined
    // }
    if (this.#streamId) {
      try {
        const response = await this.#redis.xdel('albums:recent:10', this.#streamId)
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
        const clear = await this.#redis.xdel('albums:recent:10', this.#streamId)
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
        name: this.#albumName,
        owner: this.#albumOwner,
        access: this._albumPublic,
        preview: this.#albumPreviewImage,
        description: this.#albumDescription,
      }
      response = await this.#redis.xadd('albums:recent:10', '*', 'album', JSON.stringify(entry))
      log('xadd response: ', response)
      this.#streamId = response
    } catch (e) {
      error(e)
      return false
    }
    return true
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
      error(`failed to remove albumId ${this.#albumId}, streamId ${this.#streamId} from redis stream.`)
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
    let filter
    let theId
    if (this.#newAlbum) {
      theId = new ObjectId()
      this.#albumId = theId
    } else {
      theId = new ObjectId(this.#albumId)
    }
    log(`the _id is ${theId}`)
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
        log('replace doc: %o', this.#albumJson)
        // saved = await this.#db.replaceOne(filter, this.#albumJson, options)
        const update = {
          $set: {
            streamId: this.#streamId,
            dir: this.#albumDir,
            imageUrl: this.#albumImageUrl,
            creator: this.#albumOwner,
            name: this.#albumName,
            url: this.#albumUrl,
            previewImage: this.#albumPreviewImage,
            description: this.#albumDescription,
            keywords: Array.from(this.#albumKeywords),
            public: this._albumPublic,
            images: this.#images,
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
   * @retuun { fs.Dir|null} - AsyncIterator of fs.Dir instance.  */
  async next() {
    if (this.#directoryIterator) {
      return this.#directoryIterator.read()
    }
    return null
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
   * @param { String } [image.rotate] - Rotate the image by the given number of degress.
   * @param { Boolean } [remakeThumbs] - Force remaking thumbnail images.
   * @return { Object|Boolean } - ...
   */
  async updateImage(image = null, remakeThumbs = false) {
    const log = _log.extend('updateImage')
    const error = _error.extend('updateImage')
    const result = {}
    let newThumbs = false
    let exiftool
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
    log(`The image to update: ${theImage}`)
    log('tags to be updated:', tagArray)
    // If no tagArray is empty, no metadata update necessary
    if (tagArray.length < 0) {
      // log(tagArray.join(' '))
      try {
        exiftool = await new Exiftool().init(theImage)
        exiftool.setOverwriteOriginal(true)
        result.metadata = await exiftool.writeMetadataToTag(tagArray)
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
        newThumbs = true
      } catch (e) {
        const err = `Failed to update metadata for image: ${theImage}`
        result.error = err
        error(err)
        error(result)
        error(e)
      }
    }
    this.#images[index].hide = image.hide
    try {
      if (image?.rotate) {
        await this.rotateImage(theImage, image.rotate)
        // this.rotateImage(theImage, image.rotate)
        newThumbs = true
      }
    } catch (e) {
      error(e.message)
      const msg = `Image Magick failed to rotate image: ${theImage}`
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      if (image?.resize) {
        // TODO: create resizeImage() method
        // await this.resizeImage(image.resize)
        // newThumbs = true // maybe
      }
    } catch (e) {
      const msg = `Image Magick failed up resize image: ${theImage}`
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      log(`remakeThumbs: ${remakeThumbs}, newThumbs: ${newThumbs}`)
      if (remakeThumbs || newThumbs) {
        // await this.generateSizes(theOGImage)
        const sizes = this.generateSizes(image.name, remakeThumbs)
        result.sizes = sizes
        log(sizes)
      }
    } catch (e) {
      const msg = `Image Magick failed to regenerate the image sizes for: ${image.name}`
      error(msg)
      throw new Error(msg, { cause: e })
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
   * @return { Oject|Boolean } - The extracted metadata in JSON format, or false if no images found.
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
      this._metadata = await exiftool.getMetadata('', null, '-File:FileName -IPTC:ObjectName -MWG:all -preview:all -Composite:ImageSize')
      /* eslint-disable-next-line */
      for await (const img of this.#images) {
        const image = this._metadata.find((m) => m['File:FileName'] === img) ?? {}
        if (image) {
          // log(`this.#albumImageUrl: ${this.#albumImageUrl}`)
          const imageUrl = (this.#albumImageUrl) ? `${this.#albumImageUrl}${(this.#albumImageUrl.slice(-1) !== '/') ? '/' : ''}${img}` : ''
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
            thumbUrl = `${this.#albumImageUrl}${(this.#albumImageUrl.slice(-1) !== '/') ? '/' : ''}${thumbName}`
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
   * @param { Boolean } remakeThumbs - If true, force remaking thumbnail images.
   * @return { undefined }
   */
  // async generateSizes(image, remakeThumbs) {
  generateSizes(image, remakeThumbs) {
    const log = this.#log.extend('generateSizes')
    const error = this.#error.extend('generateSizes')
    const imageUrl = (this.#albumImageUrl) ? `${this.#albumImageUrl}${(this.#albumImageUrl.slice(-1) !== '/') ? '/' : ''}${image}` : ''
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
      // await magick.readAsync(original)
      magick.read(original)
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
        log('convert file format to JPEG')
        // await magick.magick('jpg')
        magick.magick('jpg')
      } catch (e) {
        const msg = 'image Magick failed to convert to JPEG.'
        throw new Error(msg, { cause: e })
      }
    }
    try {
      const theImage = this.#images.find((i) => i.name === image)

      log(`resizing to ${big}, ${orientation}`)
      // await magick.resizeAsync(big)
      magick.resize(big)
      const b = path.join(this.#albumDir, newJpegBig)
      log(b)
      // await magick.writeAsync(b)
      magick.write(b)
      theImage.big = path.join(this.#albumImageUrl, newJpegBig)

      log(`resizing to ${med}, ${orientation}`)
      // await magick.resizeAsync(med)
      magick.resize(med)
      const m = path.join(this.#albumDir, newJpegMed)
      log(m)
      // await magick.writeAsync(m)
      magick.write(m)
      theImage.med = path.join(this.#albumImageUrl, newJpegMed)

      log(`resizing to ${sml}, ${orientation}`)
      // await magick.resizeAsync(sml)
      magick.resize(sml)
      const s = path.join(this.#albumDir, newJpegSml)
      log(s)
      // await magick.writeAsync(s)
      magick.write(s)
      theImage.sml = path.join(this.#albumImageUrl, newJpegSml)

      if (!theImage.thumbnail || remakeThumbs) {
        log(`creating thumbnail (${THUMBNAIL})`)
        // await magick.stripAsync()
        // await magick.resizeAsync(THUMBNAIL)
        magick.strip()
        magick.resize(THUMBNAIL)
        const t = path.join(this.#albumDir, thb)
        log(t)
        magick.write(t)
        // await magick.writeAsync(t)
        theImage.thumbnail = path.join(this.#albumImageUrl, thb)
      }
      return {
        big: theImage.big,
        med: theImage.med,
        sml: theImage.sml,
        thb: theImage.thumbnail,
      }
    } catch (e) {
      const msg = 'Imaged Magick failed to resize image.'
      throw new Error(msg, { cause: e })
    }
  }

  /**
   * Rotate an image by the given number of degrees.
   * @summary Rotate an image by the given number of degrees.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { String } imageName - The name of the image to be rotated.
   * @param { Number } degrees - The number of degrees to rotate the image, counter-clockwise.
   * @return { undefined }
   */
  async rotateImage(imageName, degrees) {
    const log = this.#log.extend('rotateImage')
    const error = this.#error.extend('rotateImage')
    const imagePath = imageName
    log(`imagePath: ${imagePath}`)
    const deg = Number.parseInt(degrees, 10)
    log(`typeof deg: ${typeof deg}, value: ${deg}`)
    const magick = new Magick.Image()
    try {
      await magick.readAsync(imagePath)
      // magick.read(imagePath)
    } catch (e) {
      const err = `magick.readAsync(${imagePath}) failed to open image.`
      error(err)
      throw new Error(err, { cause: e })
    }
    try {
      const rotated = await magick.rotateAsync(deg)
      // const rotated = magick.rotate(Number.parseInt(deg, 10))
      log(`Image Magick rotated ${imagePath} by ${deg} degrees (${rotated})`)
    } catch (e) {
      const err = `magick.rotateAsync(${deg}) failed to rotate ${deg} deg image: ${imagePath}`
      error(err)
      throw new Error(err, { cause: e })
    }
    try {
      await magick.writeAsync(imagePath)
      // magick.write(imagePath)
    } catch (e) {
      const err = `magick.writeAsync(${imagePath}) failed to save rotated image.`
      error(err)
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
    return {
      _id: this.#albumId,
      dir: this.#albumDir,
      imageUrl: this.#albumImageUrl,
      creator: this.#albumOwner,
      name: this.#albumName,
      url: this.#albumUrl,
      description: this.#albumDescription,
      keywords: Array.from(this.#albumKeywords),
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

  addKeyword(word) {
    return Array.from(this.#albumKeywords.add(word))
  }

  removeKeyword(word) {
    return this.#albumKeywords.delete(word)
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
}

export { Album }
// export { Albums } from './Albums.js'
