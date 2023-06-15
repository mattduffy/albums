/**
 * @summary A small wrapper around the Debug package to setup the namespace.
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/utils/debug.js A small wrapper around the Debug package to setup the namespace.
 */

import Debug from 'debug'

Debug.log = console.log.bind(console)
const _log = Debug('albums-log')
const _error = Debug('albums-error')

export {
  _log,
  _error,
}
