import { NextFunction, Request, Response } from "express";
import { AuthService } from "../auth/auth";

declare global {
  namespace Express {
    interface Request {
      user?: string;
    }
  }
}

export function authMiddleware(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // For simplicity, assume Basic Auth: "Authorization: Basic <base64(username:password)>"
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const base64Credentials = authHeader.slice("Basic ".length).trim();
    const credentials = Buffer.from(base64Credentials, "base64").toString(
      "ascii",
    );
    const [username, password] = credentials.split(":");

    const verified = await authService.verifyCredentials(username, password);
    if (!verified) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    req.user = username;
    next();
  };
}

export function authorizePermission(
  authService: AuthService,
  permission: string,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const hasPermission = authService.checkPermission(req.user, permission);
    if (!hasPermission) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
