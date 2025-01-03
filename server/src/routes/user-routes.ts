import { Router, Request, Response } from "express";
import { authorizePermission } from "../middleware/auth-middleware";
import { UserStore } from "../auth/user-store";
import { AuthService } from "../auth/auth";
import bcrypt from "bcrypt";
import { hash } from "../auth/bcrypt";

export function userRoutes(authService: AuthService, userStore: UserStore): Router {
  const router = Router();

  // Add user (permission: manageUsers)
  router.post(
    "/",
    authorizePermission(authService, "manageUsers"),
    async (req: Request, res: Response) => {
      const { username, password, role } = req.body;
      if (!username || !password || !role) {
        return res
          .status(400)
          .json({ error: "Missing username, password, or role" });
      }

      const hashedPassword = await hash(password);

      try {
        userStore.addUser({ username, hashedPassword, role });
        return res.json({ message: "User added successfully" });
      } catch (error) {
        return res.status(500).json({ error: (error as Error).message });
      }
    },
  );

  // Update user
  router.patch(
    "/:username",
    authorizePermission(authService, "manageUsers"),
    async (req: Request, res: Response) => {
      const { username } = req.params;
      const { password, role } = req.body;

      try {
        const updatePayload: any = {};
        if (password) {
          updatePayload.hashedPassword = await hash(password);
        }
        if (role) {
          updatePayload.role = role;
        }
        userStore.updateUser(username, updatePayload);
        return res.json({ message: "User updated successfully" });
      } catch (error) {
        return res.status(500).json({ error: (error as Error).message });
      }
    },
  );

  // Delete user
  router.delete(
    "/:username",
    authorizePermission(authService, "manageUsers"),
    (req: Request, res: Response) => {
      const { username } = req.params;
      try {
        userStore.removeUser(username);
        return res.json({ message: "User deleted successfully" });
      } catch (error) {
        return res.status(500).json({ error: (error as Error).message });
      }
    },
  );

  // Add or update a role
  router.post(
    "/roles",
    authorizePermission(authService, "manageUsers"),
    (req: Request, res: Response) => {
      const { role, permissions } = req.body;
      if (!role || !permissions) {
        return res
          .status(400)
          .json({ error: "Missing role or permissions array" });
      }
      try {
        userStore.addRole(role, permissions);
        return res.json({ message: "Role added successfully" });
      } catch (error) {
        return res.status(500).json({ error: (error as Error).message });
      }
    },
  );

  router.patch(
    "/roles/:role",
    authorizePermission(authService, "manageUsers"),
    (req: Request, res: Response) => {
      const { role } = req.params;
      const { permissions } = req.body;
      if (!permissions) {
        return res.status(400).json({ error: "Missing permissions array" });
      }
      try {
        userStore.updateRole(role, permissions);
        return res.json({ message: "Role updated successfully" });
      } catch (error) {
        return res.status(500).json({ error: (error as Error).message });
      }
    },
  );

  router.delete(
    "/roles/:role",
    authorizePermission(authService, "manageUsers"),
    (req: Request, res: Response) => {
      const { role } = req.params;
      try {
        userStore.removeRole(role);
        return res.json({ message: "Role removed successfully" });
      } catch (error) {
        return res.status(500).json({ error: (error as Error).message });
      }
    },
  );

  return router;
}
