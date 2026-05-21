const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const { getDatabase } = require("../config/db");
const { JWT_EXPIRES_IN, TOKEN_TYPE } = require("../constants/auth.constants");
const { USERS_COLLECTION, USER_TYPES, buildUserDocument } = require("../models/user.model");
const { signAccessToken } = require("../utils/jwt.util");
const SALT_ROUNDS = 12;

// 응답에서 민감 정보(password) 제거
function sanitizeUserForResponse(user) {
  if (!user) {
    return user;
  }

  const { password, ...safeUser } = user;
  return safeUser;
}

// 문자열 입력값이 비어있지 않은지 검증한다.
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// 허용된 사용자 유형인지 검사한다.
function isValidUserType(value) {
  return USER_TYPES.includes(value);
}

// 사용자 정보를 기반으로 액세스 토큰을 생성한다.
function createAccessToken(user) {
  return signAccessToken(user);
}

// LOGIN: 이메일 + 비밀번호 인증 후 토큰 발급
async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({
        ok: false,
        message: "email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const db = getDatabase();
    const users = db.collection(USERS_COLLECTION);
    const user = await users.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Invalid email or password.",
      });
    }

    let isPasswordMatched = false;
    const looksHashed = typeof user.password === "string" && user.password.startsWith("$2");

    if (looksHashed) {
      isPasswordMatched = await bcrypt.compare(password, user.password);
    } else {
      // Legacy plain text support: login once, then migrate to hash.
      isPasswordMatched = user.password === password;
      if (isPasswordMatched) {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        await users.updateOne(
          { _id: user._id },
          { $set: { password: hashedPassword, updatedAt: new Date() } }
        );
        user.password = hashedPassword;
      }
    }

    if (!isPasswordMatched) {
      return res.status(401).json({
        ok: false,
        message: "Invalid email or password.",
      });
    }

    const accessToken = createAccessToken(user);

    return res.status(200).json({
      ok: true,
      message: "Login successful.",
      data: {
        user: sanitizeUserForResponse(user),
        access_token: accessToken,
        token_type: TOKEN_TYPE,
        expires_in: JWT_EXPIRES_IN,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to login.",
      error: error.message,
    });
  }
}

// CREATE: 유저 생성
async function createUser(req, res) {
  try {
    const { email, name, password, user_type, address } = req.body;

    // 기본 입력값 검증
    if (!isNonEmptyString(email) || !isNonEmptyString(name) || !isNonEmptyString(password)) {
      return res.status(400).json({
        ok: false,
        message: "email, name, and password are required.",
      });
    }

    if (user_type !== undefined && !isValidUserType(user_type)) {
      return res.status(400).json({
        ok: false,
        message: `user_type must be one of: ${USER_TYPES.join(", ")}`,
      });
    }

    if (address !== undefined && address !== null && typeof address !== "string") {
      return res.status(400).json({
        ok: false,
        message: "address must be a string or null.",
      });
    }

    // 비밀번호는 평문 저장하지 않고 해시로 저장
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 모델 헬퍼에서 createdAt/updatedAt 자동 생성
    const db = getDatabase();
    const userDocument = buildUserDocument({
      ...req.body,
      password: hashedPassword,
    });
    const result = await db.collection(USERS_COLLECTION).insertOne(userDocument);

    return res.status(201).json({
      ok: true,
      data: {
        _id: result.insertedId,
        ...sanitizeUserForResponse(userDocument),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        ok: false,
        message: "A user with this email already exists.",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Failed to create user.",
      error: error.message,
    });
  }
}

// READ: 유저 목록 조회
async function getUsers(req, res) {
  try {
    const db = getDatabase();
    const users = await db
      .collection(USERS_COLLECTION)
      .find({})
      .project({ password: 0 })
      .sort({ createdAt: -1 })
      .toArray();

    return res.json({
      ok: true,
      data: users,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch users.",
      error: error.message,
    });
  }
}

// READ: 토큰 기반 내 정보 조회
async function getMyProfile(req, res) {
  try {
    const userId = req.auth?.sub;
    if (!ObjectId.isValid(userId)) {
      return res.status(401).json({
        ok: false,
        message: "Invalid token payload.",
      });
    }

    const db = getDatabase();
    const user = await db
      .collection(USERS_COLLECTION)
      .findOne({ _id: new ObjectId(userId) }, { projection: { password: 0 } });

    if (!user) {
      return res.status(404).json({
        ok: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      ok: true,
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch profile.",
      error: error.message,
    });
  }
}

// READ: 유저 단건 조회
async function getUserById(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid user id format.",
      });
    }

    const db = getDatabase();
    const user = await db
      .collection(USERS_COLLECTION)
      .findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });

    if (!user) {
      return res.status(404).json({
        ok: false,
        message: "User not found.",
      });
    }

    return res.json({
      ok: true,
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch user.",
      error: error.message,
    });
  }
}

// UPDATE: 유저 부분 수정(변경된 필드만 반영)
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid user id format.",
      });
    }

    const updates = {};

    if (req.body.email !== undefined) {
      if (!isNonEmptyString(req.body.email)) {
        return res.status(400).json({
          ok: false,
          message: "email must be a non-empty string.",
        });
      }
      updates.email = req.body.email.trim().toLowerCase();
    }

    if (req.body.name !== undefined) {
      if (!isNonEmptyString(req.body.name)) {
        return res.status(400).json({
          ok: false,
          message: "name must be a non-empty string.",
        });
      }
      updates.name = req.body.name.trim();
    }

    if (req.body.password !== undefined) {
      if (!isNonEmptyString(req.body.password)) {
        return res.status(400).json({
          ok: false,
          message: "password must be a non-empty string.",
        });
      }
      updates.password = await bcrypt.hash(req.body.password, SALT_ROUNDS);
    }

    if (req.body.user_type !== undefined) {
      if (!isValidUserType(req.body.user_type)) {
        return res.status(400).json({
          ok: false,
          message: `user_type must be one of: ${USER_TYPES.join(", ")}`,
        });
      }
      updates.user_type = req.body.user_type;
    }

    if (req.body.address !== undefined) {
      if (req.body.address !== null && typeof req.body.address !== "string") {
        return res.status(400).json({
          ok: false,
          message: "address must be a string or null.",
        });
      }
      updates.address = req.body.address;
    }

    // 유효한 변경사항이 하나도 없으면 요청 거절
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        ok: false,
        message: "No valid fields provided for update.",
      });
    }

    // 수정 시점 갱신
    updates.updatedAt = new Date();

    const db = getDatabase();
    const users = db.collection(USERS_COLLECTION);

    const updateResult = await users.updateOne({ _id: new ObjectId(id) }, { $set: updates });

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "User not found.",
      });
    }

    const updatedUser = await users.findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });

    return res.json({
      ok: true,
      data: updatedUser,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        ok: false,
        message: "A user with this email already exists.",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Failed to update user.",
      error: error.message,
    });
  }
}

// DELETE: 유저 삭제
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid user id format.",
      });
    }

    const db = getDatabase();
    const result = await db.collection(USERS_COLLECTION).deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "User not found.",
      });
    }

    return res.json({
      ok: true,
      message: "User deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to delete user.",
      error: error.message,
    });
  }
}

module.exports = {
  loginUser,
  createUser,
  getUsers,
  getMyProfile,
  getUserById,
  updateUser,
  deleteUser,
};
