const USERS_COLLECTION = "users";
const USER_TYPES = ["customer", "admin"];

// MongoDB 컬렉션 레벨 검증 스키마
const userSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["email", "name", "password", "user_type", "createdAt", "updatedAt"],
    properties: {
      email: {
        bsonType: "string",
        description: "email is required and must be a string",
      },
      name: {
        bsonType: "string",
        description: "name is required and must be a string",
      },
      password: {
        bsonType: "string",
        description: "password is required and must be a string",
      },
      user_type: {
        enum: USER_TYPES,
        description: "user_type is required and must be either customer or admin",
      },
      address: {
        bsonType: ["string", "null"],
        description: "address is optional and must be a string or null",
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

// users 컬렉션 스키마와 유니크 인덱스를 보장한다.
async function ensureUserSchema(db) {
  // 컬렉션이 없으면 생성, 있으면 스키마를 최신 규칙으로 갱신
  const hasUsersCollection = await db
    .listCollections({ name: USERS_COLLECTION }, { nameOnly: true })
    .hasNext();

  if (!hasUsersCollection) {
    await db.createCollection(USERS_COLLECTION, {
      validator: userSchemaValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
  } else {
    await db.command({
      collMod: USERS_COLLECTION,
      validator: userSchemaValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
  }

  // 이메일 중복 가입 방지를 위한 유니크 인덱스
  await db.collection(USERS_COLLECTION).createIndex({ email: 1 }, { unique: true });
}

// 사용자 입력값을 DB 저장용 문서로 정규화한다.
function buildUserDocument(payload) {
  const now = new Date();

  // 저장 직전 데이터 정규화 + timestamps 자동 주입
  return {
    email: payload.email.trim().toLowerCase(),
    name: payload.name.trim(),
    password: payload.password,
    user_type: payload.user_type || "customer",
    address: payload.address ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = {
  USERS_COLLECTION,
  USER_TYPES,
  ensureUserSchema,
  buildUserDocument,
};
