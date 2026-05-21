const express = require("express");
const {
  createProduct,
  getProducts,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} = require("../controllers/products.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/", requireAuth, requireAdmin, createProduct);
router.get("/", getProducts);
router.get("/all", getAllProducts);
router.get("/:id", getProductById);
router.patch("/:id", requireAuth, requireAdmin, updateProduct);
router.delete("/:id", requireAuth, requireAdmin, deleteProduct);

module.exports = router;
