const jwt = require("jsonwebtoken");
const { JWT_EXPIRES_IN, JWT_SECRET, TOKEN_TYPE } = require("../constants/auth.constants");

// Authorization 헤더에서 Bearer 토큰만 추출한다.
function extractBearerToken(authHeader = "") {
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== TOKEN_TYPE || !token) {
    return null;
  }
  return token;
}

// 사용자 식별 정보를 담은 JWT 액세스 토큰을 발급한다.
function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
      user_type: user.user_type,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// JWT 액세스 토큰의 서명과 만료를 검증한다.
function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  extractBearerToken,
  signAccessToken,
  verifyAccessToken,
};
