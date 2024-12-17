import { verify } from "./bcrypt";
import { UserStore } from "./userStore";

export class AuthService {
  constructor(private userStore: UserStore) {}

  public async verifyCredentials(
    username: string,
    password: string,
  ): Promise<boolean> {
    const user = this.userStore.getUser(username);
    if (!user) return false;
    return await verify(password, user.hashedPassword);
  }

  public checkPermission(username: string, permission: string): boolean {
    const user = this.userStore.getUser(username);
    if (!user) return false;
    const rolePermissions = this.userStore.getRolePermissions(user.role);
    return rolePermissions.includes(permission);
  }
}
