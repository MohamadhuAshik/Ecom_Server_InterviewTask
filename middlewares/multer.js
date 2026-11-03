const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadPath = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname || "").toLowerCase();
    const ext = rawExt || ".jpg";
    const baseName = path
      .basename(file.originalname || "image", rawExt)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 50);
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
    fileSize: 25 * 1024 * 1024, // 25 MB per file
    files: 50,                  // up to 50 files per request
  },
});

module.exports = upload;
