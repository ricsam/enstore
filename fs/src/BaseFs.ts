import path from "path";
import { AuthFs } from "./AuthFs";

export interface AuthFsConfig {
  endpoint?: string;
  username?: string;
  password?: string;
  credentialsFilePath?: string;
}

export interface EnstoreFsConfig extends AuthFsConfig {
  rootDirectory: string;
}

export class BaseFs extends AuthFs {
  protected rootDirectory: string;

  constructor(config: EnstoreFsConfig & { rootDirectory: string }) {
    super(config);
    // 1) Use provided config
    let { rootDirectory } = config;
    if (!rootDirectory) {
      throw new Error(`"rootDirectory" is required in EnstoreFsConfig`);
    }

    this.rootDirectory = path.resolve(rootDirectory);
  }

  /**
   * Maps a local absolute path to the corresponding EnStore server path.
   * If rootDirectory = "/var/logs" and localPath = "/var/logs/nginx/access.log",
   * then the remote path is "/nginx/access.log".
   */
  protected resolveRemotePath(localPath: string): string {
    const resolvedLocal = path.resolve(localPath);

    if (!resolvedLocal.startsWith(this.rootDirectory)) {
      throw new Error(
        `Path ${localPath} is outside the rootDirectory ${this.rootDirectory}`,
      );
    }

    // Extract the portion after rootDirectory
    const relative = path.relative(this.rootDirectory, resolvedLocal);

    // Prepend leading slash for the remote path
    return `/${relative.replace(/\\/g, "/")}`; // ensure forward slashes on Windows
  }
}
