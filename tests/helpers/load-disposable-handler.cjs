const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')
const ts = require('typescript')

function disposableDatabaseUrl() {
  const url = new URL(process.env.BLOCK2_TEST_DATABASE_URL || 'http://invalid')
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !['/mds_crm_dev', '/block2_ci'].includes(url.pathname)) throw new Error('Explicit loopback disposable database required')
  return url.toString()
}
function loadHandler(filename, imports, globals = {}) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  runInNewContext(compiled, {
    module, exports: module.exports, Buffer, URL, URLSearchParams, TextEncoder, AbortSignal, Request, Response,
    crypto: require('node:crypto').webcrypto, console, process: { env: {} },
    require: id => { if (Object.hasOwn(imports, id)) return imports[id]; if (id.startsWith('@/')) throw new Error(`Unmocked infrastructure import: ${id}`); return require(id) },
    ...globals,
  }, { filename })
  return module.exports
}
module.exports = { disposableDatabaseUrl, loadHandler }
