import { constants } from 'node:fs';
import { mkdir, lstat, realpath, open, unlink } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export type AttachmentFile = { id: string; organizationId: string; filename: string; url: string };
export class AttachmentStorageError extends Error {
  constructor(readonly status: number) { super('Arquivo indisponível'); }
}
export const attachmentDownloadUrl = (id: string) => `/api/attachments/${encodeURIComponent(id)}`;
const inside = (root: string, path: string) => { const rel = relative(root, path); return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel)); };
function safeSegment(value: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new AttachmentStorageError(404);
  return value;
}
function safeFilename(value: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/.test(value) || value.includes('..')) throw new AttachmentStorageError(404);
  return value;
}
async function rootPath() {
  const configured = process.env.CRM_ATTACHMENTS_PRIVATE_ROOT;
  if (!configured && process.env.NODE_ENV === 'production') throw new AttachmentStorageError(503);
  if (configured && !isAbsolute(configured)) throw new AttachmentStorageError(503);
  const root = resolve(configured || join(process.cwd(), '.cache', 'private-attachments'));
  if (inside(resolve('public'), root) || inside(resolve('.next'), root)) throw new AttachmentStorageError(503);
  return root;
}
async function directory(root: string, organizationId: string, create: boolean, privateRoot = true) {
  const dir = join(root, safeSegment(organizationId));
  if (create) await mkdir(root, { recursive: true, mode: 0o700 });
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || (privateRoot && (rootStat.mode & 0o022))) throw new AttachmentStorageError(503);
  const actualRoot = await realpath(root);
  if (privateRoot && (inside(await realpath('public'), actualRoot) || inside(await realpath('.next').catch(() => resolve('.next')), actualRoot))) throw new AttachmentStorageError(503);
  if (create) await mkdir(dir, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  const dirStat = await lstat(dir);
  if (!dirStat.isDirectory() || dirStat.isSymbolicLink() || (privateRoot && (dirStat.mode & 0o022))) throw new AttachmentStorageError(404);
  const actual = await realpath(dir);
  if (!inside(actualRoot, actual)) throw new AttachmentStorageError(404);
  return actual;
}
export function isPrivateAttachment(file: AttachmentFile) { return file.url === attachmentDownloadUrl(file.id); }
export async function writePrivateAttachment(file: AttachmentFile, bytes: Buffer) {
  if (!isPrivateAttachment(file) || file.filename !== `${file.id}.bin` || bytes.length > MAX_ATTACHMENT_BYTES) throw new AttachmentStorageError(400);
  try {
    const dir = await directory(await rootPath(), file.organizationId, true);
    const fd = await open(join(dir, safeFilename(file.filename)), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await fd.writeFile(bytes); await fd.sync(); } catch { await unlink(join(dir, file.filename)).catch(() => undefined); throw new AttachmentStorageError(503); } finally { await fd.close(); }
  } catch (error) { if (error instanceof AttachmentStorageError) throw error; throw new AttachmentStorageError(503); }
}
export async function readAttachment(file: AttachmentFile) {
  try {
    const privateFile = isPrivateAttachment(file);
    if (privateFile && file.filename !== `${file.id}.bin`) throw new AttachmentStorageError(404);
    let dir: string;
    if (privateFile) dir = await directory(await rootPath(), file.organizationId, false);
    else {
      const name = safeFilename(file.filename);
      if (file.url !== `/uploads/${safeSegment(file.organizationId)}/${name}`) throw new AttachmentStorageError(404);
      // Compatibility is read-only: never move/remove a legacy public file here.
      const base = resolve('public', 'uploads');
      dir = await directory(base, file.organizationId, false, false);
    }
    const fd = await open(join(dir, safeFilename(file.filename)), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await fd.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > MAX_ATTACHMENT_BYTES) throw new AttachmentStorageError(404);
      return await fd.readFile();
    } finally { await fd.close(); }
  } catch (error) { if (error instanceof AttachmentStorageError) throw error; throw new AttachmentStorageError(404); }
}
export async function removePrivateAttachment(file: AttachmentFile) {
  if (!isPrivateAttachment(file)) return;
  if (file.filename !== `${file.id}.bin`) throw new AttachmentStorageError(404);
  try { const dir = await directory(await rootPath(), file.organizationId, false); await unlink(join(dir, safeFilename(file.filename))); }
  catch (error) { if (error instanceof AttachmentStorageError) throw error; if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new AttachmentStorageError(503); }
}
export function attachmentContentType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString('ascii'))) return 'image/gif';
  if (bytes.subarray(0,4).toString('ascii') === 'RIFF' && bytes.subarray(8,12).toString('ascii') === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
}
export function attachmentHeaders(bytes: Buffer, originalName: string) {
  const type = attachmentContentType(bytes), name = originalName.replace(/[^A-Za-z0-9 ._()-]/g, '_').slice(0,150) || 'download';
  return { 'Content-Type': type, 'Content-Disposition': `${type.startsWith('image/') ? 'inline' : 'attachment'}; filename="${name}"`,
    'Cache-Control': 'private, no-store, max-age=0', 'Pragma': 'no-cache', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox", 'Cross-Origin-Resource-Policy': 'same-origin', 'Vary': 'Cookie', 'Accept-Ranges': 'none' };
}
