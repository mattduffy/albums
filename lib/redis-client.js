/**
 * @module @mattduffy/koa-stub
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @summary The low-level connection object of redis - using the official node-redis package.
 * @file lib/redis-client.js
 */

import * as Dotenv from 'dotenv'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createSentinel } from 'redis'
import { fileURLToPath } from 'node:url'
import Debug from 'debug'

const debug = Debug('albums:redis_conn_test')
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(`${__dirname}/../../../..`)
debug('redis-client.js >>root = ', root)
async function redisConn(configPath = null, configObj = null) {
  let redisEnv = {}
  if (configPath) {
    Dotenv.config({
      path: path.resolve(configPath),
      processEnv: redisEnv,
      debug: true,
      encoding: 'utf-8',
    })
  } else {
    redisEnv = { ...configObj }
  }

  const sentinelPort = redisEnv.REDIS_SENTINEL_PORT ?? 26379
  const redisConnOpts = {
    sentinelRootNodes: [
      { host: redisEnv.REDIS_SENTINEL_01, port: sentinelPort },
      { host: redisEnv.REDIS_SENTINEL_02, port: sentinelPort },
      { host: redisEnv.REDIS_SENTINEL_03, port: sentinelPort },
    ],
    name: 'myprimary',
    database: redisEnv.REDIS_DB,
    sentinelClientOptions: {
      username: redisEnv.REDIS_SENTINEL_USER,
      password: redisEnv.REDIS_SENTINEL_PASSWORD,
      socket: {
        tls: true,
        rejectUnauthorized: false,
        ca: await fs.readFile(redisEnv.REDIS_CACERT),
      },
    },
    nodeClientOptions: {
      username: redisEnv.REDIS_USER,
      password: redisEnv.REDIS_PASSWORD,
      socket: {
        tls: true,
        rejectUnauthorized: false,
        ca: await fs.readFile(redisEnv.REDIS_CACERT),
      },
    },
    sentinelRetryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    role: 'master',
  }
  // console.log(redisConnOpts)
  let sentinel // eslint-disable import/no-mutable-exports
  try {
    sentinel = await createSentinel(redisConnOpts)
      .on('reconnecting', () => {
        console.log('Redis sentinel reconnecting')
      })
      .on('error', (err) => console.error('Redis Sentinel Error', err))
      .on('ready', () => {
        console.log('Redis sentinel connection is ready')
      })

    await sentinel.connect()
    // const redis = sentinel.master
  } catch (e) {
    debug(e)
    throw e
  }
  return sentinel
}
export { redisConn }
