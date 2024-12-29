import { AuthHandler, CredentialsFile } from "@enstore/fs";
import axios from "axios";
import { Command } from "commander";
import FormData from "form-data";
import fs from "fs";
import prompts from "prompts";

/**
 * Save credentials to a file (default or override).
 */
function saveCredentials(
  filePath: string,
  endpoint: string,
  username: string,
  passwordPlain: string,
) {
  const base64Pass = Buffer.from(passwordPlain, "utf-8").toString("base64");
  const obj: CredentialsFile = {
    endpoint,
    username,
    encryptedPassword: base64Pass,
  };
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf-8");
}

/**
 * Merges environment variables on top of file-based credentials.
 * If requireAll=true and any essential piece is missing, exit(1).
 */
function resolveCredentials(): {
  endpoint: string;
  username: string;
  password: string;
} {
  const opts = program.opts();
  const credFilePath: string | undefined = opts.credentials;
  const fs = new AuthHandler({
    credentialsFilePath: credFilePath,
  });

  const { endpoint, username, password } = fs;

  return {
    endpoint,
    username,
    password,
  };
}

const program = new Command();
program
  .name("enstore")
  .description("Enstore CLI - interact with the Enstore server")
  .version("1.0.0")
  .option(
    "-c, --credentials <path>",
    "Path to credentials file (default: ~/.enstore/credentials.json)",
    "",
  );

/**
 * Subcommand: login <endpoint> <username>
 * Usage: enstore login https://example.com admin
 *   -> prompts for password
 *   -> saves { endpoint, username, encryptedPassword } to credentials file
 */
const loginCmd = new Command("login")
  .argument("<endpoint>", "Server endpoint URL (e.g. http://localhost:3000)")
  .argument("<username>", "Username to login")
  .description(
    "Store credentials (endpoint, username, encrypted password) in a credentials file",
  )
  .action(async (endpoint: string, username: string) => {
    const opts = program.opts();
    const credFilePath = new AuthHandler({
      credentialsFilePath: opts.credentials,
    }).getCredentialsFilePath();

    const response = await prompts({
      type: "password",
      name: "password",
      message: `Enter password for ${username}:`,
    });
    if (!response.password) {
      console.log("Login cancelled.");
      process.exit(0);
    }

    // Save credentials
    saveCredentials(credFilePath, endpoint, username, response.password);
    console.log(`Credentials saved for ${username} with endpoint: ${endpoint}`);
    console.log(`File location: ${credFilePath}`);
  });

/**
 * Helper functions to retrieve endpoint/auth header from loaded credentials
 */
function getEndpoint(): string {
  const { endpoint } = resolveCredentials();
  return endpoint;
}

// FILE COMMANDS: enstore ls [dir], enstore read <remotePath>, enstore write <localFile> [remoteDir]
const lsCmd = new Command("ls")
  .argument("[dir]", "Directory to list", "/")
  .description("List files in a directory")
  .action(async (dir: string) => {
    const credentials = resolveCredentials();
    const endpoint = credentials.endpoint;
    try {
      const resp = await axios.get(`${endpoint}/files/ls`, {
        params: { dir },
        auth: credentials,
      });
      console.log("Files:", resp.data.files);
    } catch (error: any) {
      console.error(
        "Error listing files:",
        error?.response?.data || error.message,
      );
    }
  });

const readCmd = new Command("read")
  .argument("<remotePath>", "Remote file path (relative to uploadDir root)")
  .description("Read a file content from Enstore")
  .action(async (remotePath: string) => {
    const credentials = resolveCredentials();
    const endpoint = credentials.endpoint;
    try {
      const resp = await axios.get(`${endpoint}/files/readFile`, {
        params: { path: remotePath },
        auth: credentials,
        responseType: "arraybuffer",
      });
      // Print file content to stdout
      process.stdout.write(Buffer.from(resp.data).toString("utf8"));
    } catch (error: any) {
      console.error(
        "Error reading file:",
        error?.response?.data || error.message,
      );
    }
  });

const writeCmd = new Command("write")
  .argument("<localFile>", "Local file path to upload")
  .argument("[remoteDir]", "Remote directory (relative to uploadDir root)", "/")
  .description("Upload/write a file to Enstore")
  .action(async (localFile: string, remoteDir: string) => {
    const credentials = resolveCredentials();

    if (!fs.existsSync(localFile)) {
      console.error(`Local file not found: ${localFile}`);
      process.exit(1);
    }

    const form = new FormData();
    form.append("file", fs.createReadStream(localFile));
    const queryPath = encodeURIComponent(remoteDir);

    try {
      const resp = await axios.post(
        `${credentials.endpoint}/files/writeFile?path=${queryPath}`,
        form,
        {
          auth: credentials,
          headers: {
            ...form.getHeaders(),
          },
        },
      );
      console.log("Upload response:", resp.data);
    } catch (error: any) {
      console.error(
        "Error uploading file:",
        error?.response?.data || error.message,
      );
    }
  });

// USER MANAGEMENT: enstore user add <username> <role>, update, delete
const userCmd = new Command("user");

const userAddCmd = new Command("add")
  .argument("<username>", "Username to add")
  .argument("<role>", "Role for the new user")
  .description("Add a new user (prompts for password)")
  .action(async (username: string, role: string) => {
    const credentials = resolveCredentials();

    const response = await prompts({
      type: "password",
      name: "password",
      message: `Enter password for new user "${username}":`,
    });
    if (!response.password) {
      console.log("User creation cancelled.");
      process.exit(0);
    }

    try {
      const resp = await axios.post(
        `${credentials.endpoint}/users`,
        {
          username,
          password: response.password,
          role,
        },
        {
          auth: credentials,
        },
      );
      console.log("User added:", resp.data.message);
    } catch (error: any) {
      console.error(
        "Error adding user:",
        error?.response?.data || error.message,
      );
    }
  });

const userUpdateCmd = new Command("update")
  .argument("<username>", "Username to update")
  .option("--role <role>", "New role for the user")
  .option("--password", "Prompt for new password")
  .description("Update a user (role or password)")
  .action(
    async (
      username: string,
      options: { role?: string; password?: boolean },
    ) => {
      const credentials = resolveCredentials();
      const endpoint = credentials.endpoint;

      const payload: any = {};
      if (options.role) {
        payload.role = options.role;
      }
      if (options.password) {
        const response = await prompts({
          type: "password",
          name: "password",
          message: `Enter new password for user "${username}":`,
        });
        if (response.password) {
          payload.password = response.password;
        }
      }

      try {
        const resp = await axios.patch(
          `${endpoint}/users/${username}`,
          payload,
          {
            auth: credentials,
          },
        );
        console.log("User updated:", resp.data.message);
      } catch (error: any) {
        console.error(
          "Error updating user:",
          error?.response?.data || error.message,
        );
      }
    },
  );

const userDeleteCmd = new Command("delete")
  .argument("<username>", "Username to delete")
  .description("Delete a user")
  .action(async (username: string) => {
    const credentials = resolveCredentials();
    const endpoint = credentials.endpoint;

    try {
      const resp = await axios.delete(`${endpoint}/users/${username}`, {
        auth: credentials,
      });
      console.log("User deleted:", resp.data.message);
    } catch (error: any) {
      console.error(
        "Error deleting user:",
        error?.response?.data || error.message,
      );
    }
  });

userCmd.addCommand(userAddCmd);
userCmd.addCommand(userUpdateCmd);
userCmd.addCommand(userDeleteCmd);

// ROLE MANAGEMENT: enstore role update <role> <permissions...>, delete <role>
const roleCmd = new Command("role");

const roleUpdateCmd = new Command("update")
  .argument("<role>", "Role name")
  .argument("<permissions...>", "Permissions array")
  .description("Add or update a role with specified permissions")
  .action(async (role: string, permissions: string[]) => {
    const credentials = resolveCredentials();
    const endpoint = credentials.endpoint;

    try {
      // POST /users/roles or PATCH /users/roles/:role, depending on your server logic
      // For example, let's use POST /users/roles as an "upsert"
      const resp = await axios.post(
        `${endpoint}/users/roles`,
        {
          role,
          permissions,
        },
        {
          auth: credentials,
        },
      );
      console.log("Role upserted:", resp.data.message);
    } catch (error: any) {
      console.error(
        "Error upserting role:",
        error?.response?.data || error.message,
      );
    }
  });

const roleDeleteCmd = new Command("delete")
  .argument("<role>", "Role name to remove")
  .description("Delete a role")
  .action(async (role: string) => {
    const credentials = resolveCredentials();
    const endpoint = credentials.endpoint;

    try {
      const resp = await axios.delete(`${endpoint}/users/roles/${role}`, {
        auth: credentials,
      });
      console.log("Role removed:", resp.data.message);
    } catch (error: any) {
      console.error(
        "Error deleting role:",
        error?.response?.data || error.message,
      );
    }
  });

roleCmd.addCommand(roleUpdateCmd);
roleCmd.addCommand(roleDeleteCmd);

// Register top-level commands
program.addCommand(loginCmd);
program.addCommand(lsCmd);
program.addCommand(readCmd);
program.addCommand(writeCmd);
program.addCommand(userCmd);
program.addCommand(roleCmd);

// Parse
program.parseAsync(process.argv);
