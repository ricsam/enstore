import axios from "axios";
import path from "path";
import realFs from "fs";
import { AuthHandler, EnstoreCredentials } from "./auth-handler";
import { EnstoreFsOptions } from "./types";

export interface ReadFileOptions {
  encoding?: BufferEncoding;
  flag?: string;
}

export interface WriteFileOptions {
  encoding?: BufferEncoding;
  mode?: number;
  flag?: string;
}

export class EnstorePromiseFs extends AuthHandler {
  public pathPrefix?: string;
  constructor(config?: EnstoreFsOptions) {
    super(config);
    this.pathPrefix = config?.pathPrefix;
  }

  /**
   * readFile(path, [options]) => Promise<Buffer | string>
   * Node.js signature: fs.promises.readFile(path[, options])
   */
  public async readFile(
    remotePath: string,
    options?: ReadFileOptions | BufferEncoding,
  ): Promise<string | Buffer> {
    // If the user passed a single encoding string, treat it as { encoding: string }
    let encoding: BufferEncoding | null = null;
    if (typeof options === "string") {
      encoding = options;
    } else if (options?.encoding) {
      encoding = options.encoding;
    }

    let prefixedRemotePath = remotePath;

    if (this.pathPrefix) {
      prefixedRemotePath = path.join(this.pathPrefix, remotePath);
    }

    // -- Perform the actual HTTP GET to your Enstore server endpoint
    // e.g. GET /files/readFile?path=<remotePath>
    try {
      const resp = await axios.get(`${this.endpoint}/files/readFile`, {
        params: { path: prefixedRemotePath },
        auth: { username: this.username!, password: this.password! },
        responseType: "arraybuffer",
      });
      if (encoding) {
        return Buffer.from(resp.data).toString(encoding);
      } else {
        return Buffer.from(resp.data);
      }
    } catch (error: any) {
      throw new Error(`Error reading remote file: ${error?.message || error}`);
    }
  }

  /**
   * writeFile(path, data, [options]) => Promise<void>
   * Node.js signature: fs.promises.writeFile(file, data[, options])
   */
  public async writeFile(
    remotePath: string,
    data: Buffer | string,
    options?: WriteFileOptions | BufferEncoding,
  ): Promise<void> {
    let encoding: BufferEncoding | null = null;
    if (typeof options === "string") {
      encoding = options;
    } else if (options?.encoding) {
      encoding = options.encoding;
    }

    // Convert data to a Buffer if it's a string
    let bufferData: Buffer;
    if (typeof data === "string") {
      bufferData = Buffer.from(data, encoding || "utf-8");
    } else {
      bufferData = data;
    }

    let prefixedRemotePath = remotePath;

    if (this.pathPrefix) {
      prefixedRemotePath = path.join(this.pathPrefix, remotePath);
    }


    // POST /files/writeFile?path=<remoteDir>
    // The Enstore server expects a multipart form-data with file content
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    // We'll pass the final filename as whatever remotePath's basename is
    const fileName = path.basename(prefixedRemotePath);
    form.append("file", bufferData, { filename: fileName });

    // remoteDir is the parent path (leading directories)
    const parentDir = path.dirname(prefixedRemotePath); // e.g. /nginx
    const url = `${this.endpoint}/files/writeFile`;

    try {
      await axios.post(url, form, {
        params: { path: parentDir },
        auth: { username: this.username, password: this.password },
        headers: form.getHeaders(),
      });
    } catch (error: any) {
      throw new Error(`Error writing remote file: ${error?.message || error}`);
    }
  }

  public async mkdir(
    path: string,
    options?: realFs.MakeDirectoryOptions & { recursive: true },
  ): Promise<void> {
    // POST /files/mkdir?path=<remoteDir>
    try {
      await axios.post(
        `${this.endpoint}/files/mkdir`,
        { options },
        {
          auth: { username: this.username, password: this.password },
          params: { path },
        },
      );
    } catch (error: any) {
      throw new Error(
        `Error creating remote directory: ${error?.message || error}`,
      );
    }
  }
}
