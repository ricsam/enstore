import { EnstoreFs } from "@enstore/fs";
import { createEnstoreMiddleware } from "@enstore/server";
import bodyParser from "body-parser";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  Mock,
  spyOn,
} from "bun:test";
import express from "express";
import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import { program } from "./program";

let enFs: EnstoreFs;
let server: http.Server;
let endpoint: string;
const username = "testUser";
const password = "testPassword";

beforeAll(() => {
  const bcryptHash =
    "$2b$10$KjiYs45ypzGQdTeBmV2J3.uHD7AXcaIei0G1uimcTL5g2hxjf5D/O"; // Bcrypt hash for 'testPassword'

  const initialData = {
    users: [
      {
        username: username,
        hashedPassword: bcryptHash,
        role: "read-write",
      },
    ],
    roles: {
      "read-write": ["read", "write"],
    },
  };

  const userFilePath = "/users.json";

  fs.mkdirSync(path.dirname(userFilePath), { recursive: true });
  fs.writeFileSync(userFilePath, JSON.stringify(initialData, null, 2), "utf-8");

  const app = express();
  app.use(express.json());
  app.use(bodyParser.json());
  server = app.listen(0);
  app.use(
    "/",
    createEnstoreMiddleware({
      uploadsDirectory: "/uploads",
      userFilePath,
    }),
  );

  const port = (server.address() as any).port;
  endpoint = `http://localhost:${port}`;
  enFs = new EnstoreFs({
    endpoint,
    username,
    password,
  });

  const dir = path.join(os.homedir(), ".enstore");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "credentials.json"),
    JSON.stringify({
      endpoint,
      username,
      encryptedPassword: Buffer.from(password).toString("base64"),
    }),
    "utf-8",
  );
});

afterAll(async () => {
  server.close();
});

const runCli = async (...args: string[]) => {
  await program.parseAsync(["bun", "program.ts", ...args]);
};

let spyLog: Mock<any>;
let spyStdout: Mock<any>;

beforeEach(() => {
  spyLog = spyOn(console, "log").mockImplementation((...args: any[]) => {});
  spyStdout = spyOn(process.stdout, "write").mockImplementation(
    (text: string) => {
      return true;
    },
  );
});

afterEach(() => {
  spyLog.mockRestore();
  spyStdout.mockRestore();
});

it("should list files in root directory", async () => {
  // Pre-populate the in-memory filesystem or mock if needed
  fs.mkdirSync("/uploads/testdir", { recursive: true });
  fs.writeFileSync("/uploads/testdir/file1.txt", "content");

  await runCli("ls", "/testdir");

  // Check the console output
  expect(spyLog).toHaveBeenCalledWith(
    "Files:",
    expect.arrayContaining(["file1.txt"]),
  );
});

it("should read a file", async () => {
  // Suppose we have a file "/uploads/readme.txt" with some content
  fs.writeFileSync("/uploads/readme.txt", "Hello world");

  await runCli("read", "/readme.txt");

  // The CLI prints the file content to console.log
  expect(spyStdout).toHaveBeenCalledWith(
    expect.stringContaining("Hello world"),
  );
});

it("should write a file to the server", async () => {
  fs.writeFileSync("/localFile.txt", "new content");
  await runCli("write", "/localFile.txt", "/uploadedDir");

  // Check that the CLI logs a success message
  expect(spyLog).toHaveBeenCalledWith(
    "Upload response:",
    expect.objectContaining({
      message: "File uploaded successfully",
    }),
  );

  // Optionally check the in-memory fs to ensure file is there:
  const content = fs.readFileSync(
    "/uploads/uploadedDir/localFile.txt",
    "utf-8",
  );
  expect(content).toBe("new content");

  spyLog.mockRestore();
});

it("should create a directory", async () => {
  await runCli("mkdir", "/newDir");

  expect(spyLog).toHaveBeenLastCalledWith(
    expect.stringContaining("Directory created"),
  );

  // Optionally, verify in the in-memory filesystem:
  const stat = fs.statSync("/uploads/newDir");
  expect(stat.isDirectory()).toBe(true);
});

it("should create a directory recursively with -r option", async () => {
  // Attempt to create nested directories in one go:
  await runCli("mkdir", "-r", "/nested/parent/child");

  // Verify the CLI output
  expect(spyLog).toHaveBeenCalledWith(
    expect.stringContaining("Directory created"),
  );

  // Check the in-memory filesystem to confirm both 'parent' and 'child' exist
  const statParent = fs.statSync("/uploads/nested/parent");
  const statChild = fs.statSync("/uploads/nested/parent/child");
  expect(statParent.isDirectory()).toBe(true);
  expect(statChild.isDirectory()).toBe(true);
});
