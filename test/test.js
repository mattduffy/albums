const util = require('node:util')
const exiftool = util.promisify(require('node:child_process').exec)

//console.log(`pwd: ${process.cwd()}`)
const cwd = process.cwd()
const jpg = `${cwd}/test/IMG_1820.jpg`
const jpg1 = `${cwd}/test/copper.jpg`
const heic = `${cwd}/test/IMG_1820.heic`

async function getAllExifData(img) {
  const { stdout, stderr } = await exiftool(`/usr/local/bin/exiftool -list ${img}`)
  console.log(stdout)
  console.error(stderr)
}

/*
 * -s1    print tag names instead of description
 * -s2    no extra spaces to column-align values
 * -s3    print values only
 * -json  output in json format
 */
const opts = `-config ${cwd}/exiftool.config -json -s3 -G -c "%.6f"`
async function getExifTagValue(options, tag, img) {
  const { stdout, stderr } = await exiftool(`/usr/local/bin/exiftool ${options} ${tag} ${img}`)
  console.log(stdout)
  console.error(stderr)
}

//getAllExifData(heic)
//getAllExifData(jpg)

getExifTagValue(opts, '-ObjectName -MattsShortcut', jpg1)
//getExifTagValue(opts, '-ObjectName -Keywords', jpg1)
//getExifTagValue(opts, '-Keywords', jpg1)

exports.getTag = getExifTagValue
exports.getAllTags = getAllExifData
