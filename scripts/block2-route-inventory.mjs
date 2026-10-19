#!/usr/bin/env node
/**
 * Block 02 read-only route inventory. Run from repository root:
 * node scripts/block2-route-inventory.mjs
 * No DB, provider, network, migrations, or source writes.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = 'src/app'
function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}
const files = walk(root)
const methods = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']
const rows = files.filter(path => /\/api\/.*\/route\.(?:ts|tsx|js)$/.test(path.replaceAll('\\','/')))
  .sort().flatMap(path => {
    const source = readFileSync(path,'utf8')
    const exported = methods.filter(method => new RegExp('export\\s+(?:async\\s+)?function\\s+'+method+'\\b|export\\s+const\\s+'+method+'\\b').test(source))
    return (exported.length ? exported : ['UNDETERMINED']).map(method => {
      const signals = {
        legacyPermission: /checkPermission\s*\(|checkModulePermission\s*\(/.test(source),
        commercialObservation: /observeChannelEntitlement\s*\(|observe(?:Module|Commercial)\w*\s*\(/.test(source),
        session: /getServerSession\s*\(|auth\s*\(|session!?(?:\.|\[)/.test(source),
        signatureOrWebhookSecret: /timingSafeEqual|createHmac|WEBHOOK_SECRET|x-hub-signature/i.test(source),
        tenantScope: /organizationId|organization_id/.test(source),
      }
      const publicOrCallback = /\/webhook|\/callback|\/auth\//.test(path.replaceAll('\\','/'))
      const needsManualReview = !signals.legacyPermission && !signals.signatureOrWebhookSecret
      return { path:relative('.',path).replaceAll('\\','/'), method, ...signals, publicOrCallback, needsManualReview }
    })
  })
const summary = {routeFiles:new Set(rows.map(row=>row.path)).size, methodRows:rows.length, reviewCandidates:rows.filter(row=>row.needsManualReview).length, note:'Source heuristics only. No runtime, role, tenant, or IDOR proof. A flag is not authorization evidence.'}
process.stdout.write(JSON.stringify({summary,rows},null,2)+'\n')
if (process.argv.includes('--fail-on-unreviewed') && summary.reviewCandidates) process.exitCode=1
