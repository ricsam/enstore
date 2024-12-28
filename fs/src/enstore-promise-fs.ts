import axios from "axios";
import path from "path";
import { AuthHandler, EnstoreCredentials } from "./auth-handler";

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
  constructor(config: EnstoreCredentials) {
    super(config);
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

    // -- Perform the actual HTTP GET to your EnStore server endpoint
    // e.g. GET /files/readFile?path=<remotePath>
    try {
      const resp = await axios.get(`${this.endpoint}/files/readFile`, {
        params: { path: remotePath },
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

    // POST /files/writeFile?path=<remoteDir>
    // The EnStore server expects a multipart form-data with file content
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    // We'll pass the final filename as whatever remotePath's basename is
    const fileName = path.basename(remotePath);
    form.append("file", bufferData, { filename: fileName });

    // remoteDir is the parent path (leading directories)
    const parentDir = path.dirname(remotePath); // e.g. /nginx
    const url = `${this.endpoint}/files/writeFile?path=${encodeURIComponent(parentDir)}`;

    try {
      await axios.post(url, form, {
        auth: { username: this.username, password: this.password },
        headers: form.getHeaders(),
      });
    } catch (error: any) {
      throw new Error(`Error writing remote file: ${error?.message || error}`);
    }
  }
}
