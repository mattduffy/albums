/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file lib/mongodb-client.js The low-level connection object of mongodb.
 */

import * as Dotenv from 'dotenv'
import { MongoClient, ObjectId } from 'mongodb'
import Debug from 'debug'

const debug = Debug('albums:db_conn_test')
Dotenv.config({ path: './config/mongodb.env', debug: true })

const dbName = process.env.DB_NAME
// const colName = process.env.COLLECTION
const clientDn = process.env.MONGODB_CLIENT_DN
const dbHost = process.env.MONGODB_HOST
const dbPort1 = process.env.MONGODB_PORT_1
const dbPort2 = process.env.MONGODB_PORT_2
const dbPort3 = process.env.MONGODB_PORT_3
const authMechanism = 'MONGODB-X509'
const authSource = '$external'
const clientPEMFile = encodeURIComponent(process.env.MONGODB_CLIENT_KEY)
const dbCAKeyFile = encodeURIComponent(process.env.MONGODB_CAKEYFILE)
const uri = `mongodb://${clientDn}@${dbHost}:${dbPort1},${dbHost}:${dbPort2},${dbHost}:${dbPort3}/${dbName}?replicaSet=myReplicaSet&authMechanism=${authMechanism}&tls=true&tlsCertificateKeyFile=${clientPEMFile}&tlsCAFile=${dbCAKeyFile}&authSource=${authSource}`
debug(uri)

const client = new MongoClient(uri)
await client.connect()
const albums = client.db(process.env.MONGODB_DBNAME).collection(process.env.MONGODB_COLLECTION)
export {
  client,
  ObjectId,
  albums,
}
