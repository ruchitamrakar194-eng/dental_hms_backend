'use strict';
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
const XRAY_DIR = path.join(UPLOAD_ROOT, 'xrays');

if (!fs.existsSync(XRAY_DIR)) {
  fs.mkdirSync(XRAY_DIR, { recursive: true });
}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'image/dicom',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, XRAY_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error('Invalid file type. Allowed: JPEG, PNG, WEBP, GIF, PDF'), { statusCode: 400 }), false);
  }
};

const xrayUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

module.exports = { xrayUpload, UPLOAD_ROOT };
