const express = require("express");
const router = express.Router();
const { registerLender, loginLender, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

router.post("/register", registerLender);
router.post("/login", loginLender);
router.get("/me", protect, getMe);

module.exports = router;
