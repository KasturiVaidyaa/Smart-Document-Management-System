import express from "express";
import {
  approveUser,
  forgetPassword,
  getPendingUsers,
  loginUser,
  logOutUser,
  myProfile,
  registerWithOtp,
  rejectUser,
  resetPassword,
  userProfile,
  verifyOtpAndRegister,
} from "../controllers/userController.js";
import { isAdmin, isAuth } from "../middlewares/isAuth.js";

const router = express.Router();

router.post("/register", registerWithOtp);
router.post("/verifyOtp/:token", verifyOtpAndRegister);
router.post("/login", loginUser);
router.post("/forget", forgetPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/logout", isAuth, logOutUser);
router.get("/me", isAuth, myProfile);

// Admin-only routes for handling pending role2/role3 users
router.get("/pending", isAuth, isAdmin, getPendingUsers);
router.patch("/:id/approve", isAuth, isAdmin, approveUser);
router.delete("/:id/reject", isAuth, isAdmin, rejectUser);

router.get("/:id", isAuth, userProfile);

export default router;