const PRODUCTS_COLLECTION = "products";
const PRODUCT_CATEGORIES = ["상의", "하의", "악세사리"];

const productSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["sku", "name", "price", "category", "image", "createdAt", "updatedAt"],
    properties: {
      sku: {
        bsonType: "string",
        description: "sku is required and must be a string",
      },
      name: {
        bsonType: "string",
        description: "name is required and must be a string",
      },
      price: {
        bsonType: ["int", "long", "double", "decimal"],
        description: "price is required and must be a number",
      },
      category: {
        enum: PRODUCT_CATEGORIES,
        description: "category is required and must be one of allowed categories",
      },
      image: {
        bsonType: "string",
        description: "image is required and must be a string",
      },
      description: {
        bsonType: ["string", "null"],
        description: "description is optional and must be a string or null",
      },
      createdAt: {
        bsonType: "date",
        description: "createdAt is required and must be a date",
      },
      updatedAt: {
        bsonType: "date",
        description: "updatedAt is required and must be a date",
      },
    },
  },
};

// products 컬렉션 스키마와 인덱스를 최신 규칙으로 맞춘다.
async function ensureProductSchema(db) {
  const hasProductsCollection = await db
    .listCollections({ name: PRODUCTS_COLLECTION }, { nameOnly: true })
    .hasNext();

  if (!hasProductsCollection) {
    await db.createCollection(PRODUCTS_COLLECTION, {
      validator: productSchemaValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
  } else {
    await db.command({
      collMod: PRODUCTS_COLLECTION,
      validator: productSchemaValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
  }

  await db.collection(PRODUCTS_COLLECTION).createIndex({ sku: 1 }, { unique: true });
}

// 상품 입력값을 DB 저장용 문서 형태로 정규화한다.
function buildProductDocument(payload) {
  const now = new Date();

  return {
    sku: payload.sku.trim(),
    name: payload.name.trim(),
    price: payload.price,
    category: payload.category,
    image: payload.image.trim(),
    description: payload.description ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = {
  PRODUCTS_COLLECTION,
  PRODUCT_CATEGORIES,
  ensureProductSchema,
  buildProductDocument,
};
