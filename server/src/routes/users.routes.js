const express = require("express");
const {
  loginUser,
  createUser,
  getUsers,
  getMyProfile,
  getUserById,
  updateUser,
  deleteUser,
} = require("../controllers/users.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

// LOGIN: 이메일 + 비밀번호 로그인
router.post("/login", loginUser);

// CREATE: 유저 생성
router.post("/", createUser);

// READ: 유저 목록 조회
router.get("/", getUsers);

// READ: 토큰 기반 내 정보 조회
router.get("/me", requireAuth, getMyProfile);

// READ: 유저 단건 조회
router.get("/:id", getUserById);

// UPDATE: 유저 부분 수정(변경된 필드만 반영)
router.patch("/:id", updateUser);

// DELETE: 유저 삭제
router.delete("/:id", deleteUser);

module.exports = router;
