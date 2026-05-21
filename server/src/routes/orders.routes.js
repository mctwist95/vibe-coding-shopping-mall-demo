const express = require("express");
const {
  createOrder,
  getPaymentReadyStatus,
  getOrders,
  getAdminOrders,
  getOrderById,
  updateOrder,
  updateAdminOrderStatus,
  deleteOrder,
} = require("../controllers/orders.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/payment/ready", requireAuth, getPaymentReadyStatus);
router.post("/", requireAuth, createOrder);
router.get("/", requireAuth, getOrders);
router.get("/admin", requireAuth, requireAdmin, getAdminOrders);
router.patch("/admin/:orderId/status", requireAuth, requireAdmin, updateAdminOrderStatus);
router.get("/:orderId", requireAuth, getOrderById);
router.patch("/:orderId", requireAuth, updateOrder);
router.delete("/:orderId", requireAuth, deleteOrder);

module.exports = router;
