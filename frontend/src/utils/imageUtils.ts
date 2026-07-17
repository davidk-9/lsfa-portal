// Client-side image compression before upload (port of the plugin's compressImageForUpload).
// Downscales to a max dimension and re-encodes at a moderate quality so evidence images
// stay sharp enough to read text but aren't heavy. Falls back to the original file if the
// result isn't smaller or anything goes wrong.
export async function compressImage(file: File, maxDimension = 1600, quality = 0.72): Promise<File> {
  if (!file || !file.type?.startsWith('image/')) return file;

  try {
    const img = await loadImage(file);
    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;
    if (!width || !height) return file;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const targetMime = file.type.toLowerCase() === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, targetMime, quality));

    // Keep the original if compression didn't actually help.
    if (!blob || blob.size <= 0 || blob.size >= file.size) return file;

    const ext = targetMime === 'image/webp' ? '.webp' : '.jpg';
    const base = (file.name || 'upload').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}${ext}`, { type: targetMime, lastModified: Date.now() });
  } catch {
    return file;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image decode failed'));
    };
    img.src = url;
  });
}
