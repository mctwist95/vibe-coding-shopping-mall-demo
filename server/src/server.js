const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const app = require("./app");
const { connectToDatabase } = require("./config/db");
const { ensureUserSchema } = require("./models/user.model");
const { ensureProductSchema } = require("./models/product.model");
const { ensureCartSchema } = require("./models/cart.model");
const { ensureOrderSchema } = require("./models/order.model");

const port = Number(process.env.PORT) || 4000;
const REQUIRED_ENV = ["MONGODB_URI", "MONGODB_DB_NAME"];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !String(process.env[key] || "").trim());

  if (missing.length > 0) {
    console.error("Missing required environment variables:", missing.join(", "));
    process.exit(1);
  }
}

// 데이터베이스 초기화 후 HTTP 서버를 시작한다.
async function startServer() {
  validateEnv();

  try {
    console.log("Connecting to MongoDB...");
    const db = await connectToDatabase();
    await ensureUserSchema(db);
    await ensureProductSchema(db);
    await ensureCartSchema(db);
    await ensureOrderSchema(db);

    app.listen(port, "0.0.0.0", () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message || error);
    process.exit(1);
  }
}

startServer();
