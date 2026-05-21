const express = require("express");
const cors = require("cors");
const { getDatabase } = require("./config/db");
const usersRouter = require("./routes/users.routes");
const authRouter = require("./routes/auth.routes");
const productsRouter = require("./routes/products.routes");
const cartsRouter = require("./routes/carts.routes");
const ordersRouter = require("./routes/orders.routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/users", usersRouter);
app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/carts", cartsRouter);
app.use("/api/orders", ordersRouter);

app.get("/health", async (req, res) => {
  try {
    const db = getDatabase();
    await db.command({ ping: 1 });

    return res.status(200).json({
      ok: true,
      message: "Server and MongoDB are connected.",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Database connection check failed.",
      error: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "Shopping mall demo server is running.",
  });
});

module.exports = app;
