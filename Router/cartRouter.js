const express = require("express");
const authentication = require("../middlewares/auth");
const {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
} = require("../Controller/cartController");

const cartRouter = express.Router();

// Protect all cart routes with authentication middleware
cartRouter.use(authentication);

cartRouter.get("/", getCart);
cartRouter.post("/add", addToCart);
cartRouter.put("/update", updateCartItemQuantity);
cartRouter.delete("/remove/:productId", removeFromCart);
cartRouter.delete("/clear", clearCart);

module.exports = cartRouter;

