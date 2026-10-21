#!/usr/bin/env node
// Read-only, operation-level AST inventory. Signals are not runtime proof.
import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
function walk(path) { return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path + '/' + entry.name) : [path + '/' + entry.name]); }
const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);
function signals(node, source) {
  const guards = [], calls = [];
  function visit(child) {
    if (ts.isCallExpression(child)) {
      const name = child.expression.getText(source);
      if (/checkPermission|checkModulePermission|checkAuth|checkModulePage|verifyAdminToken|getServerSession|observeChannelEntitlement|verify.*(Signature|Token)|read.*Session/.test(name)) guards.push({ call: name, arguments: child.arguments.map(argument => argument.getText(source)), line: source.getLineAndCharacterOfPosition(child.getStart(source)).line + 1 });
      if (/prisma\./.test(name)) calls.push({ call: name, line: source.getLineAndCharacterOfPosition(child.getStart(source)).line + 1, tenantSignal: /organizationId|organization_id/.test(child.getText(source)) });
    }
    ts.forEachChild(child, visit);
  }
  visit(node); return { guards, databaseCalls: calls };
}
function group(path) {
  if (/\/api\/admin\//.test(path)) return 'administration';
  if (/\/webhooks?\/|\/callback\/|\/callback\/route/.test(path)) return 'provider-callback-manual-review';
  if (/\/api\/import\/route/.test(path)) return 'vendas';
  if (/\/api\/leads(?:\/|$)|\/api\/kanban\//.test(path)) return 'vendas';
  if (/\/api\/projects(?:\/|$)/.test(path)) return 'marketing';
  if (/\/api\/atendimento\/|\/api\/integrations\/(chatwoot|whatsapp|evolution|instagram)/.test(path)) return 'atendimento-or-provider';
  return 'shared-or-other';
}
const api = [], pages = [];
for (const path of walk('src/app').sort()) {
  if (!/\/(route|page|layout)\.tsx?$/.test(path)) continue;
  const text = readFileSync(path, 'utf8'), source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (path.includes('/api/') && path.endsWith('/route.ts')) {
    const url = path.replace('src/app', '').replace('/route.ts', '');
    for (const node of source.statements) {
      if (!node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
      const entries = ts.isFunctionDeclaration(node) && node.name ? [{ name: node.name.text, node }] : ts.isVariableStatement(node) ? node.declarationList.declarations.filter(declaration => ts.isIdentifier(declaration.name)).map(declaration => ({ name: declaration.name.text, node: declaration })) : [];
      for (const entry of entries) if (methods.has(entry.name)) {
        const data = signals(entry.node, source);
        const commercial = data.guards.some(guard => /checkModulePermission|observeChannelEntitlement/.test(guard.call));
        api.push({ url, method: entry.name, path, group: group(path), ...data, commercialKind: data.guards.some(guard => /checkModulePermission/.test(guard.call)) ? 'module-guard' : commercial ? 'channel-observer' : 'none-or-delegated', commercial: commercial ? 'observed-not-blocking' : 'not-integrated-or-delegated', classification: 'source-signals-require-runtime-evidence' });
      }
    }
  } else if (path.includes('/(app)/') && path.endsWith('/page.tsx')) {
    const layouts = []; let dir = path.slice(0, path.lastIndexOf('/'));
    while (dir.startsWith('src/app/(app)')) { const layout = dir + '/layout.tsx'; try { const contents = readFileSync(layout, 'utf8'); layouts.push({ path: layout, commercialObservation: /checkModulePage/.test(contents), activeIdentity: /checkAuth|getApplicationContext/.test(contents) }); } catch { /* No layout at this segment. */ } dir = dir.slice(0, dir.lastIndexOf('/')); }
    pages.push({ url: path.replace('src/app/(app)', '').replace('/page.tsx', ''), path, clientComponent: Boolean(source.statements[0] && ts.isExpressionStatement(source.statements[0]) && ts.isStringLiteral(source.statements[0].expression) && source.statements[0].expression.text === 'use client'), layouts, ...signals(source, source) });
  }
}
console.log(JSON.stringify({ referenceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceTree: execFileSync('git', ['rev-parse', 'HEAD:src'], { encoding: 'utf8' }).trim(), note: 'AST calls only, not data-flow, auth completeness or tenant isolation certification. Helper-delegated guards require manual review. Callbacks require provider authentication, not a fabricated tenant session.', summary: { apiFiles: new Set(api.map(row => row.path)).size, operations: api.length, pages: pages.length, observedOperations: api.filter(row => row.commercial === 'observed-not-blocking').length }, api, pages }, null, 2));
