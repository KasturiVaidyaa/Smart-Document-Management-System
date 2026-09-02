import { User } from "../models/userModel.js";
import generateToken from "../utils/generateToken.js";
import TryCatch from "../utils/TryCatch.js";
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import dotenv from "dotenv";
import validator from 'validator';


dotenv.config();



const TEMP_USERS = {}; 

export const registerWithOtp = TryCatch(async (req, res) => {
  const { name, email, password, role } = req.body;

   
   if (Array.isArray(email) || !validator.isEmail(email)) {
    return res.status(400).json({
      message: "Invalid email format",
    });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      message: "An account with this email already exists",
    });
  }

  const otp = crypto.randomInt(100000, 999999); // Generate OTP
  console.log(otp);
  TEMP_USERS[email] = {
    name,
    password,
    // Store role temporarily for use after OTP verification
    role:
      role && ["role1", "role2", "role3", "role4"].includes(role)
        ? role
        : "role1",
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000, // OTP valid for 5 minutes
  };

  const transporter = nodemailer.createTransport({
    service: "gmail",
    secure: true,
    auth: {
      user: process.env.MY_GMAIL,
      pass: process.env.MY_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.MY_GMAIL,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is: ${otp}`,
    });

    const token = jwt.sign({ email }, process.env.JWT_SEC, { expiresIn: "5m" });

    res.status(200).json({
      message: "OTP sent successfully. Please verify to complete registration.",
      token,
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).send("Failed to send OTP");
  }
});

export const verifyOtpAndRegister = TryCatch(async (req, res) => {
  const { otp } = req.body;
  const { token}=req.params;

  if (!otp || !token) {
    return res.status(400).json({ message: "OTP and token are required" });
  }

  try {
    const { email } = jwt.verify(token, process.env.JWT_SEC);

    const tempUser = TEMP_USERS[email];
    if (!tempUser) {
      return res.status(400).json({ message: "No OTP request found for this email" });
    }

    if (tempUser.expiresAt < Date.now()) {
      delete TEMP_USERS[email];
      return res.status(400).json({ message: "OTP expired" });
    }

    if (parseInt(tempUser.otp) !== parseInt(otp)) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Determine verification status based on role:
    // - role4 is admin -> verified
    // - role1 is regular -> verified
    // - role2 and role3 require admin verification
    const isVerified =
      tempUser.role === "role1" || tempUser.role === "role4";

    const hashPassword = await bcrypt.hash(tempUser.password, 10);
    const user = await User.create({
      name: tempUser.name,
      email,
      password: hashPassword,
      role: tempUser.role,
      isVerified,
    });

    delete TEMP_USERS[email]; //

    // Auto-login only for role1 and role4 (admin). Roles 2/3 remain pending.
    if (isVerified) {
      generateToken(user, res);
    }

    res.status(201).json({
      user,
      message:
        isVerified
          ? "User registered successfully. You are now logged in."
          : "User registered successfully. You cannot login until an admin verifies your account.",
    });
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(400).json({ message: "Invalid or expired token" });
  }
});




export const loginUser=TryCatch(async(req,res)=>{
    const{email,password }=req.body;
    const user=await User.findOne({email});
    if(!user){
        return res.status(400).json({
            message:"Email or Password Incorrect.",
        });
    }
    const comaparePassword=await bcrypt.compare(password,user.password);


    if(!comaparePassword){
      return res.status(400).json({
          message:"Email or Password Incorrect.",
      });

    }

    // Enforce admin verification for role2 and role3
    if ((user.role === "role2" || user.role === "role3") && !user.isVerified) {
      return res.status(403).json({
        message: "Your account is pending admin verification. You cannot login until an admin approves your account.",
      });
    }

    generateToken(user,res);


    res.json({
        user,
        message:"Logged In",

    })

});
 
export const forgetPassword=TryCatch(async(req,res)=>{
  const {email} =req.body;

   
if (Array.isArray(email) || !validator.isEmail(email)) {
  return res.status(400).json({
    message: "Invalid email format",
  });
}
  const user= await User.findOne({email})
  if(!user)
      return res.status(400).json({
          message:"No user found",
  })

  const otp = crypto.randomInt(100000, 999999);
  TEMP_USERS[email] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000, 
  };
  
  const transporter = nodemailer.createTransport({
      service:"gmail",
      secure:true,
      auth:{
          user:process.env.MY_GMAIL,
          pass:process.env.MY_PASS,
      }
  })
  console.log(otp);
  
  try {
    
    await transporter.sendMail({
      from: process.env.MY_GMAIL,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is: ${otp}`,
    });

   
    const token = jwt.sign({ email }, process.env.JWT_SEC, { expiresIn: "5m" });

    res.status(200).json({
      message: "OTP sent successfully.",
      token,
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({
      message: "Failed to send OTP",
      error: error.message,
    });
  }
})

export const resetPassword = TryCatch(async (req, res) => {
const { token } = req.params;
const { otp, password } = req.body;

if (!password) {
  return res.status(400).json({ message: "Password is required" });
}

if (!otp || !token) {
  return res.status(400).json({ message: "OTP and token are required" });
}

let email;
try {
  ({ email } = jwt.verify(token, process.env.JWT_SEC));
} catch (error) {
  return res.status(400).json({ message: "Invalid or expired token" });
}

const tempUser = TEMP_USERS[email];
if (!tempUser) {
  console.log("TEMP_USERS:", TEMP_USERS);
  return res.status(400).json({ message: "No OTP request found for this email" });
}

console.log("Stored OTP:", tempUser.otp);
console.log("Provided OTP:", otp);

if (tempUser.expiresAt < Date.now()) {
  console.log("OTP expired. ExpiresAt:", tempUser.expiresAt, "Current time:", Date.now());
  delete TEMP_USERS[email];
  return res.status(400).json({ message: "OTP expired" });
}

if (tempUser.otp.toString() !== otp.toString()) {
  console.log("Invalid OTP. Stored:", tempUser.otp, "Provided:", otp);
  return res.status(400).json({ message: "Invalid OTP" });
}

const user = await User.findOne({ email });
if (!user) {
  return res.status(404).json({ message: "User not found" });
}

user.password = await bcrypt.hash(password, 10);
await user.save();

delete TEMP_USERS[email];
res.json({ message: "Password reset successful" });
});


export const myProfile=TryCatch(async(req,res)=>{
    const user=await User.findById(req.user._id)
    res.json(user);
})

export const userProfile= TryCatch(async(req,res)=>{
    const user= await User.findById(req.params.id).select("-password");
    res.json(user);

})


export const logOutUser=TryCatch(async(req,res)=>{
    res.cookie("token","",{maxAge:0});
    res.json({
        message:"Logged out successfully",
    });
});

// ADMIN: Get all unverified role2 and role3 users
export const getPendingUsers = TryCatch(async (req, res) => {
  const pendingUsers = await User.find({
    role: { $in: ["role2", "role3"] },
    isVerified: false,
  }).select("-password");

  res.json(pendingUsers);
});

// ADMIN: Approve a pending user (set isVerified = true)
export const approveUser = TryCatch(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (!["role2", "role3"].includes(user.role)) {
    return res
      .status(400)
      .json({ message: "Only role2 and role3 users require admin verification" });
  }

  if (user.isVerified) {
    return res.status(400).json({ message: "User is already verified" });
  }

  user.isVerified = true;
  await user.save();

  res.json({
    message: "User approved successfully",
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    },
  });
});

// ADMIN: Reject a pending user (remove them)
export const rejectUser = TryCatch(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (!["role2", "role3"].includes(user.role)) {
    return res
      .status(400)
      .json({ message: "Only role2 and role3 users can be rejected from this view" });
  }

  if (user.isVerified) {
    return res
      .status(400)
      .json({ message: "Cannot reject an already verified user" });
  }

  await user.deleteOne();

  res.json({
    message: "User rejected and removed successfully",
  });
});
