import fs from "fs";
import { z } from "zod";

const userRecordSchema = z.object({
  username: z.string().min(1, "Username is required"),
  hashedPassword: z.string().min(1, "hashedPassword is required"),
  role: z.string().min(1, "Role is required"),
});

const rolePermissionsSchema = z.record(z.array(z.string().min(1)));

const userFileSchema = z.object({
  users: z.array(userRecordSchema),
  roles: rolePermissionsSchema,
});

// Types derived from Zod
export type RolePermissions = Record<string, string[]>;
export type UserRecord = {
  username: string;
  hashedPassword: string;
  role: string;
};
export type UserFile = {
  users: UserRecord[];
  roles: RolePermissions;
};

export class UserStore {
  private userFilePath: string;
  private userFile: UserFile;

  constructor(userFilePath: string) {
    this.userFilePath = userFilePath;

    if (!fs.existsSync(userFilePath)) {
      // If file doesn't exist, create a default empty structure
      const emptyData: UserFile = {
        users: [],
        roles: {},
      };
      fs.writeFileSync(
        userFilePath,
        JSON.stringify(emptyData, null, 2),
        "utf-8",
      );
    }

    // Load and validate the JSON file structure using Zod
    const data = JSON.parse(fs.readFileSync(userFilePath, "utf-8"));
    this.userFile = userFileSchema.parse(data);
  }

  public getUser(username: string): UserRecord | undefined {
    return this.userFile.users.find((user) => user.username === username);
  }

  public getRolePermissions(role: string): string[] {
    return this.userFile.roles[role] || [];
  }

  public addUser(user: UserRecord): void {
    // Alternatively, validate the single user object with userRecordSchema
    userRecordSchema.parse(user);
    // Add user to the array
    this.userFile.users.push(user);
    this.save();
  }

  public updateUser(username: string, updated: Partial<UserRecord>): void {
    const existingIndex = this.userFile.users.findIndex(
      (u) => u.username === username,
    );
    if (existingIndex < 0) {
      throw new Error(`User ${username} not found`);
    }

    // Merge updates
    const updatedUser = { ...this.userFile.users[existingIndex], ...updated };
    // Validate with Zod
    const validUser = userRecordSchema.parse(updatedUser);
    this.userFile.users[existingIndex] = validUser;
    this.save();
  }

  public removeUser(username: string): void {
    const newUsers = this.userFile.users.filter((u) => u.username !== username);
    if (newUsers.length === this.userFile.users.length) {
      throw new Error(`User ${username} not found`);
    }
    this.userFile.users = newUsers;
    this.save();
  }

  public addRole(role: string, permissions: string[]): void {
    if (this.userFile.roles[role]) {
      throw new Error(`Role ${role} already exists.`);
    }
    // Validate the new portion
    rolePermissionsSchema.parse({ [role]: permissions });
    this.userFile.roles[role] = permissions;
    this.save();
  }

  public updateRole(role: string, permissions: string[]): void {
    if (!this.userFile.roles[role]) {
      throw new Error(`Role ${role} not found`);
    }
    rolePermissionsSchema.parse({ [role]: permissions });
    this.userFile.roles[role] = permissions;
    this.save();
  }

  public removeRole(role: string): void {
    if (!this.userFile.roles[role]) {
      throw new Error(`Role ${role} not found`);
    }
    delete this.userFile.roles[role];
    this.save();
  }

  private save(): void {
    // Before saving, run final validation on the entire structure
    userFileSchema.parse(this.userFile);

    fs.writeFileSync(
      this.userFilePath,
      JSON.stringify(this.userFile, null, 2),
      "utf-8",
    );
  }
}
