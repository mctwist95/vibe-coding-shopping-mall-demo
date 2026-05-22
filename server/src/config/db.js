const { MongoClient } = require("mongodb");

let client;
let database;

// Atlas SRV URI에서 DB 경로를 제거하고 authSource=admin을 보장한다.
function prepareMongoUri(uri) {
  if (!uri.startsWith("mongodb+srv://")) {
    return uri;
  }

  let normalized = uri.replace(/(mongodb\+srv:\/\/[^/?]+)\/[^?]*/, "$1");

  if (!normalized.includes("authSource=")) {
    normalized += normalized.includes("?") ? "&authSource=admin" : "?authSource=admin";
  }

  return normalized;
}

// MongoDB 연결을 초기화하고 DB 인스턴스를 반환한다.
async function connectToDatabase() {
  if (database) {
    return database;
  }

  const connectionString = prepareMongoUri(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017"
  );
  const dbName = process.env.MONGODB_DB_NAME;

  if (!dbName) {
    throw new Error("MONGODB_DB_NAME is required in environment variables.");
  }

  if (!client) {
    client = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: 10000,
    });
  }

  await client.connect();
  database = client.db(dbName);
  return database;
}

// 초기화된 DB 인스턴스를 반환하고 미연결 상태를 방지한다.
function getDatabase() {
  if (!database) {
    throw new Error("Database not initialized. Call connectToDatabase() first.");
  }

  return database;
}

module.exports = {
  connectToDatabase,
  getDatabase,
};
