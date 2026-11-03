const express = require("express");
const {
  addProduct,
  getProducts,
  getProductById,
  deleteProduct,
  updateProduct,
} = require("../Controller/productController");
const upload = require("../middlewares/multer");

const productRouter = express.Router();


productRouter.post(
  "/add",
  upload.fields([
    { name: "image", maxCount: 20 }
  ]),
  addProduct
);

productRouter.get("/get", getProducts);
productRouter.get("/:id", getProductById);

productRouter.put(
  "/update/:id",
  upload.fields([
    { name: "image", maxCount: 20 }
  ]),
  updateProduct
);
productRouter.put(
  "/:id",
  upload.fields([
    { name: "image", maxCount: 20 }
  ]),
  updateProduct
);

productRouter.delete("/delete/:id", deleteProduct);
productRouter.delete("/:id", deleteProduct);

module.exports = productRouter;
