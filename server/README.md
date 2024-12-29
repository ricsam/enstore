# @enstore/server

A lightweight Node.js + TypeScript file server with:

- **File listing**, reading, and writing (with streaming uploads)
- **Authentication & Authorization** (file-based user management with bcrypt)
- **Role-based access control**
- **Configurable** as:
  - **Express middleware**  
  - **Standalone CLI** (`enstore-server start`)  
  - **Docker** container (pull from `ghcr.io/ricsam/enstore-server`)

## Installation

```bash
npm install -g @enstore/server
```

Once installed globally, you have the `enstore-server` command available.

---

## Usage

### 1. **Run as Express Middleware**

You can embed Enstore’s routes in your own Express app by using the middleware factory:

```ts
import express from 'express';
import { createEnstoreMiddleware, EnstoreServerConfig } from '@enstore/server';

const app = express();
const config: EnstoreServerConfig = {
  uploadsDirectory: './uploads',
  userFilePath: './users.json',
};

app.use('/enstore', createEnstoreMiddleware(config));

app.listen(3000, () => {
  console.log(`Server running on port 3000`);
});
```

Here, `uploadsDirectory` is where files are stored, and `userFilePath` is the file-based store (`users.json`) for authentication and role-based permissions.

---

### 2. **Run as CLI**

After installing globally:

```bash
enstore-server start --port 8080 --users ./users.json --uploads-dir ./uploads
```

**Flags**:
- `-p, --port <port>`: Port the server listens on (defaults to `3000`).
- `--users <path>`: Path to `users.json` (defaults to `~/.enstore/users.json` if not specified).
- `-d, --uploads-dir <path>`: Directory for uploaded files (defaults to `./uploads`).

If you omit flags, Enstore uses sensible defaults (port 3000, `~/.enstore/users.json`, `./uploads` folder).

**Example**:
```bash
enstore-server start --port 8080 --users /path/to/users.json --uploads-dir /path/to/uploads
```

---

### 3. **Docker**

Pull the pre-built Docker image from [ghcr.io/ricsam/enstore-server](https://github.com/ricsam/enstore-server/pkgs/container/enstore-server):

```bash
docker pull ghcr.io/ricsam/enstore-server:latest
```

**Example** run command:

```bash
docker run -d \
  -p 8080:3000 \
  -v /host/path/users.json:/app/users.json \
  -v /host/path/uploads:/app/uploads \
  ghcr.io/ricsam/enstore-server:latest \
  start --port 3000 --users /app/users.json --uploads-dir /app/uploads
```

This starts Enstore inside a container listening on port 3000 (mapped to 8080 on the host).

---

## Local User Management via CLI

**`enstore-server user`** subcommands let you **manage the local `users.json` file directly** without running the server. This is useful for adding or updating users offline. The updated file is then used when you start the server.

```bash
enstore-server user add <username> <role>
# => Prompts for password, adds user locally to your specified users.json

enstore-server user update <username> [--role <role>] [--password]
# => Can update user role and/or prompt for new password

enstore-server user delete <username>
# => Removes a user

enstore-server user add-role <role> <permissions...>
enstore-server user update-role <role> <permissions...>
enstore-server user delete-role <role>
```

**Flags**:
- `--users <path>`: Path to the `users.json` file (if omitted, defaults to `~/.enstore/users.json`).

**Examples**:

```bash
# Add a new user "alice" with "read-write" role
enstore-server user add alice read-write --users ./users.json

# Update user "alice" role to "admin" and prompt for a new password
enstore-server user update alice --role admin --password --users ./users.json

# Delete user "alice"
enstore-server user delete alice --users ./users.json

# Manage roles
enstore-server user add-role editor read write --users ./users.json
enstore-server user update-role editor read write manageUsers --users ./users.json
enstore-server user delete-role editor --users ./users.json
```

---

## How User Management Works

Enstore stores users and roles in **`users.json`**. The file structure is:

```json
{
  "users": [
    {
      "username": "admin",
      "hashedPassword": "$2b$10$...",
      "role": "admin"
    }
  ],
  "roles": {
    "admin": ["read", "write", "manageUsers"],
    "read-write": ["read", "write"],
    "read-only": ["read"]
  }
}
```

- **`hashedPassword`** is the bcrypt hash of the user’s plaintext password.
- **`role`** references a key in `roles`.
- **`roles`** is a map of role names to an array of permission strings (`["read", "write", "manageUsers"]`, etc.).

**Local management**:
- Use `enstore-server user ...` subcommands to edit this file locally without starting the server.
- Once you start the server (`enstore-server start`), it uses the updated file for authentication & authorization.

---

## File Storage & Configuration

- **Uploads**: Files are stored on disk in the directory specified by `--uploads-dir`. The server provides endpoints to list, read, and write files within that directory.
- **Configuration**:
  - **Port** defaults to `3000`.
  - **`users.json`** path defaults to `~/.enstore/users.json` if not specified via `--users`.
  - **Uploads dir** defaults to `./uploads`.

---

**That’s it!** Now you can:
- Embed Enstore’s routes in your **own Express app**.
- Run the **CLI** (`enstore-server start`) to launch a standalone server.
- Manage users locally with `enstore-server user ...`.
- Or **pull** the Docker image `ghcr.io/ricsam/enstore-server:latest` and run it in a container.
