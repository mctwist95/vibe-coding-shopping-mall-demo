require("dotenv").config();
const app = require("./app");
const { connectToDatabase } = require("./config/db");
const { ensureUserSchema } = require("./models/user.model");
const { ensureProductSchema } = require("./models/product.model");
const { ensureCartSchema } = require("./models/cart.model");
const { ensureOrderSchema } = require("./models/order.model");

const port = process.env.PORT || 4000;

// 데이터베이스 초기화 후 HTTP 서버를 시작한다.
async function startServer() {
  try {
    const db = await connectToDatabase();
    await ensureUserSchema(db);
    await ensureProductSchema(db);
    await ensureCartSchema(db);
    await ensureOrderSchema(db);

    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
