/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @summary The low-level connection object of mongodb.
 * @file lib/mongodb-client.js
 */

import * as Dotenv from 'dotenv'
import path from 'node:path'
import { MongoClient, ObjectId } from 'mongodb'
import Debug from 'debug'

const debug = Debug('albums:db_conn_test')
async function mongodb(configPath = null, configObj = null) {
  let mongoEnv = {}
  if (configPath) {
    Dotenv.config({
      path: path.resolve(configPath),
      processEnv: mongoEnv,
      debug: true,
      encoding: 'utf8',
    })
  } else {
    mongoEnv = { ...configObj }
  }

  const clientDn = mongoEnv.MONGODB_CLIENT_DN
  // const dbHost = mongoEnv.MONGODB_HOST
  const dbHost2 = mongoEnv.MONGODB_HOST_2
  const dbHost3 = mongoEnv.MONGODB_HOST_3
  const dbHost4 = mongoEnv.MONGODB_HOST_4
  const dbPort2 = mongoEnv.MONGODB_PORT_1
  const dbPort3 = mongoEnv.MONGODB_PORT_2
  const dbPort4 = mongoEnv.MONGODB_PORT_3
  const dbName = mongoEnv.MONGODB_DB_NAME
  const appName = mongoEnv.MONGODB_APPNAME
  const authMechanism = 'MONGODB-X509'
  const authSource = '$external'
  const clientPEMFile = encodeURIComponent(mongoEnv.MONGODB_CLIENT_KEY)
  const dbCAKeyFile = encodeURIComponent(mongoEnv.MONGODB_CAKEYFILE)
  //
  //
  const uri = `mongodb://${clientDn}`
    + `@${dbHost2}:${dbPort2},${dbHost3}:${dbPort3},${dbHost4}:${dbPort4}`
    + `/${dbName}?replicaSet=myReplicaSet`
    + `&authMechanism=${authMechanism}`
    + `&tls=true&tlsCertificateKeyFile=${clientPEMFile}`
    + `&tlsCAFile=${dbCAKeyFile}`
    + `&authSource=${authSource}`
    + `&appName=${appName}`
  debug(uri)

  const client = new MongoClient(uri)
  await client.connect()
  return client.db(dbName)
}

export {
  mongodb,
  ObjectId,
}
