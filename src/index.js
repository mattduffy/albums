/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/index.js The Album class definition file.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { Exiftool } from '@mattduffy/exiftool' // eslint-disable-line import/no-unresolved
import { Image } from './image.js'
import { ObjectId } from '../lib/mongodb-client.js'
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
   * @param { string } config.rootDir - A string path for the root directory for all albums.
   * @param { string } config.albumId - A string of the unique album id.
   * @param { string } config.albumDir - A string of the album file system path.
   * @param { string } config.albumUrl - Path portion of public url for the album.
   * @param { string } config.albumImageUrl - Path portion of the public href url from the album images.
   * @param { string } config.albumName - The name of the album.
   * @param { string } config.albumOwer - The name of the album owner.
   * @param { string } config.albumKeywords - The keywords of the album.
   * @param { string } config.albumDescription - The description of the album.
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
    this.#redis = config?.redis ?? null
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
      const filter = { _id: new ObjectId(this.#albumId) }
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
            dir: this.#albumDir,
            imageUrl: this.#albumImageUrl,
            creator: this.#albumOwner,
            name: this.#albumName,
            url: this.#albumUrl,
            description: this.#albumDescription,
            keywords: Array.from(this.#albumKeywords),
            public: this._albumPublic,
            images: this.#images,
          },
        }
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
    if (!saved?.insertedId || saved?.modifiedCount < 1) {
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
   * @return { Object|Boolean } - ...
   */
  async updateImage(image = null) {
    const log = _log.extend('updateImage')
    const error = _error.extend('updateImage')
    let exiftool
    const result = {}
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
    if (image?.title !== '') {
      tagArray.push(`-XMP:Title="${image.title}"`)
      tagArray.push(`-IPTC:ObjectName="${image.title}"`)
    }
    if (image?.description !== '') {
      tagArray.push(`-MWG:Description="${image.description}"`)
    }
    if (image?.keywords) {
      tagArray.push(`-MWG:Keywords="${image.keywords.join(', ')}"`)
    }
    const theImage = path.resolve(`${this.#albumDir}/${image.name}`)
    log(`The image to update: ${theImage}`)
    log(tagArray)
    log(tagArray.join(' '))
    try {
      exiftool = await new Exiftool().init(theImage)
      exiftool.setOverwriteOriginal(true)
      result.metadata = await exiftool.writeMetadataToTag(tagArray)
      if (image?.title) {
        this.#images[index].title = image.title
      }
      if (image?.description) {
        this.#images[index].description = image.description
      }
      if (image?.keywords) {
        this.#images[index].keywords = image.keywords
      }
    } catch (e) {
      const err = `Failed to update metadata for image: ${theImage}`
      result.error = err
      error(err)
      error(result)
      error(e)
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
      this._metadata = await exiftool.getMetadata('', null, '-File:FileName -IPTC:ObjectName -MWG:all -preview:all')
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
            thumbnail: thumbUrl,
            title: image?.['IPTC:ObjectName'] ?? image?.['XMP:Title'],
            keywords: image?.['Composite:Keywords'] ?? [],
            description: image?.['Composite:Description'],
            creator: image?.['Composite:Creator'] ?? this.#albumOwner,
          })
          log('tempImagesArray: %o', tempImagesArray)
        }
        this.#images = tempImagesArray
      }
    }
    return this._metadata
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
