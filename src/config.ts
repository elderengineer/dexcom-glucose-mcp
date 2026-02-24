import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as yaml from "js-yaml";

export const CONFIG_DIR = path.join(os.homedir(), ".dexcom-mcp");
export const CONFIG_FILE = path.join(CONFIG_DIR, "credentials.yaml");

export interface Credentials {
  clientId: string;
  clientSecret: string;
  region: string;
  accessToken: string;
  refreshToken: string;
}

export function loadCredentials(): Credentials | null {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return yaml.load(raw) as Credentials;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: Credentials): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, yaml.dump(creds), {
    encoding: "utf-8",
    mode: 0o600, // owner read/write only
  });
}
