const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// En Vercel el disco es de solo lectura: la foto se guarda como data URI en la base de datos (más liviana)
const SERVERLESS = Boolean(process.env.VERCEL);
const MAX_BYTES = (SERVERLESS ? 1 : 3) * 1024 * 1024;

const storage = SERVERLESS ? multer.memoryStorage() : multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`),
});

// Valor que se guarda en la columna image/logo para el archivo subido
const publicUrl = (file) => (SERVERLESS
  ? `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
  : `/uploads/${file.filename}`);

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    const err = new Error('Solo se permiten imágenes JPG, PNG o WEBP');
    err.code = 'INVALID_FILE_TYPE';
    return cb(err);
  },
});

// Envuelve multer para mostrar errores amables en el formulario en vez de un 500
function single(field) {
  return (req, res, next) => upload.single(field)(req, res, (err) => {
    if (err) {
      req.uploadError = err.code === 'LIMIT_FILE_SIZE' ? `La foto no puede pesar más de ${MAX_BYTES / 1024 / 1024} MB` : err.message;
    }
    next();
  });
}

function removeFile(publicPath) {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return;
  fs.unlink(path.join(UPLOAD_DIR, path.basename(publicPath)), () => {});
}

module.exports = { single, removeFile, publicUrl, UPLOAD_DIR };
