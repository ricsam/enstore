export const verify = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => {
  if (typeof Bun === "undefined") {
    const bcrypt = await import("bcrypt");
    return await bcrypt.compare(password, hashedPassword);
  }
  return await Bun.password.verify(password, hashedPassword, "bcrypt");
};

export const hash = async (password: string): Promise<string> => {
  const saltRounds = 10;
  if (typeof Bun === "undefined") {
    const bcrypt = await import("bcrypt");
    return await bcrypt.hash(password, saltRounds);
  }
  return await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: saltRounds,
  });
};
