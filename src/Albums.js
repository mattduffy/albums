/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/Albums.js An interface to work with multiple albums.
 */

import { Album } from './index.js'
import { ObjectId } from '../lib/mongodb-client.js'

const ALBUMS = 'albums'

class Albums {
  #redis

  #mongo

  constructor(config = {}) {
    this.#redis = config?.redis ?? null
    this.#mongo = config?.mongo ?? null
  }

  /*
   * Find a saved album in the database by given id value and return as an Album instance.
   * @summary Find a saved album in the database by give id value and return as an Album instance.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { MongoClient|Collection } mongo - Either a mongodb client connection or its album collection.
   * @param { Redis } redis - A redis clint connection instance.
   * @param { String } id - The string value of an ObjectId to search the db for.
   * @return { Album|Boolean } - A populated instance of an Album if found, otherwise false.
   */
  static async getById(mongo, id, redis) {
    if (!mongo) return false
    if (!id) return false
    let collection
    if (!mongo.s.namespace.collection) {
      console.log('Setting db collection to: ', ALBUMS)
      collection = mongo.collection(ALBUMS)
    } else {
      console.log('Collection is already set: ', mongo.collectionName)
      collection = mongo
    }
    let found
    try {
      found = await collection.findOne({ _id: new ObjectId(id) })
      console.log(found.keywords)
      found.collection = collection
      found.redis = redis
      return new Album(found)
    } catch (e) {
      console.error(`Failed to find album by id: ${id}`)
      console.error(e)
      return false
    }
  }

  /*
   * Return a list of public and private albums for a specific user account.
   * @summary Return a list of public and private albums for a specific user account.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { (MongoClient|Collection) } mongo - Either a mongodb client connection or its ablum collection.
   * @param { String } username - The name of user for album list.
   * @return { (Object|Boolean) } - An object literal with public and private list, or false if none found.
   */
  static async list(mongo, user) {
    if (!mongo) return false
    if (!user) return false
    let collection
    if (!mongo.s.namespace.collection) {
      console.log('Setting db collection to: ', ALBUMS)
      collection = mongo.collection(ALBUMS)
    } else {
      console.log('Collection is already set: ', mongo.collectionName)
      collection = mongo
    }
    const pipeline = []
    const match = {
      $match: {
        creator: user,
      },
    }
    const bucket = {
      $bucket: {
        groupBy: '$public',
        boundaries: [false, true],
        default: 'public',
        output: {
          count: { $sum: 1 },
          albums: {
            $push: {
              id: '$_id',
              public: '$public',
              name: '$name',
              description: '$description',
            },
          },
        },
      },
    }
    pipeline.push(match)
    pipeline.push(bucket)
    pipeline.push({ $match: { count: { $gt: 0 } } })
    console.log(pipeline)
    console.log(`Looking for albums for user: ${user}`)
    // const albumCursor = await collection.find({ albumOwner: user }).toArray()
    // const albumCursor = await collection.find({ creator: user }, { projection: { name: 1, public: 1, url: 1 } }).toArray()
    const albumBuckets = await collection.aggregate(pipeline).toArray()
    // console.log('albumBuckets: %o', albumBuckets)
    return albumBuckets
  }

  /*
   * Return a list of recently added albums.
   * @summary Return a list of recently added albums.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { RedisClient } redis - Client connection to redis.
   * @param { number } [count=10] - Number of recently added albums to return, default is 10.
   * @returm { Array } - An array of recently added albums.
   */
  static async recentlyAdded(redis, count = 10) {
    const recentlyAddedStream = 'albums:recent:10'
    const response = await redis.xrevrange(recentlyAddedStream, '+', '-', 'COUNT', count)
    console.log(`redis: xrevrange ${recentlyAddedStream} + - COUNT ${count}`)
    console.log(response)
    // [ [ '1687734539621-0', [ 'album', '{"name":"Here is a sixth one"}' ] ] ]
    const recent10 = response.map((a) => JSON.parse(a[1][1]))
    console.log(recent10)
    return recent10
  }

  /*
   * Return a list of users with publicly accessible albums.
   * @summary Return a list of users with publicly accessible albums.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { (MongoClient|Collection) } mongo - Either a mongodb client connection or its ablum collection.
   * @return { (Array|Boolean) } An array of usernames of false if none found.
   */
  static async usersWithPublicAlbums(mongo) {
    const publicAlbumsView = 'publicAlbumsView'
    const collection = mongo.collection(publicAlbumsView)
    const publicList = await collection.find().toArray()
    console.log(publicList)
    return publicList
  }
}
export {
  Albums,
}
