const express = require("express");
const multer = require("multer");
const {
  addProduct,
  getProducts,
  getProductById,
  deleteProduct,
  updateProduct,
} = require("../Controller/productController");
const upload = require("../middlewares/multer");

const productRouter = express.Router();

// Safe upload wrapper that handles Multer errors gracefully and returns JSON
const handleUpload = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      console.error("Multer Upload Error:", err);
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "One or more image files exceed the 25 MB limit.",
          });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({
            success: false,
            message: "Too many files uploaded at once (limit is 50).",
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to upload image files",
      });
    }
    next();
  });
};

productRouter.post("/add", handleUpload, addProduct);

productRouter.get("/get", getProducts);
productRouter.get("/:id", getProductById);

productRouter.put("/update/:id", handleUpload, updateProduct);
productRouter.put("/:id", handleUpload, updateProduct);

productRouter.delete("/delete/:id", deleteProduct);
productRouter.delete("/:id", deleteProduct);

module.exports = productRouter;
