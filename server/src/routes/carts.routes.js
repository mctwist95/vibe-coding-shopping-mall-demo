const express = require("express");
const {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require("../controllers/carts.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", requireAuth, getCart);
router.post("/", requireAuth, addCartItem);
router.patch("/items/:itemId", requireAuth, updateCartItem);
router.delete("/items/:itemId", requireAuth, removeCartItem);
router.delete("/", requireAuth, clearCart);

module.exports = router;
