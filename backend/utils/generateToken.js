import jwt from "jsonwebtoken";

const jwtSecret = () => process.env.JWT_SECRET || process.env.JWT_SEC;

const cookieOptions = () => ({
  maxAge: 15 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

const generateToken = (user, res) => {
  const token = jwt.sign({ id: user._id }, jwtSecret(), {
    expiresIn: "15d",
  });

  res.cookie("token", token, cookieOptions());
  return token;
};

export const clearToken = (res) => {
  res.cookie("token", "", { ...cookieOptions(), maxAge: 0 });
};

export { jwtSecret, cookieOptions };
export default generateToken;
