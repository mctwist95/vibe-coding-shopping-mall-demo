require("dotenv").config();
const { MongoClient } = require("mongodb");

async function migrateProductsToAtlas() {
  const localUri = "mongodb://127.0.0.1:27017";
  const localDbName = "shopping_mall_demo";
  const atlasUri = process.env.MONGODB_URI;
  const atlasDbName = process.env.MONGODB_DB_NAME;

  if (!atlasUri || !atlasDbName) {
    throw new Error("MONGODB_URI, MONGODB_DB_NAME 환경변수가 필요합니다.");
  }

  const localClient = new MongoClient(localUri);
  const atlasClient = new MongoClient(atlasUri);

  try {
    await localClient.connect();
    await atlasClient.connect();

    const source = localClient.db(localDbName).collection("products");
    const target = atlasClient.db(atlasDbName).collection("products");

    const products = await source.find({}).toArray();
    if (products.length === 0) {
      console.log("로컬 products 데이터가 없습니다.");
      return;
    }

    let upserted = 0;
    let modified = 0;

    for (const product of products) {
      const { _id, ...doc } = product;
      const key = doc.sku ? { sku: doc.sku } : { name: doc.name, price: doc.price };
      const result = await target.updateOne(key, { $set: doc }, { upsert: true });
      upserted += result.upsertedCount || 0;
      modified += result.modifiedCount || 0;
    }

    const atlasTotal = await target.countDocuments();
    console.log(
      `복사 완료: source=${products.length}, upserted=${upserted}, modified=${modified}, atlas_total=${atlasTotal}`
    );
  } finally {
    await localClient.close();
    await atlasClient.close();
  }
}

migrateProductsToAtlas().catch((error) => {
  console.error(error.message || "마이그레이션 중 오류가 발생했습니다.");
  process.exit(1);
});
