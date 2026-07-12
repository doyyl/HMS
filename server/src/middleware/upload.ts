import multer from 'multer';

// Buffer the upload in memory; the storage service decides where it lands
// (Supabase Storage in prod, local disk in dev).
export const uploadSlip = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ'));
  },
}).single('slip');
