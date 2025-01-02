import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import express from "express";
import path from "path";
import request from "supertest";
import bodyParser from "body-parser";

import { AuthService } from "../src/auth/auth";
import { UserStore } from "../src/auth/user-store";
import { authMiddleware } from "../src/middleware/auth-middleware";
import { fileRoutes } from "../src/routes/file-routes";
import fs from "fs";

const testUsername = "testUser";
const testPassword = "testPassword";
const bcryptHash =
  "$2b$10$KjiYs45ypzGQdTeBmV2J3.uHD7AXcaIei0G1uimcTL5g2hxjf5D/O"; // Bcrypt hash for 'testPassword'
const initUser = {
  users: [
    {
      username: testUsername,
      hashedPassword: bcryptHash,
      role: "read-write",
    },
    {
      username: 'readUser',
      hashedPassword: bcryptHash,
      role: "read-only",
    },
  ],
  roles: {
    "read-write": ["read", "write"],
    "read-only": ["read"],
  },
};

describe("File Routes Tests", () => {
  const app = express();
  app.use(bodyParser.json());

  // Setup user store
  const userFilePath = path.join(__dirname, "users.json");
  let userStore: UserStore;
  let authService: AuthService;

  beforeAll(() => {
    // Prepare initial user store

    fs.mkdirSync(path.dirname(userFilePath), { recursive: true });
    fs.writeFileSync(userFilePath, JSON.stringify(initUser, null, 2), "utf-8");

    userStore = new UserStore(userFilePath);
    authService = new AuthService(userStore);

    // Use global auth middleware
    app.use(authMiddleware(authService));
    // Attach the routes with root directory = "/uploads"
    app.use("/files", fileRoutes(authService, "/uploads"));
  });

  beforeEach(() => {
    // Recreate the user file each test
    fs.mkdirSync(path.dirname(userFilePath), { recursive: true });
    const initialData = {
      users: [
        {
          username: testUsername,
          hashedPassword: bcryptHash,
          role: "read-write",
        },
      ],
      roles: {
        "read-write": ["read", "write"],
      },
    };
    fs.writeFileSync(
      userFilePath,
      JSON.stringify(initialData, null, 2),
      "utf-8",
    );

    // Clear/ recreate /uploads
    if (fs.existsSync("/uploads")) {
      fs.rmSync("/uploads", { recursive: true, force: true });
    }
    fs.mkdirSync("/uploads", { recursive: true });
  });

  const basicAuthHeader = () => {
    const token = Buffer.from(`${testUsername}:${testPassword}`).toString(
      "base64",
    );
    return `Basic ${token}`;
  };

  it("should list files in a directory (ls)", async () => {
    fs.mkdirSync("/uploads/subdir", { recursive: true });
    fs.writeFileSync("/uploads/subdir/file1.txt", "hello1");
    fs.writeFileSync("/uploads/subdir/file2.txt", "hello2");

    const res = await request(app)
      .get("/files/ls?dir=/subdir") // passing relative path (no /uploads prefix)
      .set("Authorization", basicAuthHeader())
      .expect(200);

    expect(res.body.files).toContain("file1.txt");
    expect(res.body.files).toContain("file2.txt");
  });

  it("should read a file content from /uploads/readme.txt via path=/readme.txt", async () => {
    fs.writeFileSync("/uploads/readme.txt", "This is a test file");

    const res = await request(app)
      .get("/files/readFile?path=/readme.txt")
      .set("Authorization", basicAuthHeader())
      .expect(200);

    expect(Buffer.from(res.body).toString()).toEqual("This is a test file");
  });

  it("should upload a file to the root upload directory", async () => {
    const testFileName = "upload.txt";
    const fileContent = "Uploaded content";

    const res = await request(app)
      .post("/files/writeFile?path=/") // store in root of /uploads
      .set("Authorization", basicAuthHeader())
      .attach("file", Buffer.from(fileContent), testFileName)
      .expect(200);

    expect(res.body.message).toBe("File uploaded successfully");
    const uploadedData = fs.readFileSync(
      path.join("/uploads", testFileName),
      "utf-8",
    );
    expect(uploadedData).toBe(fileContent);
  });

  it("should upload to a nested directory", async () => {
    const fileContent = "Nested content";

    const res = await request(app)
      .post("/files/writeFile?path=/some/nested/path")
      .set("Authorization", basicAuthHeader())
      .attach("file", Buffer.from(fileContent), "upload.txt")
      .expect(200);

    expect(res.body.message).toBe("File uploaded successfully");

    const nestedFile = fs.readFileSync(
      "/uploads/some/nested/path/upload.txt",
      "utf-8",
    );
    expect(nestedFile).toBe(fileContent);
  });

  it("should fail if requesting outside /uploads", async () => {
    // Attempt to read a file outside the root
    const outOfBoundPath = "/../etc/passwd";
    const res = await request(app)
      .get(`/files/readFile?path=${outOfBoundPath}`)
      .set("Authorization", basicAuthHeader())
      .expect(403);

    expect(res.body.error).toMatch(/Permission denied/);
  });

  it("should create a directory using POST /files/mkdir with write permission", async () => {
    // 4) We do Basic Auth for the testUser (assuming your server expects that)
    const authHeader =
      "Basic " + Buffer.from("testUser:testPassword").toString("base64");

    const dirToCreate = "/myNewDir";

    const res = await request(app)
      .post("/files/mkdir?path=" + dirToCreate)
      .set("Authorization", authHeader)
      .expect(200);

    const dirPathOnServer = path.join("/uploads", dirToCreate);
    expect(res.body.message).toContain(`Directory created: ${dirPathOnServer}`);

    const stat = fs.statSync(dirPathOnServer);
    expect(stat.isDirectory()).toBe(true);
  });

  it('should fail without "write" permission', async () => {
    // Now let's attempt mkdir with readUser
    const authHeader =
      "Basic " + Buffer.from("readUser:" + testPassword).toString("base64");
    const dirToCreate = "/noWriteDir";

    const res = await request(app)
      .post("/files/mkdir")
      .set("Authorization", authHeader)
      .send({ path: dirToCreate })
      .expect(403);

    expect(res.body.error).toMatch(/Forbidden/);
  });
});
