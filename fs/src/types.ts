import { EnstoreCredentials } from "./auth-handler";


export interface EnstoreFsOptions extends EnstoreCredentials {
  pathPrefix?: string;
}
