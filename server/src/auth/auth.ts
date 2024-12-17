import { UserStore } from "./userStore";

export class AuthService {
  constructor(private userStore: UserStore) {}

  public async verifyCredentials(
    username: string,
    password: string,
  ): Promise<boolean> {
    const user = this.userStore.getUser(username);
    if (!user) return false;
    return await Bun.password.verify(password, user.hashedPassword, "bcrypt");
  }

  public checkPermission(username: string, permission: string): boolean {
    const user = this.userStore.getUser(username);
    if (!user) return false;
    const rolePermissions = this.userStore.getRolePermissions(user.role);
    return rolePermissions.includes(permission);
  }
}
