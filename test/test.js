import { promisify } from 'node:util'
import { resolve } from 'node:path'
import { exec } from 'node:child_process'
import { Album } from '../src/index.js'
import { _log, _error } from '../src/utils/debug.js'

const exiftool = promisify(exec)

const cwd = resolve(process.cwd())
const jpg = `${cwd}/test/IMG_1820.jpg`
const jpg1 = `${cwd}/test/copper.jpg`
const heic = `${cwd}/test/IMG_1820.heic`
const name = process.env.SITE_NAME ?? 'no name'
const log = _log.extend('test')
const error = _error.extend('test')
log(`pwd: ${cwd}`)
log(`${name}`)

async function getAllExifData(img) {
  const { stdout, stderr } = await exiftool(`/usr/local/bin/exiftool -list ${img}`)
  log(stdout)
  error(stderr)
}

// getAllExifData(heic)
// getAllExifData(jpg)

/*
 * -s1    print tag names instead of description
 * -s2    no extra spaces to column-align values
 * -s3    print values only
 * -json  output in json format
 */
const opts = `-config ${resolve(cwd, './config')}/exiftool.config -json -s3 -G -c "%.6f"`
async function getExifTagValue(options, tag, img) {
  const _cmd = `/usr/local/bin/exiftool ${options} ${tag} ${img}`
  log(`_cmd: ${_cmd}`)
  const { stdout, stderr } = await exiftool(_cmd)
  log(JSON.parse(stdout))
  // error(stderr)
}

getExifTagValue(opts, '-ObjectName -MattsShortcut', jpg)
getExifTagValue(opts, '-ObjectName -MyShortcut', jpg1)
getExifTagValue(opts, '-Keywords', heic)

export {
  getExifTagValue as getTag,
  getAllExifData as getAllTags,
}
