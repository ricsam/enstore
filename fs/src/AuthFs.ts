import fs from "fs";
import path from "path";
import os from "os";

export interface AuthFsConfig {
  endpoint?: string;
  username?: string;
  password?: string;
  credentialsFilePath?: string;
}

export interface CredentialsFile {
  endpoint: string;
  username: string;
  encryptedPassword: string; // base64
}

export class AuthFs {
  public endpoint: string;
  public username: string;
  public password: string;
  private credentialsFilePath?: string;

  constructor(config: AuthFsConfig) {
    // 1) Use provided config
    let { endpoint, username, password, credentialsFilePath } = config;

    this.credentialsFilePath = credentialsFilePath;

    // 2) If not provided in config, fallback to env
    if (!endpoint) endpoint = process.env.ENSTORE_ENDPOINT;
    if (!username) username = process.env.ENSTORE_USERNAME;
    if (!password) password = process.env.ENSTORE_PASSWORD;

    // 3) If still missing, load from credentials file
    if (!endpoint || !username || !password) {
      const loaded = this.loadCredentialsFromFile();
      endpoint = endpoint || loaded.endpoint;
      username = username || loaded.username;
      password = password || loaded.password;
    }

    if (!endpoint || !username || !password) {
      throw new Error(
        `Missing Enstore credentials (endpoint, username, password).`,
      );
    }

    this.endpoint = endpoint;
    this.username = username;
    this.password = password;
  }

  /**
   * Load credentials from ~/.enstore/credentials.json or a custom path.
   */
  private loadCredentialsFromFile(): {
    endpoint: string;
    username: string;
    password: string;
  } {
    let credFilePath = this.getCredentialsFilePath();

    if (!fs.existsSync(credFilePath)) {
      return { endpoint: "", username: "", password: "" };
    }

    try {
      const data = JSON.parse(
        fs.readFileSync(credFilePath, "utf-8"),
      ) as CredentialsFile;
      const endpoint = data.endpoint;
      const username = data.username;
      const password = Buffer.from(data.encryptedPassword, "base64").toString(
        "utf-8",
      );
      return { endpoint, username, password };
    } catch {
      return { endpoint: "", username: "", password: "" };
    }
  }

  public getCredentialsFilePath(): string {
    const overridePath = this.credentialsFilePath;
    if (overridePath && overridePath.trim() !== "") {
      return path.resolve(overridePath);
    }
    // default to ~/.enstore/credentials.json
    const dir = path.join(os.homedir(), ".enstore");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, "credentials.json");
  }
}
