const multer = require("multer");
const path = require("path");

// Use memoryStorage so uploads work on Vercel/AWS Lambda without EROFS read-only filesystem errors
const storage = multer.memoryStorage();

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
