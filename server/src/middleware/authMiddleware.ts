import { NextFunction, Request, RequestHandler, Response } from "express";
import { AuthService } from "../auth/auth";

declare global {
  namespace Express {
    interface Request {
      user?: string;
    }
  }
}

export function authMiddleware(authService: AuthService): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // For simplicity, assume Basic Auth: "Authorization: Basic <base64(username:password)>"
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const base64Credentials = authHeader.slice("Basic ".length).trim();
    const credentials = Buffer.from(base64Credentials, "base64").toString(
      "ascii",
    );
    const [username, password] = credentials.split(":");

    const verified = await authService.verifyCredentials(username, password);
    if (!verified) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    req.user = username;
    next();
  };
}

export function authorizePermission(
  authService: AuthService,
  permission: string,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const hasPermission = authService.checkPermission(req.user, permission);
    if (!hasPermission) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
