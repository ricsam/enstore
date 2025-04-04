import { Router, Request, Response, RequestHandler } from "express";
import { AuthService } from "../auth/auth";
import { authorizePermission } from "../middleware/auth-middleware";
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
          res.status(400).json({ error: "Missing dir parameter" });
          return;
        }

        const targetDir = resolveSafePath(dirParam);
        // If this directory doesn't exist or is a file, handle errors
        if (!fs.existsSync(targetDir)) {
          res.status(404).json({ error: "Directory not found" });
          return;
        }
        if (!fs.lstatSync(targetDir).isDirectory()) {
          res.status(400).json({ error: "Not a directory" });
          return;
        }

        const files = fs.readdirSync(targetDir);
        res.json({ files });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    },
  );

  // Read file endpoint (permission: "read")
  router.get(
    "/readFile",
    authorizePermission(authService, "read"),
    (req: Request, res: Response): void => {
      const relativePath = req.query.path as string;
      if (!relativePath) {
        res.status(400).json({ error: "Missing file path" });
        return;
      }

      let filePath: string;
      try {
        filePath = resolveSafePath(relativePath);
      } catch (error) {
        res.status(403).json({ error: (error as Error).message });
        return;
      }

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: `File not found: ${relativePath}` });
        return;
      }

      // Stream the file content back to the client
      const readStream = fs.createReadStream(filePath);
      readStream.on("error", (err) => {
        return res.status(500).json({ error: err.message });
      });
      readStream.pipe(res);
    },
  );

  const getUploadPath = (
    req: Request,
    file: Express.Multer.File,
  ): string | Error => {
    // The user-provided 'path' is the directory portion where the file is to be placed.
    const requestedDir = (req.query.path as string) || "/";

    // The original name from the upload
    const { originalname } = file;

    let targetDir: string;
    try {
      targetDir = resolveSafePath(requestedDir);
    } catch (error) {
      // If user tries to escape outside rootDir
      const err = error as Error;
      console.log(err.message);
      return err;
    }

    // Ensure targetDir exists or create it
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Final path (directory + filename)
    const finalPath = path.join(targetDir, originalname);

    if (!finalPath.startsWith(rootDir)) {
      const msg = `Permission denied: path "${finalPath}" escapes uploads directory.`;
      console.log(msg);
      return new Error(msg);
    }

    return finalPath;
  };

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const finalPath = getUploadPath(req, file);
      if (typeof finalPath === "string") {
        const uploadDest = path.dirname(finalPath);
        cb(null, uploadDest);
      } else {
        const err = finalPath;
        cb(err, "/tmp");
      }
    },
    filename: function (req, file, cb) {
      const finalPath = getUploadPath(req, file);
      if (typeof finalPath === "string") {
        const filename = path.basename(finalPath);
        cb(null, filename);
      } else {
        const err = finalPath;
        cb(err, "/tmp");
      }
    },
  });
  const upload = multer({ storage });

  // Write file endpoint (permission: "write")
  // The user can specify a "path" query param (e.g., /writeFile?path=/some/nested/dir).
  // The uploaded file "file" then goes to that directory, using the original filename.
  router.post(
    "/writeFile",
    authorizePermission(authService, "write"),
    upload.single("file"),
    (req: Request, res: Response): void => {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const { originalname, path: tempPath } = req.file;

      res.json({
        message: "File uploaded successfully",
        fileName: originalname,
      });
    },
  );

  router.post(
    "/mkdir",
    authorizePermission(authService, "write"),
    (req: Request, res: Response) => {
      const dirPath = req.query.path as string;
      if (!dirPath) {
        return res.status(400).json({ error: "Missing directory path" });
      }

      let targetDir: string;
      try {
        targetDir = resolveSafePath(dirPath);
      } catch (error) {
        // If user tries to escape outside rootDir
        res.status(403).json({ error: (error as Error).message });
        return;
      }

      try {
        fs.mkdirSync(targetDir, req.body.options);
        return res.json({ message: `Directory created: ${targetDir}` });
      } catch (error) {
        return res.status(500).json({ error: (error as Error).message });
      }
    },
  );

  return router;
}
