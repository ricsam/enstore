# @enstore/cli

**`@enstore/cli`** is a command-line tool to interact with an [EnStore](https://github.com/ricsam/enstore) server for:

1. **File Operations**:  
   - `ls` (list files)  
   - `read` (read file contents)  
   - `write` (upload/write file)  

2. **User Management**:  
   - `user add`, `user update`, `user delete`  

3. **Role Management**:  
   - `role update`, `role delete`  

All commands require **three** connection parameters: **`endpoint`**, **`username`**, and **`password`**. These credentials are loaded from `~/.enstore/credentials.json` by **default**, or from an alternate file path specified by `-c/--credentials`. They can also be overridden by environment variables `ENSTORE_ENDPOINT`, `ENSTORE_USERNAME`, and `ENSTORE_PASSWORD`.

---

## Installation

```bash
npm install -g @enstore/cli
```

This installs the `enstore` command globally.

---

## Credentials Setup

### 1. Login

To **store** credentials (endpoint, username, password) in your local file:

```bash
enstore login <endpoint> <username>
# e.g.
enstore login http://localhost:3000 admin
```

- **Prompts** for password, then saves it as Base64-encoded in `~/.enstore/credentials.json` by default.  
- If you want a custom file location, use the global `-c/--credentials <path>` option:

```bash
enstore -c ./dev-credentials.json login http://localhost:3000 devUser
```

**This `credentials.json`** contains:
```json
{
  "endpoint": "http://localhost:3000",
  "username": "admin",
  "encryptedPassword": "base64encodedsecret"
}
```

### 2. Overriding via Environment Variables

Any of the **endpoint**, **username**, or **password** can be overridden by environment variables:
```bash
export ENSTORE_ENDPOINT="https://my-server"
export ENSTORE_USERNAME="alice"
export ENSTORE_PASSWORD="mypassword"
enstore ls /some/directory
```

If **any** required credential is missing (and is not overridden), the CLI will refuse to proceed (except for `login`).

---

## Usage

**All commands** accept a global **`-c, --credentials <path>`** option to **override** the default credentials file path. If **none** is provided, it defaults to `~/.enstore/credentials.json`.

### **1) Login**

```bash
enstore login <endpoint> <username>
```
Prompts for password, saves credentials to the local file (`~/.enstore/credentials.json` by default).

### **2) List Files (`ls`)**

```bash
enstore ls [dir]
# Defaults to "/" if 'dir' is not specified
```

Lists files in `[dir]` on the EnStore server. Uses loaded credentials to make an authorized request.

### **3) Read File (`read`)**

```bash
enstore read <remotePath>
```

Reads the content of `<remotePath>` from the server and prints it to **stdout**.

### **4) Write (Upload) File (`write`)**

```bash
enstore write <localFile> [remoteDir]
# remoteDir defaults to "/"
```

Uploads `<localFile>` to the server at `<remoteDir>`.  
For example:
```bash
enstore write ./mydoc.txt /docs
```
This places `mydoc.txt` under the server’s uploads root at `/docs/mydoc.txt`.

---

## User Management

The **`user`** subcommand manages **users** on the server.

### **Add User**

```bash
enstore user add <username> <role>
```
Prompts for password, sends a request to `POST /users`.

### **Update User**

```bash
enstore user update <username> [--role <role>] [--password]
```
- `--role <role>` sets a new role (e.g., `admin`, `read-only`, etc.).
- `--password` prompts for a new password.

### **Delete User**

```bash
enstore user delete <username>
```
Removes the user from the server.

---

## Role Management

The **`role`** subcommand manages roles.

### **Update (Add or Overwrite) a Role**

```bash
enstore role update <role> <permissions...>
```
Sends the specified permissions array to the server. e.g.
```bash
enstore role update editor read write manageUsers
```

### **Delete Role**

```bash
enstore role delete <role>
```
Removes the role from the server.

---

## Examples

```bash
# 1. Login & Save Credentials
enstore login http://localhost:3000 admin
# => prompts for password
# => stores { endpoint, username, encryptedPassword }

# 2. Basic File Operations
enstore ls /
enstore read /readme.txt
enstore write ~/Downloads/test.pdf /docs

# 3. User Management
enstore user add bob read-write
enstore user update bob --role read-only --password
enstore user delete bob

# 4. Role Management
enstore role update dev read write
enstore role delete dev

# 5. Using a Custom Credentials File
enstore -c ./dev-creds.json login http://staging.local:3000 devUser
enstore -c ./dev-creds.json ls /staging
```

---

## Credentials File Priority

1. **Command-line `-c/--credentials <path>`**: If provided, credentials are loaded/saved there.
2. If `-c` is not specified, it defaults to **`~/.enstore/credentials.json`**.
3. **Environment Variables** (`ENSTORE_ENDPOINT`, `ENSTORE_USERNAME`, `ENSTORE_PASSWORD`) **override** whatever is in the file.

---

## Troubleshooting

- **Missing credentials**: If you haven’t run `enstore login ...` or set environment variables, file operations will fail.  
- **Network errors**: Make sure the endpoint is reachable and the server is running.  
- **Permissions**: If your user’s role doesn’t include `"read"` or `"write"`, some endpoints may return HTTP 403 forbidden.  
