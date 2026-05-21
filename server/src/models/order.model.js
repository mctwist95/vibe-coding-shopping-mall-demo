const ORDERS_COLLECTION = "orders";
const ORDER_STATUS = ["결제완료", "배송중", "배송완료", "주문취소"];

const orderSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["orderId", "userId", "status", "totalQuantity", "totalPrice", "items", "orderedAt", "createdAt", "updatedAt"],
    properties: {
      orderId: {
        bsonType: "string",
        description: "orderId is required and must be a string",
      },
      userId: {
        bsonType: "objectId",
        description: "userId is required and must be an ObjectId",
      },
      customerName: {
        bsonType: ["string", "null"],
        description: "customerName must be a string or null",
      },
      customerEmail: {
        bsonType: ["string", "null"],
        description: "customerEmail must be a string or null",
      },
      status: {
        enum: ORDER_STATUS,
        description: "status must be one of allowed order statuses",
      },
      totalQuantity: {
        bsonType: ["int", "long", "double", "decimal"],
        minimum: 0,
        description: "totalQuantity is required and must be a non-negative number",
      },
      totalPrice: {
        bsonType: ["int", "long", "double", "decimal"],
        minimum: 0,
        description: "totalPrice is required and must be a non-negative number",
      },
      items: {
        bsonType: "array",
        description: "items is required and must be an array",
      },
      orderedAt: {
        bsonType: "date",
        description: "orderedAt is required and must be a date",
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

// orders 컬렉션 스키마와 인덱스를 최신 규칙으로 보장한다.
async function ensureOrderSchema(db) {
  const hasOrdersCollection = await db.listCollections({ name: ORDERS_COLLECTION }, { nameOnly: true }).hasNext();

  if (!hasOrdersCollection) {
    await db.createCollection(ORDERS_COLLECTION, {
      validator: orderSchemaValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
  } else {
    await db.command({
      collMod: ORDERS_COLLECTION,
      validator: orderSchemaValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
  }

  await db.collection(ORDERS_COLLECTION).createIndex({ orderId: 1 }, { unique: true });
  await db.collection(ORDERS_COLLECTION).createIndex({ userId: 1, orderedAt: -1 });
}

module.exports = {
  ORDERS_COLLECTION,
  ORDER_STATUS,
  ensureOrderSchema,
};
