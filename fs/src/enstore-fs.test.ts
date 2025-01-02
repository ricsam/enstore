import bodyParser from "body-parser";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import express from "express";
import fs from "fs";
import http from "http";
import path from "path";

import { createEnstoreMiddleware } from "@enstore/server";
import { EnstoreFs } from "./enstore-fs";

describe("EnstoreFs", () => {
  let enFs: EnstoreFs;
  let server: http.Server;

  beforeAll(() => {
    const testUsername = "testUser";
    const testPassword = "testPassword";
    const bcryptHash =
      "$2b$10$KjiYs45ypzGQdTeBmV2J3.uHD7AXcaIei0G1uimcTL5g2hxjf5D/O"; // Bcrypt hash for 'testPassword'

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

    const userFilePath = "/users.json";

    fs.mkdirSync(path.dirname(userFilePath), { recursive: true });
    fs.writeFileSync(
      userFilePath,
      JSON.stringify(initialData, null, 2),
      "utf-8",
    );

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
    const endpoint = `http://localhost:${port}`;
    enFs = new EnstoreFs({
      endpoint,
      username: testUsername,
      password: testPassword,
      pathPrefix: "/somePrefix",
    });
  });

  afterAll(async () => {
    server.close();
  });

  it("should write a file using createWriteStream and confirm on server", async () => {
    // 2) Write data
    const ws = enFs.createWriteStream("/myTest.txt");
    ws.write("Hello, Enstore!\n");
    ws.end();

    // Wait a bit for the upload to finalize
    await new Promise((resolve) => ws.on("uploaded", resolve));

    const filePath = path.join("/uploads/somePrefix", "myTest.txt");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Hello, Enstore!");
  });

  it("should read a file using createReadStream", async () => {
    // 1) Put a file in the server side memfs
    const filePath = path.join("/uploads/somePrefix", "readMe.txt");
    fs.writeFileSync(filePath, "This is a file on the server", "utf-8");

    const rs = enFs.createReadStream("/readMe.txt");
    let data = "";
    await new Promise<void>((resolve, reject) => {
      rs.on("data", (chunk) => {
        data += chunk.toString();
      });
      rs.on("end", resolve);
      rs.on("error", reject);
    });
    expect(data).toBe("This is a file on the server");
  });


  it('should mkdir, writeFile, and readFile via enstoreFs.promises.*', async () => {
    await enFs.promises.mkdir('/myDir'); 
    const filePath = '/myDir/hello.txt';
    const fileContent = 'Hello from Jest!';
    await enFs.promises.writeFile(filePath, fileContent, 'utf-8');

    const readData = await enFs.promises.readFile(filePath, 'utf-8');
    expect(readData).toBe(fileContent);

    const actualFilePath = path.join('/uploads', 'somePrefix/myDir', 'hello.txt');
    const memfsData = fs.readFileSync(actualFilePath, 'utf-8');
    expect(memfsData).toEqual(fileContent);
  });
});
