// Media uploads — the site's existing Cloudinary setup (unsigned preset), shared by the
// admin dashboard (blog / team photos) and the events admin (event photos and videos).
const CLOUD = 'dkvlsn98d';
const PRESET = 'crunchfitness_upload';

export interface Uploaded { url: string; publicId: string }

export const uploadToCloudinary = (file: File, onProgress?: (pct: number) => void): Promise<Uploaded> =>
  new Promise((resolve, reject) => {
    const kind = file.type.startsWith('video/') ? 'video' : 'image';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', PRESET);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (d.secure_url) resolve({ url: d.secure_url, publicId: d.public_id ?? '' });
        else reject(new Error(d.error?.message ?? 'Upload failed'));
      } catch { reject(new Error('Upload failed')); }
    };
    xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD}/${kind}/upload`);
    xhr.send(fd);
  });
