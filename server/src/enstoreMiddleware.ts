import bodyParser from "body-parser";
import express, { Router } from "express";
import fs from "fs";
import { AuthService } from "./auth/auth";
import { UserStore } from "./auth/userStore";
import { authMiddleware } from "./middleware/authMiddleware";
import { fileRoutes } from "./routes/fileRoutes";
import { userRoutes } from "./routes/userRoutes";

export interface EnStoreConfig {
  uploadsDirectory: string;
  userFilePath: string;
}

export function createEnStoreMiddleware(config: EnStoreConfig): Router {
  const { uploadsDirectory, userFilePath } = config;

  // Prepare directories
  if (!fs.existsSync(uploadsDirectory)) {
    fs.mkdirSync(uploadsDirectory, { recursive: true });
  }

  const userStore = new UserStore(userFilePath);
  const authService = new AuthService(userStore);

  // Create an Express Router
  const router = express.Router();
  router.use("/healthz", (req, res) =>
    res.json({ status: "ok", encacheVersion: "1.0.0" }),
  );

  router.use(bodyParser.json());

  // Global authentication middleware (Basic Auth)
  router.use(authMiddleware(authService));

  // Attach routes
  router.use("/files", fileRoutes(authService, uploadsDirectory));
  router.use("/users", userRoutes(authService, userStore));

  return router;
}