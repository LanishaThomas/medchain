const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Cloudinary
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const hasCloudinaryCredentials = !!(cloudName && apiKey && apiSecret);

if (hasCloudinaryCredentials) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  console.log('✅ Cloudinary configured:', { cloud_name: cloudName });
} else {
  console.warn('⚠️ Cloudinary credentials missing — files stored locally only');
}

// ──── Local uploads directory ────
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'medical-records');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ──── File filter ────
const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}`), false);
  }
};

// ──── Always use local disk storage for multer (reliable) ────
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(UPLOADS_DIR, req.user?.id?.toString() || 'unknown');
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    cb(null, `${ts}-${rand}${ext}`);
  }
});

const upload = multer({
  storage: diskStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ──── Upload to Cloudinary from local file (optional, after multer saves) ────
const uploadToCloudinary = async (localPath, userId) => {
  if (!hasCloudinaryCredentials) return null;
  try {
    const result = await cloudinary.uploader.upload(localPath, {
      folder: `medchain/records/${userId}`,
      resource_type: 'auto'
    });
    console.log('☁️ Uploaded to Cloudinary:', result.public_id);
    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type
    };
  } catch (err) {
    console.warn('⚠️ Cloudinary upload failed, keeping local file:', err.message);
    return null;
  }
};

// ──── Delete from Cloudinary ────
const deleteFile = async (publicId, resourceType = 'auto') => {
  if (!hasCloudinaryCredentials) return { result: 'skipped' };
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
    return { result: 'error' };
  }
};

// ──── Delete local file ────
const deleteLocalFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
};

module.exports = {
  cloudinary,
  upload,               // multer middleware (always local disk)
  uploadToCloudinary,   // optional cloud upload after save
  deleteFile,
  deleteLocalFile,
  UPLOADS_DIR,
  hasCloudinaryCredentials
};
