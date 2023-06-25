/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/Albums.js An interface to work with multiple albums.
 */

import { Album } from './index.js'

class Albums {
  #redis

  #mongo

  constructor(config = {}) {
    this.#redis = config?.redis ?? null
    this.#mongo = config?.mongo ?? null
  }

  static async recentlyAdded(redis, count = 10) {
    const recentlyAddedStream = 'albums:recent:10'
    const recent10 = await redis.xrevrange(recentlyAddedStream, '+', '-', 'COUNT', count)
    return recent10
  }

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
