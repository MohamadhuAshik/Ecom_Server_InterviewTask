const mongoose = require("mongoose");
const cartModel = require("../Model/cartModel");
const productModel = require("../Model/productModel");

/**
 * Helper to calculate cart totals
 */
function calculateCartTotals(cart) {
  let totalAmount = 0;
  let totalItems = 0;

  if (cart && Array.isArray(cart.items)) {
    cart.items.forEach((item) => {
      const p = item.product;
      const unitPrice = (p && typeof p.price === "number") ? p.price : (item.price || 0);
      totalAmount += unitPrice * (item.quantity || 1);
      totalItems += item.quantity || 1;
    });
  }

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    totalItems,
  };
}

/**
 * GET user cart
 */
const getCart = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    let cart = await cartModel.findOne({ user: userId }).populate("items.product");

    if (!cart) {
      return res.status(200).json({
        success: true,
        cart: { items: [] },
        totalAmount: 0,
        totalItems: 0,
      });
    }

    // Filter out items whose product might have been deleted from DB
    const validItems = cart.items.filter((item) => item.product !== null);
    if (validItems.length !== cart.items.length) {
      cart.items = validItems;
      await cart.save();
    }

    const { totalAmount, totalItems } = calculateCartTotals(cart);

    return res.status(200).json({
      success: true,
      cart,
      totalAmount,
      totalItems,
    });
  } catch (error) {
    console.error("Get Cart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching cart",
      error: error.message,
    });
  }
};

/**
 * ADD item to cart
 */
const addToCart = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const { productId, quantity = 1, color = null } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    // Find product in DB
    let product = null;
    if (mongoose.Types.ObjectId.isValid(productId)) {
      product = await productModel.findById(productId);
    }
    if (!product && !isNaN(Number(productId))) {
      product = await productModel.findOne({ id: Number(productId) });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const qtyToAdd = Math.max(1, parseInt(quantity, 10) || 1);

    // Find or create user cart
    let cart = await cartModel.findOne({ user: userId });
    if (!cart) {
      cart = new cartModel({
        user: userId,
        items: [],
      });
    }

    // Check if the same product (and color if provided) already exists in cart
    const existingIndex = cart.items.findIndex((item) => {
      const matchProduct = item.product.toString() === product._id.toString();
      if (!matchProduct) return false;
      if (color && color.name) {
        return item.color?.name === color.name;
      }
      return true;
    });

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += qtyToAdd;
    } else {
      cart.items.push({
        product: product._id,
        quantity: qtyToAdd,
        price: product.price,
        color: color && color.name ? { name: color.name, hex: color.hex || "" } : undefined,
      });
    }

    await cart.save();
    cart = await cartModel.findById(cart._id).populate("items.product");

    const { totalAmount, totalItems } = calculateCartTotals(cart);

    return res.status(200).json({
      success: true,
      message: `"${product.name}" added to cart`,
      cart,
      totalAmount,
      totalItems,
    });
  } catch (error) {
    console.error("Add to Cart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while adding to cart",
      error: error.message,
    });
  }
};

/**
 * UPDATE cart item quantity
 */
const updateCartItemQuantity = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: "Product ID and quantity are required",
      });
    }

    const newQty = parseInt(quantity, 10);

    let cart = await cartModel.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    if (newQty <= 0) {
      // Remove item if quantity is zero or negative
      cart.items = cart.items.filter(
        (item) => item.product.toString() !== productId && item._id.toString() !== productId
      );
    } else {
      const item = cart.items.find(
        (it) => it.product.toString() === productId || it._id.toString() === productId
      );
      if (item) {
        item.quantity = newQty;
      } else {
        return res.status(404).json({ success: false, message: "Item not found in cart" });
      }
    }

    await cart.save();
    cart = await cartModel.findById(cart._id).populate("items.product");

    const { totalAmount, totalItems } = calculateCartTotals(cart);

    return res.status(200).json({
      success: true,
      message: "Cart updated",
      cart,
      totalAmount,
      totalItems,
    });
  } catch (error) {
    console.error("Update Cart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating cart",
      error: error.message,
    });
  }
};

/**
 * REMOVE item from cart
 */
const removeFromCart = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const { productId } = req.params;

    let cart = await cartModel.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId && item._id.toString() !== productId
    );

    await cart.save();
    cart = await cartModel.findById(cart._id).populate("items.product");

    const { totalAmount, totalItems } = calculateCartTotals(cart);

    return res.status(200).json({
      success: true,
      message: "Item removed from cart",
      cart,
      totalAmount,
      totalItems,
    });
  } catch (error) {
    console.error("Remove from Cart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while removing item from cart",
      error: error.message,
    });
  }
};

/**
 * CLEAR entire cart
 */
const clearCart = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    let cart = await cartModel.findOne({ user: userId });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return res.status(200).json({
      success: true,
      message: "Cart cleared",
      cart: { items: [] },
      totalAmount: 0,
      totalItems: 0,
    });
  } catch (error) {
    console.error("Clear Cart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while clearing cart",
      error: error.message,
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
};

