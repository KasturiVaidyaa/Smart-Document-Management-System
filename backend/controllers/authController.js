import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import validator from "validator";
import { User } from "../models/User.js";
import TryCatch from "../utils/TryCatch.js";
import generateToken, { clearToken, jwtSecret } from "../utils/generateToken.js";
import { publicUser } from "../utils/publicUser.js";
import { runInTransaction } from "../utils/runInTransaction.js";
import { createPersonalWorkspace, createWithSession } from "../services/workspaceService.js";

const TEMP_USERS = {};

const mailer = () =>
  nodemailer.createTransport({
    service: "gmail",
    secure: true,
    auth: {
      user: process.env.MY_GMAIL,
      pass: process.env.MY_PASS,
    },
  });

export const registerUser = TryCatch(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  if (Array.isArray(email) || !validator.isEmail(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(400).json({ message: "An account with this email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await runInTransaction(async (session) => {
    const newUser = await createWithSession(
      User,
      {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
      },
      session
    );
    const workspace = await createPersonalWorkspace(
      { userId: newUser._id, name: newUser.name },
      session
    );
    newUser.personalWorkspaceId = workspace._id;
    await newUser.save(session ? { session } : {});
    return newUser;
  });

  generateToken(user, res);
  res.status(201).json({
    user: publicUser(user),
    message: "Account created",
  });
});

export const loginUser = TryCatch(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+passwordHash"
  );
  if (!user) {
    return res.status(400).json({ message: "Email or password incorrect." });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(400).json({ message: "Email or password incorrect." });
  }

  if (user.status === "suspended") {
    return res.status(403).json({ message: "Account is suspended" });
  }

  generateToken(user, res);
  res.json({
    user: publicUser(user),
    message: "Logged in",
  });
});

export const myProfile = TryCatch(async (req, res) => {
  res.json(publicUser(req.user));
});

export const logOutUser = TryCatch(async (req, res) => {
  clearToken(res);
  res.json({ message: "Logged out successfully" });
});

export const forgetPassword = TryCatch(async (req, res) => {
  const { email } = req.body;

  if (Array.isArray(email) || !validator.isEmail(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    return res.status(400).json({ message: "No user found" });
  }

  const otp = crypto.randomInt(100000, 999999);
  TEMP_USERS[user.email] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  if (process.env.MY_GMAIL && process.env.MY_PASS) {
    await mailer().sendMail({
      from: process.env.MY_GMAIL,
      to: user.email,
      subject: "Your OTP Code",
      text: `Your OTP is: ${otp}`,
    });
  } else {
    console.log("Password reset OTP (email not configured):", otp);
  }

  const token = jwt.sign({ email: user.email }, jwtSecret(), { expiresIn: "5m" });
  res.status(200).json({
    message: "OTP sent successfully.",
    token,
  });
});

export const resetPassword = TryCatch(async (req, res) => {
  const { token } = req.params;
  const { otp, password } = req.body;

  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }
  if (!otp || !token) {
    return res.status(400).json({ message: "OTP and token are required" });
  }

  let email;
  try {
    ({ email } = jwt.verify(token, jwtSecret()));
  } catch {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  const tempUser = TEMP_USERS[email];
  if (!tempUser) {
    return res.status(400).json({ message: "No OTP request found for this email" });
  }
  if (tempUser.expiresAt < Date.now()) {
    delete TEMP_USERS[email];
    return res.status(400).json({ message: "OTP expired" });
  }
  if (tempUser.otp.toString() !== otp.toString()) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();
  delete TEMP_USERS[email];
  res.json({ message: "Password reset successful" });
});
