import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { webcrypto } from 'node:crypto'
import ts from 'typescript'
const loadDependency = createRequire(import.meta.url)

export function disposableDatabaseUrl() {
  const url = new URL(process.env.BLOCK2_TEST_DATABASE_URL || 'http://invalid')
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !['/mds_crm_dev', '/block2_ci'].includes(url.pathname)) throw new Error('Explicit loopback disposable database required')
  return url.toString()
}
export function loadHandler(filename, imports, globals = {}) {
  const runtimeModule = { exports: {} }
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  runInNewContext(compiled, {
    module: runtimeModule, exports: runtimeModule.exports, Buffer, URL, URLSearchParams, TextEncoder, AbortSignal, Request, Response,
    crypto: webcrypto, console, process: { env: {} },
    require: id => { if (Object.hasOwn(imports, id)) return imports[id]; if (['@/lib/authorization/guards', '@/lib/authorization/operation-data'].includes(id)) return loadDependency(fileURLToPath(new URL('../../src/lib/authorization/' + id.split('/').at(-1) + '.ts', import.meta.url))); if (id.startsWith('@/')) throw new Error(`Unmocked infrastructure import: ${id}`); return loadDependency(id) },
    ...globals,
  }, { filename })
  return runtimeModule.exports
}
