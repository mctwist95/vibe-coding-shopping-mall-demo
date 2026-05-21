const bcrypt = require("bcryptjs");
const { getDatabase } = require("../config/db");
const { JWT_EXPIRES_IN, TOKEN_TYPE } = require("../constants/auth.constants");
const { USERS_COLLECTION } = require("../models/user.model");
const { signAccessToken } = require("../utils/jwt.util");

// 문자열 입력값이 비어있지 않은지 검사한다.
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// 사용자 응답에서 민감 정보(password)를 제거한다.
function sanitizeUserForResponse(user) {
  if (!user) {
    return user;
  }

  const { password, ...safeUser } = user;
  return safeUser;
}

// 사용자 정보를 기반으로 액세스 토큰을 생성한다.
function createAccessToken(user) {
  return signAccessToken(user);
}

// LOGIN: 이메일 + 비밀번호 인증 후 토큰 발급
async function login(req, res) {
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
        const hashedPassword = await bcrypt.hash(password, 12);
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

module.exports = {
  login,
};
