/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file lib/redis-client.js The low-level connection object of redis.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import * as Dotenv from 'dotenv'
import { Redis as Io } from 'ioredis'
// import {
//   Repository,
//   Entity,
//   Schema,
//   Client as Om,
// } from 'redis-om'

const root = path.resolve('./')
Dotenv.config({ path: path.resolve(root, 'config/redis.env'), debug: true })

const sentinelPort = process.env.SENTINEL_PORT ?? 36379
const redisConnOpts = {
  sentinels: [
    { host: process.env.REDIS_SENTINEL_01, port: sentinelPort },
    { host: process.env.REDIS_SENTINEL_02, port: sentinelPort },
    { host: process.env.REDIS_SENTINEL_03, port: sentinelPort },
  ],
  name: process.env.REDIS_NAME,
  db: process.env.REDIS_DB ?? 0,
  keyPrefix: `${process.env.REDIS_KEY_PREFIX}:` ?? 'test:',
  sentinelUsername: process.env.REDIS_SENTINEL_USER,
  sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,
  username: process.env.REDIS_USER,
  password: process.env.REDIS_PASSWORD,
  connectionName: 'redis-om',
  enableTLSForSentinelMode: true,
  sentinelRetryStrategy: 100,
  tls: {
    ca: await fs.readFile(process.env.REDIS_CACERT),
    rejectUnauthorized: false,
    requestCert: true,
  },
  sentinelTLS: {
    ca: await fs.readFile(process.env.REDIS_CACERT),
    rejectUnauthorized: false,
    requestCert: true,
  },
  showFriendlyErrorStack: true,
}
// console.log(redisConnOpts)
const redis = new Io(redisConnOpts)
// const redisClient = await new Om().use(redis)
export {
  redis as io,
  // redisClient as om,
  // Entity,
  // Schema,
  // Repository,
}
