const { extractBearerToken, verifyAccessToken } = require("../utils/jwt.util");

// 요청 헤더의 액세스 토큰을 검증하고 인증 정보를 주입한다.
function requireAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization || "");
  if (!token) {
    return res.status(401).json({
      ok: false,
      message: "Authorization token is required.",
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.auth = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: "Invalid or expired token.",
    });
  }
}

// 인증된 사용자가 관리자 권한인지 검사한다.
function requireAdmin(req, res, next) {
  if (req.auth?.user_type !== "admin") {
    return res.status(403).json({
      ok: false,
      message: "Admin privileges are required.",
    });
  }

  return next();
}

module.exports = {
  requireAuth,
  requireAdmin,
};
