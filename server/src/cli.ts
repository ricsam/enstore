#!/usr/bin/env bun
import { Command } from "commander";
import fs from "fs";
import path from "path";
import os from "os";
import express from "express";
import { createEnstoreMiddleware, EnstoreServerConfig } from "./enstore-middleware";

import { UserStore } from "./auth/user-store";
import bcrypt from "bcrypt";
import prompts from "prompts";

const program = new Command();

program
  .name("enstore-server")
  .description("CLI for EnStore Server")
  .version("1.0.0");

//-----------------------------------------------------
// 1) enstore-server start
//-----------------------------------------------------
const startCmd = new Command("start")
  .description("Start the EnStore server")
  .option("-p, --port <port>", "Port to listen on", "3000")
  .option(
    "-d, --uploads-dir <path>",
    "Directory for uploaded files",
    "./uploads",
  )
  .option("--users <path>", "Path to users.json", "")
  .action(async (options) => {
    const port = parseInt(options.port, 10) || 3000;
    const uploadsDirectory = options.uploadsDir || "./uploads";
    let userFilePath = options.users || "";

    if (!userFilePath) {
      // fallback to ~/.enstore/users.json if not specified
      const homeDir = os.homedir();
      const defaultDir = path.join(homeDir, ".enstore");
      if (!fs.existsSync(defaultDir)) {
        fs.mkdirSync(defaultDir, { recursive: true });
      }
      userFilePath = path.join(defaultDir, "users.json");
    }

    const config: EnstoreServerConfig = {
      uploadsDirectory,
      userFilePath,
    };

    if (!fs.existsSync(path.dirname(userFilePath))) {
      fs.mkdirSync(path.dirname(userFilePath), { recursive: true });
    }

    // Initialize Express server
    const app = express();
    app.use("/", createEnstoreMiddleware(config));

    const server = app.listen(port, () => {
      console.log(`EnStore server running on port ${port}`);
      console.log(`Using userFile: ${userFilePath}`);
      console.log(`Uploads directory: ${uploadsDirectory}`);
    });
    function shutdown() {
      console.log("\nCleaning up resources...");
      server.close(() => {
        console.log("HTTP server closed.");
        process.exit(0);
      });
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    process.on("exit", (code) => {
      console.log(`Process exiting with code ${code}`);
      console.log("Memory usage:", process.memoryUsage());
    });
  });

//-----------------------------------------------------
// 2) enstore-server user
//    Subcommands: add, update, delete
//-----------------------------------------------------

const userCmd = new Command("user")
  .description("Manage local users.json file without starting the server.")
  .option("--users <path>", "Path to users.json", "")
  .hook("preAction", (thisCommand, actionCommand) => {
    // We'll parse --users globally for subcommands.
  });

/**
 * Utility to load or create a local UserStore from CLI options or default path
 */
function loadLocalUserStore(): UserStore {
  let userFilePath = userCmd.opts().users || "";

  if (!userFilePath) {
    const homeDir = os.homedir();
    const defaultDir = path.join(homeDir, ".enstore");
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    userFilePath = path.join(defaultDir, "users.json");
  }

  if (!fs.existsSync(path.dirname(userFilePath))) {
    fs.mkdirSync(path.dirname(userFilePath), { recursive: true });
  }

  return new UserStore(userFilePath);
}

//---------------------------------------
// enstore-server user add <username> <role>
const userAddCmd = new Command("add")
  .description("Add a new user locally in users.json")
  .argument("<username>", "Username")
  .argument("<role>", "User Role")
  .option("--users <path>", "Path to users.json file")
  .action(async (username: string, role: string) => {
    const userStore = loadLocalUserStore();
    const response = await prompts({
      type: "password",
      name: "password",
      message: `Enter password for new user "${username}":`,
    });
    if (!response.password) {
      console.log("User creation cancelled.");
      return;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(response.password, saltRounds);

    userStore.addUser({
      username,
      hashedPassword,
      role,
    });

    console.log(
      `User "${username}" added locally to ${userStore["userFilePath"]}`,
    );
  });

//---------------------------------------
// enstore-server user update <username>
const userUpdateCmd = new Command("update")
  .description("Update an existing user in users.json")
  .argument("<username>", "Username to update")
  .option("--role <role>", "New role")
  .option("--password", "Prompt for new password")
  .option("--users <path>", "Path to users.json file")
  .action(async (username: string) => {
    const options = userUpdateCmd.opts();
    const userStore = loadLocalUserStore();
    const updatePayload: any = {};

    if (options.role) {
      updatePayload.role = options.role;
    }
    if (options.password) {
      const response = await prompts({
        type: "password",
        name: "password",
        message: `Enter new password for user "${username}":`,
      });
      if (response.password) {
        const saltRounds = 10;
        updatePayload.hashedPassword = await bcrypt.hash(
          response.password,
          saltRounds,
        );
      }
    }

    try {
      userStore.updateUser(username, updatePayload);
      console.log(`User "${username}" updated in ${userStore["userFilePath"]}`);
    } catch (err: any) {
      console.error("Error updating user:", err.message);
    }
  });

//---------------------------------------
// enstore-server user delete <username>
const userDeleteCmd = new Command("delete")
  .description("Remove a user from users.json")
  .argument("<username>", "Username to delete")
  .option("--users <path>", "Path to users.json file")
  .action((username: string, options) => {
    const userStore = loadLocalUserStore();
    try {
      userStore.removeUser(username);
      console.log(
        `User "${username}" deleted from ${userStore["userFilePath"]}`,
      );
    } catch (err: any) {
      console.error("Error deleting user:", err.message);
    }
  });

//---------------------------------------
// Role subcommands? If desired locally too:
const roleAddCmd = new Command("add-role")
  .description("Add a new role in users.json (or override existing one).")
  .argument("<role>", "Role name")
  .argument("[permissions...]", "Permissions array")
  .option("--users <path>", "Path to users.json file")
  .action((role: string, permissions: string[], options) => {
    const userStore = loadLocalUserStore();
    try {
      userStore.addRole(role, permissions);
      console.log(
        `Role "${role}" added with permissions [${permissions.join(", ")}].`,
      );
    } catch (err: any) {
      console.error("Error adding role:", err.message);
    }
  });

const roleUpdateCmd = new Command("update-role")
  .description("Update an existing role in users.json")
  .argument("<role>", "Role name")
  .argument("[permissions...]", "Permissions array")
  .option("--users <path>", "Path to users.json file")
  .action((role: string, permissions: string[], options) => {
    const userStore = loadLocalUserStore();
    try {
      userStore.updateRole(role, permissions);
      console.log(
        `Role "${role}" updated with permissions [${permissions.join(", ")}].`,
      );
    } catch (err: any) {
      console.error("Error updating role:", err.message);
    }
  });

const roleDeleteCmd = new Command("delete-role")
  .description("Delete a role from users.json")
  .argument("<role>", "Role name")
  .option("--users <path>", "Path to users.json file")
  .action((role: string, options) => {
    const userStore = loadLocalUserStore();
    try {
      userStore.removeRole(role);
      console.log(`Role "${role}" removed.`);
    } catch (err: any) {
      console.error("Error deleting role:", err.message);
    }
  });

//---------------------------------------
// Register subcommands to `user`
userCmd.addCommand(userAddCmd);
userCmd.addCommand(userUpdateCmd);
userCmd.addCommand(userDeleteCmd);

// If you want role subcommands under the same 'user' umbrella or separate 'role' command, up to you:
userCmd.addCommand(roleAddCmd);
userCmd.addCommand(roleUpdateCmd);
userCmd.addCommand(roleDeleteCmd);

//---------------------------------------
// Add main subcommands to program
program.addCommand(startCmd);
program.addCommand(userCmd);

//---------------------------------------
// Parse CLI
program.parseAsync(process.argv);
