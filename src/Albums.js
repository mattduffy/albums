/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/Albums.js An interface to work with multiple albums.
 */

// import { Album } from './index.js'

const ALBUMS = 'albums'

class Albums {
  #redis

  #mongo

  constructor(config = {}) {
    this.#redis = config?.redis ?? null
    this.#mongo = config?.mongo ?? null
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
    console.log(`Looking for albums for user: ${user}`)
    // const albumCursor = await collection.find({ albumOwner: user }).toArray()
    const albumCursor = await collection.find({ creator: user }, { projection: { name: 1, public: 1, url: 1 } }).toArray()
    console.log('albumCursor: %o', albumCursor)
    return albumCursor
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
    console.log(response)
    // [ [ '1687734539621-0', [ 'album', '{"name":"Here is a sixth one"}' ] ] ]
    const recent10 = response.map((a) => JSON.parse(a[1][1]))
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
    return publicList
  }
}
export {
  Albums,
}
