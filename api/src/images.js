// Photos come off a phone or camera at 4–8 MB, which is far more than a web
// gallery needs. Resize with sharp when it is available; if the optional native
// dependency did not install, store the original bytes rather than fail.
let sharp = null;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.warn('sharp is unavailable — photos will be stored as uploaded.');
}

const MAX_EDGE = Number(process.env.PHOTO_MAX_EDGE || 2400);
const QUALITY = Number(process.env.PHOTO_QUALITY || 82);

export async function shrinkImage(buffer, contentType) {
  if (!sharp) {
    return { bytes: buffer, contentType, width: null, height: null };
  }
  try {
    const pipeline = sharp(buffer, { failOn: 'none' }).rotate();
    const meta = await pipeline.metadata();
    const resized = pipeline.resize({
      width: Math.min(meta.width || MAX_EDGE, MAX_EDGE),
      height: Math.min(meta.height || MAX_EDGE, MAX_EDGE),
      fit: 'inside',
      withoutEnlargement: true,
    });
    const bytes = await resized.webp({ quality: QUALITY }).toBuffer();
    const out = await sharp(bytes).metadata();
    return {
      bytes,
      contentType: 'image/webp',
      width: out.width ?? null,
      height: out.height ?? null,
    };
  } catch (err) {
    console.error('Image processing failed, storing original:', err.message);
    return { bytes: buffer, contentType, width: null, height: null };
  }
}
