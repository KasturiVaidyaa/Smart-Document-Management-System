export const publicUser = (user) => {
  if (!user) return null;
  const doc = typeof user.toObject === "function" ? user.toObject() : user;
  const { passwordHash, password, ...safe } = doc;
  return safe;
};
