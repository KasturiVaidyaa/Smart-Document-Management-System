import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { jwtSecret } from "../utils/generateToken.js";

export const isAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const bearer =
      header && header.startsWith("Bearer ") ? header.slice(7) : null;
    const token = req.cookies?.token || bearer;

    if (!token) {
      return res.status(401).json({ message: "Please login" });
    }

    const decoded = jwt.verify(token, jwtSecret());
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Please login" });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ message: "Account is suspended" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Please login" });
  }
};
