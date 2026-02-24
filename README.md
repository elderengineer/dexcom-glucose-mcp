# dexcom-mcp

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for the [Dexcom API v3](https://developer.dexcom.com/docs/dexcomv3/endpoint-overview/), giving LLMs direct access to continuous glucose monitoring (CGM) data.

## Requirements

- Node.js 18+
- A Dexcom developer account with a registered application — [developer.dexcom.com](https://developer.dexcom.com)

## Installation

```bash
npm install
npm run build
```

---

## Step 1 — Obtain an OAuth Token

Dexcom uses the **Authorization Code** OAuth 2.0 flow. Run the included helper:

```bash
DEXCOM_CLIENT_ID=<your_client_id> \
DEXCOM_CLIENT_SECRET=<your_client_secret> \
npm run get-token
```

The script will:
1. Print an authorization URL — open it in your browser and log in with your Dexcom account
2. Start a local HTTP server on port `9005` to capture the OAuth redirect automatically
3. Exchange the auth code for tokens and **save all credentials to `~/.dexcom-mcp/credentials.yaml`** (mode `0600`)

**Output looks like:**
```
=== Credentials saved ===

Saved to: /home/you/.dexcom-mcp/credentials.yaml
Access token expires: 2/23/2026, 9:00:00 PM

The MCP server will load credentials automatically from that file.
Run "npm run get-token" again when the token expires to re-authenticate.
```

On subsequent runs, `DEXCOM_CLIENT_ID` and `DEXCOM_CLIENT_SECRET` are read from the saved credentials file, so you only need to provide them once:

```bash
npm run get-token   # re-authenticate with stored client credentials
```

**Environment variables for `get-token`:**

| Variable | Default | Description |
|---|---|---|
| `DEXCOM_CLIENT_ID` | _(from credentials file)_ | Your app's client ID — required on first run |
| `DEXCOM_CLIENT_SECRET` | _(from credentials file)_ | Your app's client secret — required on first run |
| `DEXCOM_REGION` | `us` | API region: `us`, `eu`, `jp`, or `sandbox` |
| `DEXCOM_PORT` | `9005` | Local port for the OAuth redirect listener |

> **Sandbox testing:** Use `DEXCOM_REGION=sandbox` with Dexcom sandbox credentials to test without a real device. See [Dexcom sandbox data](https://developer.dexcom.com/sandbox-data).

---

## Step 2 — Run the MCP Server

```bash
npm start
```

Credentials are loaded automatically from `~/.dexcom-mcp/credentials.yaml`. No environment variables needed after the first `get-token` run.

For development with live TypeScript compilation:

```bash
npm run dev
```

**Token expiry behaviour:**
- No expiry timestamp is stored — expiration is detected when the first API call returns a 401
- On any tool call with an expired or invalid token, the tool returns an error:
  > Your Dexcom access token is invalid or has expired. Re-authenticate by running: `npm run get-token`

**Optional environment variables (override the credentials file):**

| Variable | Description |
|---|---|
| `DEXCOM_ACCESS_TOKEN` | Override the stored access token |
| `DEXCOM_REGION` | Override the stored region |

The server communicates over **stdio** using the MCP protocol.

---

## MCP Client Configuration

Credentials are loaded automatically from `~/.dexcom-mcp/credentials.json`, so no environment variables are needed in the config:

```json
{
  "mcpServers": {
    "dexcom": {
      "command": "node",
      "args": ["/absolute/path/to/dexcom-mcp/dist/index.js"]
    }
  }
}
```

---

## Available Tools

### `get_data_range`
Returns the earliest and latest timestamps available for each data type.
**Call this first** to discover valid date ranges before querying other endpoints.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `lastSyncTime` | string (ISO 8601) | No | Only return data range info updated since this time |

---

### `get_egvs`
Estimated glucose values (sensor readings) with trend direction and rate.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `startDate` | string (ISO 8601) | Yes | Inclusive start, e.g. `2024-01-01T00:00:00` |
| `endDate` | string (ISO 8601) | Yes | Exclusive end. Max 30-day window. |

Response fields include: `value` (mg/dL or mmol/L), `trend` (`flat`, `singleUp`, `doubleDown`, etc.), `trendRate`, `status` (`ok`/`high`/`low`).

---

### `get_calibrations`
Blood glucose meter readings used to calibrate the sensor.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `startDate` | string (ISO 8601) | Yes | Inclusive start |
| `endDate` | string (ISO 8601) | Yes | Exclusive end. Max 30-day window. |

---

### `get_alerts`
CGM alert events fired by the device.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `startDate` | string (ISO 8601) | Yes | Inclusive start |
| `endDate` | string (ISO 8601) | Yes | Exclusive end. Max 30-day window. |

Alert names: `high`, `low`, `urgentLow`, `urgentLowSoon`, `rise`, `fall`, `outOfRange`, `noReadings`, `fixedLow`.
Alert states: `inactive`, `activeSnoozed`, `activeAlarming`.

---

### `get_events`
User-entered events logged in the Dexcom app.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `startDate` | string (ISO 8601) | Yes | Inclusive start |
| `endDate` | string (ISO 8601) | Yes | Exclusive end. Max 30-day window. |

Event types include: insulin, carbs, exercise, health, blood glucose, notes.

---

### `get_devices`
Devices associated with the authenticated user. No date parameters required.

Returns: `deviceId`, `deviceType`, `transmitterId`, `transmitterGeneration`, `displayDevice`, `activationDate`, `deactivationDate`.

---

## API Limits

- **Max query window:** 30 days per request (for date-range endpoints)
- **Rate limit:** 60,000 calls per app per hour (HTTP 429 if exceeded)
- **Token lifetime:** Access tokens expire after ~2 hours; use `DEXCOM_REFRESH_TOKEN` with `DexcomClient.refreshAccessToken()` to renew

## Supported Devices

G4, G5, G6, G6+, G7, Dexcom Pro

## Credentials File

All credentials are stored in `~/.dexcom-mcp/credentials.yaml` with permissions `0600` (owner read/write only):

```yaml
clientId: your_client_id
clientSecret: your_client_secret
region: us
accessToken: eyJ...
refreshToken: def...
```

Delete this file to fully log out.

## Project Structure

```
src/
├── index.ts       — MCP server (6 tools, stdio transport)
├── client.ts      — DexcomClient API wrapper + OAuth helpers
├── config.ts      — Credentials file read/write and expiry helpers
├── types.ts       — TypeScript types aligned with OpenAPI schema
└── get-token.ts   — OAuth Authorization Code flow CLI helper
```
