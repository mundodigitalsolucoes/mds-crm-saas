import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

/** Executes the real handler/helper source with isolated infrastructure imports.
 * No production authentication, Prisma client, database or provider is loaded.
 */
export function loadServerModule<T>(sourceUrl: URL, imports: Record<string, unknown>): T {
  const filename = fileURLToPath(sourceUrl);
  const source = readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  });
  const runtimeModule = { exports: {} };
  const require = createRequire(sourceUrl);
  runInNewContext(compiled.outputText, {
    module: runtimeModule, exports: runtimeModule.exports, console, URL, URLSearchParams,
    require: (id: string) => Object.prototype.hasOwnProperty.call(imports, id) ? imports[id] : require(id),
  }, { filename });
  return runtimeModule.exports as T;
}
