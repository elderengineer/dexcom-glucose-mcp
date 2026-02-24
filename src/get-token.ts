/**
 * CLI helper to obtain a Dexcom OAuth 2.0 access token.
 *
 * Dexcom uses the Authorization Code flow. This script:
 * 1. Prints the authorization URL for you to open in a browser
 * 2. Starts a local HTTP server to capture the redirect with the auth code
 * 3. Exchanges the auth code for access + refresh tokens
 * 4. Saves credentials to ~/.dexcom-mcp/credentials.yaml
 *
 * Usage:
 *   DEXCOM_CLIENT_ID=<id> DEXCOM_CLIENT_SECRET=<secret> npm run get-token
 *
 * Optional env vars:
 *   DEXCOM_REGION   - "us" (default) | "eu" | "jp" | "sandbox"
 *   DEXCOM_PORT     - local redirect port (default: 9005)
 */
import * as http from "http";
import { DexcomClient, type DexcomRegion } from "./client.js";
import { saveCredentials, CONFIG_FILE, loadCredentials } from "./config.js";

const REGION = (process.env.DEXCOM_REGION ?? "us") as DexcomRegion;
const PORT = parseInt(process.env.DEXCOM_PORT ?? "9005", 10);
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const AUTH_BASE_URLS: Record<DexcomRegion, string> = {
  us: "https://api.dexcom.com/v2/oauth2/login",
  eu: "https://api.dexcom.eu/v2/oauth2/login",
  jp: "https://api.dexcom.jp/v2/oauth2/login",
  sandbox: "https://sandbox-api.dexcom.com/v2/oauth2/login",
};

// Prefer env vars; fall back to stored credentials for client_id/secret
const storedCreds = loadCredentials();
const CLIENT_ID = process.env.DEXCOM_CLIENT_ID ?? storedCreds?.clientId;
const CLIENT_SECRET = process.env.DEXCOM_CLIENT_SECRET ?? storedCreds?.clientSecret;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Error: DEXCOM_CLIENT_ID and DEXCOM_CLIENT_SECRET are required.");
  console.error(
    "  Pass them as environment variables, or they will be loaded from a previous run saved in"
  );
  console.error(`  ${CONFIG_FILE}`);
  console.error("\nRegister your app at https://developer.dexcom.com to get credentials.");
  process.exit(1);
}

// Build the authorization URL
const authUrl = new URL(AUTH_BASE_URLS[REGION]);
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", "offline_access");

console.log("\n=== Dexcom OAuth Token Helper ===\n");
console.log("1. Open the following URL in your browser:\n");
console.log(`   ${authUrl.toString()}\n`);
console.log("2. Log in with your Dexcom account and authorize the app.");
console.log(`3. You will be redirected to localhost:${PORT} — this script will capture the code automatically.\n`);

// Start a local server to capture the redirect
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h2>Authorization failed: ${error ?? "no code received"}</h2><p>Check the terminal for details.</p>`);
    console.error(`\nAuthorization failed: ${error ?? "no code received"}`);
    server.close();
    process.exit(1);
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(
    "<h2>Authorization successful!</h2><p>You can close this tab and return to the terminal.</p>"
  );
  server.close();

  try {
    console.log("Exchanging authorization code for tokens...\n");
    const tokens = await DexcomClient.exchangeAuthCode(
      CLIENT_ID!,
      CLIENT_SECRET!,
      code,
      REDIRECT_URI,
      REGION
    );

    saveCredentials({
      clientId: CLIENT_ID!,
      clientSecret: CLIENT_SECRET!,
      region: REGION,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });

    console.log("=== Credentials saved ===\n");
    console.log(`Saved to: ${CONFIG_FILE}`);
    console.log(`\nThe MCP server will load credentials automatically from that file.`);
    console.log(`Run "npm run get-token" again when the token expires to re-authenticate.`);
  } catch (err) {
    console.error(`\nFailed to exchange token: ${(err as Error).message}`);
    process.exit(1);
  }
});

server.listen(PORT, "localhost", () => {
  console.log(`Waiting for OAuth callback on http://localhost:${PORT}/callback ...\n`);
});
