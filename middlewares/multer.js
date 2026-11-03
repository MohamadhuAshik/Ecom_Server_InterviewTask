const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");

// In serverless (Vercel/AWS Lambda), root is read-only, so use writable /tmp/uploads
// In local development, use local ../uploads directory
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

const uploadDir = isServerless
  ? path.join(os.tmpdir(), "uploads")
  : path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.warn("Could not create uploadDir:", err.message);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname || "").toLowerCase();
    const ext = rawExt || ".jpg";
    const baseName = path
      .basename(file.originalname || "image", rawExt)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 40);
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    cb(null, `${baseName || "product"}_${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExts = /\.(jpeg|jpg|png|webp|gif|svg|avif|jfif|bmp)$/i;
  const isExtValid = allowedExts.test(path.extname(file.originalname || ""));
  const isMimeValid =
    !file.mimetype ||
    file.mimetype.startsWith("image/") ||
    file.mimetype === "application/octet-stream";

  if (isExtValid || isMimeValid) {
    cb(null, true);
  } else {
    cb(
      new Error(`File "${file.originalname}" is not an accepted image format`),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB per file
    files: 30,                  // up to 30 files per request
  },
});

module.exports = upload;
