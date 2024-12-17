import { Router, Request, Response } from "express";
import { AuthService } from "../auth/auth";
import { authorizePermission } from "../middleware/authMiddleware";
import fs from "fs";
import path from "path";
import multer from "multer";

export function fileRoutes(
  authService: AuthService,
  uploadDir: string,
): Router {
  const router = Router();
  // We store the root directory in a resolved absolute path for security checks
  const rootDir = path.resolve(uploadDir);

  // For the file upload, we’ll use a custom destination function so that Multer places
  // the uploaded file into a temp location or a subfolder. However, we can also let it store
  // it in `uploadDir` by default, then we rename to the correct subpath.
  const upload = multer({ dest: uploadDir });

  /**
   * Utility: Safely resolve a request path relative to rootDir (e.g. /uploads).
   * If user requests path="/readme.txt", this becomes /uploads/readme.txt.
   * If the resolved path is outside rootDir, throw an error.
   */
  function resolveSafePath(relativePath: string): string {
    // Strip leading slash so path.join doesn't ignore the rootDir on some platforms
    const sanitized = relativePath.replace(/^\/+/, "");
    const resolved = path.resolve(rootDir, sanitized);

    // Ensure the resolved path is still within uploadDir
    if (!resolved.startsWith(rootDir)) {
      throw new Error(
        `Permission denied: path "${relativePath}" escapes uploads directory.`,
      );
    }

    return resolved;
  }

  // List files endpoint (permission: "read")
  router.get(
    "/ls",
    authorizePermission(authService, "read"),
    async (req: Request, res: Response) => {
      try {
        const dirParam = req.query.dir as string;
        if (!dirParam) {
          return res.status(400).json({ error: "Missing dir parameter" });
        }

        const targetDir = resolveSafePath(dirParam);
        // If this directory doesn't exist or is a file, handle errors
        if (!fs.existsSync(targetDir)) {
          return res.status(404).json({ error: "Directory not found" });
        }
        if (!fs.lstatSync(targetDir).isDirectory()) {
          return res.status(400).json({ error: "Not a directory" });
        }

        const files = fs.readdirSync(targetDir);
        return res.json({ files });
      } catch (error) {
        return res.status(500).json({ error: (error as Error).message });
      }
    },
  );

  // Read file endpoint (permission: "read")
  router.get(
    "/readFile",
    authorizePermission(authService, "read"),
    (req: Request, res: Response) => {
      const relativePath = req.query.path as string;
      if (!relativePath) {
        return res.status(400).json({ error: "Missing file path" });
      }

      let filePath: string;
      try {
        filePath = resolveSafePath(relativePath);
      } catch (error) {
        return res.status(403).json({ error: (error as Error).message });
      }

      if (!fs.existsSync(filePath)) {
        return res
          .status(404)
          .json({ error: `File not found: ${relativePath}` });
      }

      // Stream the file content back to the client
      const readStream = fs.createReadStream(filePath);
      readStream.on("error", (err) => {
        return res.status(500).json({ error: err.message });
      });
      readStream.pipe(res);
    },
  );

  // Write file endpoint (permission: "write")
  // The user can specify a "path" query param (e.g., /writeFile?path=/some/nested/dir).
  // The uploaded file "file" then goes to that directory, using the original filename.
  router.post(
    "/writeFile",
    authorizePermission(authService, "write"),
    upload.single("file"),
    (req: Request, res: Response) => {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // The user-provided 'path' is the directory portion where the file is to be placed.
      const requestedDir = (req.query.path as string) || "/";
      // The original name from the upload
      const { originalname, path: tempPath } = req.file;

      let targetDir: string;
      try {
        targetDir = resolveSafePath(requestedDir);
      } catch (error) {
        // If user tries to escape outside rootDir
        return res.status(403).json({ error: (error as Error).message });
      }

      // Ensure targetDir exists or create it
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Final path (directory + filename)
      const finalPath = path.join(targetDir, originalname);

      fs.rename(tempPath, finalPath, (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        return res.json({
          message: "File uploaded successfully",
          fileName: originalname,
        });
      });
    },
  );

  return router;
}
