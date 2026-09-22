import express from "express";
import {
  forgetPassword,
  loginUser,
  logOutUser,
  myProfile,
  registerUser,
  resetPassword,
} from "../controllers/authController.js";
import { isAuth } from "../middlewares/isAuth.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", isAuth, logOutUser);
router.get("/me", isAuth, myProfile);
router.post("/forgot", forgetPassword);
router.post("/reset-password/:token", resetPassword);

export default router;
