# @enstore/fs

**`@enstore/fs`** is a Node.js–style file system interface that seamlessly **mounts** a remote [Enstore](https://github.com/ricsam/enstore) server as if it were a local filesystem. It provides APIs similar to **Node.js `fs`**—both **stream-based** (`createWriteStream`) and **promise-based** (`readFile`, `writeFile`).

It introduces the following classes:

1. **`EnstoreFs`**  
   - Offers a **`createWriteStream`** method analogous to `fs.createWriteStream` in Node.js, allowing you to **stream** file uploads chunk-by-chunk to an Enstore server.
   - Exposes a **static** property **`EnstoreFs.promises`** pointing to an **`EnstorePromiseFs`** instance for promise-based operations.

2. **`EnstorePromiseFs`**  
   - Provides **`readFile`** and **`writeFile`** methods that follow Node.js’s **promise-based** `fs.promises` API signatures.
   - Use these methods to read or write remote files asynchronously.

Both classes extend a common **`BaseFs`** abstract class which handles **credential resolution** and **root directory mapping**.

---

## Installation

```bash
npm install @enstore/fs
```

---

## Usage Overview

1. **Instantiate** an **`EnstoreFs`** or **`EnstorePromiseFs`** object with configuration for:
   - **Root directory** (a local path you treat as `"/"` on the Enstore server)
   - **Credentials** (endpoint, username, password) either directly, via environment variables, or via a credential file.

2. **Use** the familiar `fs`-like methods:
   - **`readFile`** / **`writeFile`** (Promise-based in `EnstorePromiseFs`)
   - **`createWriteStream`** (in `EnstoreFs`) for streaming writes
   - The static property **`EnstoreFs.promises`** is a convenience instance for promise-based operations.

---

## Quick Example

```ts
import { EnstoreFs } from '@enstore/fs';

const enFs = new EnstoreFs({
  // credentials can come from environment or credentials file
});

// 1) Use the static promise-based API
await EnstoreFs.promises.writeFile('/var/logs/nginx/access.log', 'Hello, world\n', 'utf-8');
const content = await EnstoreFs.promises.readFile('/var/logs/nginx/access.log', 'utf-8');
console.log('Remote content:', content);

// 2) Or use createWriteStream for streaming
const writeStream = enFs.createWriteStream('/var/logs/app/streamed.log');
writeStream.write('Some chunk of data\n');
writeStream.write('Another chunk\n');
writeStream.end(() => {
  console.log('Stream upload complete!');
});
```

In this example, **local** file paths like `"/var/logs/nginx/access.log"` map to **remote** Enstore paths like `"/nginx/access.log"`.

---

## Configuration and Credential Resolution

### `BaseFs` Constructor Config

```ts
interface EnstoreFsConfig {
  endpoint?: string;
  username?: string;
  password?: string;
  credentialsFilePath?: string;
}
```

**Credentials** can be resolved in **three** steps:
  1. **Constructor** config: if `endpoint`, `username`, `password` are explicitly provided, these take priority.
  2. **Environment Variables**: `ENSTORE_ENDPOINT`, `ENSTORE_USERNAME`, `ENSTORE_PASSWORD`.
  3. **Credentials File**: A JSON file (by default at `~/.enstore/credentials.json`) or a custom path specified by `credentialsFilePath`.

If any required credential (`endpoint`, `username`, `password`) remains missing after these steps, the constructor throws an error.

---

## EnstoreFs

**`EnstoreFs`** extends `BaseFs` and provides:

- **`createWriteStream(path, [options])`**  
  Returns a **`Writable`** Node.js stream that uploads data to Enstore **in real time**. As you write chunks, they are streamed chunk-by-chunk to the remote server using multipart form-data.

- **Static**: **`EnstoreFs.promises`** (instance of `EnstorePromiseFs`)  
  A convenient way to access promise-based methods without instantiating `EnstorePromiseFs` separately.

### Streaming Example

```ts
const enFs = new EnstoreFs();

const writeStream = enFs.createWriteStream('/data/logs/giantFile.log');

writeStream.on('uploaded', () => {
  console.log('Upload success');
});
writeStream.on('error', err => {
  console.error('Upload failed:', err);
});

// Write data in chunks
writeStream.write('chunk 1...');
writeStream.write('chunk 2...');
writeStream.end();
```

Your Enstore server (e.g. Express + Multer) can handle this multipart chunked upload. This approach is memory-efficient for large files.

---

## EnstorePromiseFs

**`EnstorePromiseFs`** extends `BaseFs` and implements:

- **`readFile(path, [options])`** → `Promise<Buffer | string>`  
  Just like `fs.promises.readFile`, supports an `encoding` option to return a string.

- **`writeFile(path, data, [options])`** → `Promise<void>`  
  Similar to `fs.promises.writeFile`, supports string or buffer data.

**Example**:

```ts
import { EnstorePromiseFs } from '@enstore/fs';

(async function main() {
  const promiseFs = new EnstorePromiseFs();

  await promiseFs.writeFile('/home/user/files/note.txt', 'Hello from Enstore!', 'utf-8');
  const content = await promiseFs.readFile('/home/user/files/note.txt', 'utf-8');
  console.log(content);
})();
```

---

## Credentials File

By default, credentials are read from:

```
~/.enstore/credentials.json
```

A typical `credentials.json`:

```json
{
  "endpoint": "http://my-enstore-server:3000",
  "username": "admin",
  "encryptedPassword": "base64encodedString..."
}
```

If you prefer a different path, specify **`credentialsFilePath`** in the constructor config:

```ts
new EnstoreFs({
  credentialsFilePath: '/path/to/mycreds.json'
});
```

---

## Installation & Example

1. **Install**:
   ```bash
   npm install @enstore/fs
   ```

2. **Create an instance**:
   ```ts
   import { EnstoreFs } from '@enstore/fs';

   const enFs = new EnstoreFs({
     // endpoint, username, password can come from ENV or credentialsFile
   });

   // Stream upload
   const ws = enFs.createWriteStream('/mnt/myfiles/someLargeFile.bin');
   ws.write(...);
   ws.end();
   ```

3. **Promise-based**:
   ```ts
   await EnstoreFs.promises.writeFile('/mnt/myfiles/report.txt', 'Report data', 'utf-8');
   const content = await EnstoreFs.promises.readFile('/mnt/myfiles/report.txt', 'utf-8');
   console.log(content);
   ```

---

## Limitations & Notes

- **Chunked Streaming**: The `createWriteStream` method uses a **multipart** approach to chunk data. Ensure your Enstore server supports streaming multipart uploads (e.g. with Multer, Busboy, etc.).
- **Root Directory**: Strictly enforces paths under the specified root. Trying to read/write outside will throw an error.
- **File listing** / other `fs` methods (like `readdir`, `stat`) are **not** yet implemented. You can add them following a similar pattern (use `/files/ls` or `/files/stat` Enstore endpoints).
- **Large Files**: For truly large files, ensure your server and network settings allow streaming without memory constraints. The streaming approach helps avoid loading the entire file in memory at once.
- **Error Handling**: The library throws standard JavaScript errors if the Enstore server responds with an error, or if credentials are missing.

---

## Contributing

PRs are welcome for additional features such as:
- `readdir`, `stat`, `unlink`, etc.
- Improved streaming error-handling or partial uploads.
- Enhanced credential management or token-based authentication.

