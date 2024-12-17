# EnStore Project

**EnStore** is a **network file system**, **file server** and **file management ecosystem** built in Node.js (and Bun), enabling file-based operations with **authentication**, **authorization**, **role-based access control**, and **streaming** capabilities. The project is divided into **multiple packages**, each focusing on a specific domain:

1. **`@enstore/server`**

   - A Node.js (or Bun) server exposing file operations over HTTP/HTTPS with chunked file uploads, user management, and role-based permissions.
   - Can run as Express middleware, a standalone CLI server, or inside Docker.

2. **`@enstore/cli`**

   - A command-line interface for interacting with an EnStore server.
   - Supports file listing, reading, writing, user management, and role management.
   - Credentials are stored locally in `~/.enstore/credentials.json` or specified via environment variables.

3. **`@enstore/fs`**
   - A Node.js–style filesystem API that **mounts** EnStore as if it were a local filesystem.
   - Provides methods analogous to Node’s `fs` and `fs.promises`, including `createWriteStream`, `readFile`, `writeFile`.
   - Perfect for directly integrating with EnStore servers as if they were local disks.

## Features

- **File Operations**: List directories, read files, write/upload files (with chunked or streaming uploads).
- **Authentication & Authorization**:
  - File-based user store (`users.json`) with **bcrypt** hashed passwords.
  - **Role-based** permissions (`read`, `write`, `manageUsers`, etc.).
- **Streaming**: Chunked uploads with `multer` or direct streaming forms.
- **Multiple Deployment Modes**:
  - **Express Middleware** – embed EnStore endpoints into an existing Express app
  - **Standalone CLI** – quickly start an EnStore server with `enstore-server start`
  - **Docker** – containerize everything, run with environment variables for dynamic user creation

---

## 1. @enstore/server

**`@enstore/server`** is the **core** file server.  
**Key capabilities**:

- Exposes a file management API (`/files/ls`, `/files/readFile`, `/files/writeFile`).
- Manages **authentication** & **authorization** using a **file-based** user store (`users.json`).
- Supports **Express middleware** usage, **standalone CLI** (`enstore-server start`), or **Docker** container.

[**Read more** about `@enstore/server` →](./server/README.md)

---

## 2. @enstore/cli

**`@enstore/cli`** is a command-line interface that interacts with any EnStore server.  
**Highlights**:

- **`enstore login <endpoint> <username>`** to store credentials (endpoint, username, password) in `~/.enstore/credentials.json`.
- **`enstore ls`, `enstore read`, `enstore write`** – list, read, and write files.
- **`enstore user add/update/delete`** – manage users.
- **`enstore role update/delete`** – manage roles.
- Credentials can be overridden by environment variables (`ENSTORE_ENDPOINT`, `ENSTORE_USERNAME`, `ENSTORE_PASSWORD`).

[**Read more** about `@enstore/cli` →](./cli/README.md)

---

## 3. @enstore/fs

**`@enstore/fs`** provides a **Node.js `fs`–like** API for reading/writing files against an EnStore server.  
**Features**:

- **`EnstoreFs`** with **`createWriteStream`** – stream file uploads chunk-by-chunk.
- **`EnstorePromiseFs`** with `readFile` and `writeFile` – promise-based approach.
- **Root directory mapping** – treat a local directory (e.g., `/var/logs`) as root mapped to `"/"` on the remote server.

[**Read more** about `@enstore/fs` →](./fs/README.md)

---

## Installation & Usage

### Global Installation (CLI)

```bash
npm install -g @enstore/server @enstore/cli
```

Now you can run:

```bash
enstore-server start --port 3000 --users ./users.json -d ./uploads
enstore login http://localhost:3000 admin
enstore ls /
```

### Docker

**Pull** the pre-built Docker image or build your own. For example:

```bash
docker pull ghcr.io/ricsam/enstore-server:latest
docker run -d \
  -p 8080:3000 \
  -v /host/path/uploads:/app/uploads \
  ghcr.io/ricsam/enstore-server:latest start --port 3000 --users /app/users.json --uploads-dir /app/uploads
```

**Admin User** (Optional):

```bash
docker run -d \
  -p 8080:3000 \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD=secret \
  ghcr.io/ricsam/enstore-server:latest
```

(Your entrypoint script checks env vars and creates the admin user automatically.)

---

## Contributing

- **Bug Reports**: Please open an issue in the main EnStore repository.
- **Features/PRs**: We welcome community contributions. Each package has its own subfolder – follow the code style and structure.

**Areas** to contribute or expand:

- More `fs`-like methods (e.g., `readdir`, `stat`, `unlink`, etc.) in **`@enstore/fs`**
- Enhanced CLI commands (e.g., `move`, `copy` files)
- Extended server routes for advanced file management

---

## License

EnStore is licensed under the **MIT License**.  
See [LICENSE](./LICENSE) for more details.
