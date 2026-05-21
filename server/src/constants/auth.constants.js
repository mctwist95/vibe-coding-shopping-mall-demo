const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
const TOKEN_TYPE = "Bearer";

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  TOKEN_TYPE,
};
