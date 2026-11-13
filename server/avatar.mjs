import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { privateDirectory } from './config.mjs';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 16_000_000;
export const MAX_IMAGE_DIMENSION = 8192;
const referencePattern = /^\/api\/profile\/avatar\?v=([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;
export const privateImageReference = value => typeof value === 'string' && referencePattern.test(value) ? value : null;
const failure = (status, code) => Object.assign(new Error(code), { status, code });

export async function readAvatar(req) {
  if (!/^multipart\/form-data\s*;/i.test(req.headers['content-type'] || '')) throw failure(415, 'INVALID_IMAGE');
  if (Number(req.headers['content-length']) > MAX_IMAGE_BYTES + 64 * 1024) { req.resume(); throw failure(413, 'IMAGE_TOO_LARGE'); }
  const raw = await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    req.on('data', chunk => {
      if (done) return;
      size += chunk.length;
      if (size > MAX_IMAGE_BYTES + 64 * 1024) { done = true; chunks.length = 0; reject(failure(413, 'IMAGE_TOO_LARGE')); }
      else chunks.push(chunk);
    });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks)); } });
    req.on('error', () => { if (!done) { done = true; reject(failure(400, 'INVALID_IMAGE')); } });
    req.on('aborted', () => { if (!done) { done = true; reject(failure(400, 'INVALID_IMAGE')); } });
  });
  let form;
  try { form = await new Response(raw, { headers: { 'Content-Type': req.headers['content-type'] } }).formData(); }
  catch { throw failure(400, 'INVALID_IMAGE'); }
  const photos = form.getAll('photo');
  const photo = photos[0];
  if (photos.length !== 1 || !(photo instanceof File) || [...form.values()].filter(value => value instanceof File).length !== 1 || !photo.size) throw failure(400, 'INVALID_IMAGE');
  if (photo.size > MAX_IMAGE_BYTES) throw failure(413, 'IMAGE_TOO_LARGE');
  const bytes = Buffer.from(await photo.arrayBuffer());
  const format = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'jpeg'
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null;
  const extensions = { jpeg: ['.jpg', '.jpeg'], png: ['.png'], webp: ['.webp'] };
  if (!format || photo.type !== `image/${format}` || !extensions[format].includes(extname(photo.name).toLowerCase())) throw failure(400, 'INVALID_IMAGE');
  try {
    // Header-only inspection; validate before decoding pixel data. Restrict the
    // decoder again, even after metadata validation, and reject animation.
    const metadata = await sharp(bytes, { limitInputPixels: false, failOn: 'warning' }).metadata();
    if (!metadata.width || !metadata.height || metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION || metadata.width * metadata.height > MAX_IMAGE_PIXELS) throw failure(400, 'IMAGE_DIMENSIONS');
    if (metadata.format !== format || (metadata.pages || 1) !== 1) throw failure(400, 'INVALID_IMAGE');
    return await sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' }).rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 85 }).toBuffer();
  } catch (error) { throw error.status ? error : failure(400, 'INVALID_IMAGE'); }
}

// Replaceable local storage boundary. Only reencoded derivatives are stored;
// original uploads never reach disk or the static webroot.
export function createAvatarStore(directory) {
  privateDirectory(directory);
  const pending = new Map();
  const userDirectory = userId => join(directory, createHash('sha256').update(userId).digest('hex'));
  const pathFor = (userId, reference) => {
    const version = privateImageReference(reference)?.match(referencePattern)[1];
    return version ? join(userDirectory(userId), `${version}.webp`) : null;
  };
  return {
    async serialize(userId, operation) {
      const previous = pending.get(userId) || Promise.resolve();
      const current = previous.catch(() => {}).then(operation);
      pending.set(userId, current);
      try { return await current; }
      finally { if (pending.get(userId) === current) pending.delete(userId); }
    },
    async write(userId, bytes) {
      privateDirectory(userDirectory(userId));
      const reference = `/api/profile/avatar?v=${randomUUID()}`;
      await writeFile(pathFor(userId, reference), bytes, { mode: 0o600, flag: 'wx' });
      return reference;
    },
    async read(userId, reference) {
      const path = pathFor(userId, reference);
      if (!path) return null;
      try { return await readFile(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async remove(userId, reference) {
      const path = pathFor(userId, reference);
      if (path) await rm(path, { force: true });
    },
  };
}
