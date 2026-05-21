const CARTS_COLLECTION = "carts";

// carts 컬렉션에 사용자별 유니크 인덱스를 보장한다.
async function ensureCartSchema(db) {
  await db.collection(CARTS_COLLECTION).createIndex({ userId: 1 }, { unique: true });
}

module.exports = {
  CARTS_COLLECTION,
  ensureCartSchema,
};
