import { beforeEach, describe, expect, test } from "bun:test";
import fs from "fs";

import path from "path";
import { UserStore } from "../src/auth/user-store";

describe("UserStore tests", () => {
  const userFilePath = path.join(__dirname, "users.json");
  let userStore: UserStore;

  beforeEach(async () => {
    // Optionally, set up an initial users.json content in the memfs:
    const initialData = {
      users: [
        {
          username: "admin",
          hashedPassword: "someBcryptHash",
          role: "admin",
        },
      ],
      roles: {
        admin: ["read", "write", "manageUsers"],
      },
    };

    fs.mkdirSync(path.dirname(userFilePath), { recursive: true });
    fs.writeFileSync(
      userFilePath,
      JSON.stringify(initialData, null, 2),
      "utf-8",
    );

    // Now, create the UserStore pointing to the memfs path
    userStore = new UserStore(userFilePath);
  });

  test("getUser returns existing user", () => {
    const user = userStore.getUser("admin");
    expect(user).toBeDefined();
    expect(user?.username).toBe("admin");
    expect(user?.role).toBe("admin");
  });

  test("addUser successfully writes to the file", () => {
    userStore.addUser({
      username: "newUser",
      hashedPassword: "bcryptHash2",
      role: "read-only",
    });
    const user = userStore.getUser("newUser");
    expect(user).toBeDefined();
    expect(user?.role).toBe("read-only");

    // Check the underlying file was updated in memfs
    const fileData = fs.readFileSync(userFilePath, "utf-8");
    const parsed = JSON.parse(fileData);
    expect(parsed.users.length).toBe(2);
    expect(parsed.users[1].username).toBe("newUser");
  });

  test("updateUser modifies existing user", () => {
    userStore.updateUser("admin", { role: "read-write" });
    const updated = userStore.getUser("admin");
    expect(updated?.role).toBe("read-write");
  });

  test("removeUser removes user", () => {
    userStore.removeUser("admin");
    const removed = userStore.getUser("admin");
    expect(removed).toBeUndefined();
  });

  test("addRole adds a new role", () => {
    userStore.addRole("editor", ["read", "write"]);
    const fileData = fs.readFileSync(userFilePath, "utf-8");
    const parsed = JSON.parse(fileData);
    expect(parsed.roles.editor).toEqual(["read", "write"]);
  });
});
