import { BaseFs, EnstoreFsConfig } from "./BaseFs";
import axios from "axios";
import { PassThrough, Writable } from "stream";
import path from "path";
import FormData from "form-data";
import { EnstorePromiseFs } from "./EnstorePromiseFs";

export interface CreateWriteStreamOptions {
  encoding?: BufferEncoding;
  flags?: string;
  mode?: number;
}

export class EnstoreFs extends BaseFs {
  public static promises: EnstorePromiseFs;

  constructor(config: EnstoreFsConfig) {
    super(config);
    // Also attach a static instance of EnstorePromiseFs
    if (!EnstoreFs.promises) {
      // Create a new instance with the same config for convenience
      EnstoreFs.promises = new EnstorePromiseFs(config);
    }
  }

  /**
   * createWriteStream(path, [options]) => Writable
   *
   * A truly streaming approach: we create a PassThrough that we append to a FormData.
   * Then we start an Axios POST request in parallel. As data is written to the
   * PassThrough, it's sent chunk-by-chunk to the server.
   */
  public createWriteStream(filePath: string): Writable {
    const remotePath = this.resolveRemotePath(filePath);
    const parentDir = path.dirname(remotePath);
    const fileName = path.basename(remotePath);

    // We create a PassThrough, which we'll pipe to the multipart form
    const passThrough = new PassThrough();
    const form = new FormData();
    form.append("file", passThrough, fileName);

    // Construct the final URL
    const url = `${this.endpoint}/files/writeFile?path=${encodeURIComponent(parentDir)}`;

    // Start the Axios POST request immediately
    const requestPromise = axios
      .post(url, form, {
        auth: { username: this.username, password: this.password },
        headers: form.getHeaders(),
        // Ensures large uploads don't get truncated:
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })
      .then(() => {
        passThrough.emit("uploaded");
      })
      .catch((err) => {
        passThrough.emit("error", err);
      });

    // Return the PassThrough as a writable stream to the caller.
    // As the caller writes data to this stream, it flows to the server chunk-by-chunk.
    return passThrough;
  }
}
