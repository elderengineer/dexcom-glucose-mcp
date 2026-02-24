import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DexcomClient, DexcomAuthError, type DexcomRegion } from "./client.js";
import { loadCredentials, CONFIG_FILE } from "./config.js";

// Load credentials: config file takes precedence; env var is a fallback
const storedCreds = loadCredentials();
const ACCESS_TOKEN = storedCreds?.accessToken ?? process.env.DEXCOM_ACCESS_TOKEN;
const REGION = (storedCreds?.region ?? process.env.DEXCOM_REGION ?? "us") as DexcomRegion;

if (!ACCESS_TOKEN) {
  console.error("No Dexcom credentials found.");
  console.error(`Run the following command to authenticate:\n`);
  console.error(
    `  DEXCOM_CLIENT_ID=<id> DEXCOM_CLIENT_SECRET=<secret> npm run get-token\n`
  );
  process.exit(1);
}

const client = new DexcomClient(ACCESS_TOKEN, REGION);

function handleError(error: unknown) {
  const text =
    error instanceof DexcomAuthError
      ? "Your Dexcom access token is invalid or has expired.\n\n" +
        "Re-authenticate by running:\n\n  npm run get-token\n\n" +
        `Credentials are saved to ${CONFIG_FILE}.`
      : `Error: ${(error as Error).message}`;

  return {
    content: [{ type: "text" as const, text }],
    isError: true,
  };
}

// Shared date range schema (max 30-day window per Dexcom API)
const dateRangeSchema = {
  startDate: z
    .string()
    .describe(
      "Start date/time in ISO 8601 UTC format (inclusive), e.g. 2024-01-01T00:00:00. Max 30-day window."
    ),
  endDate: z
    .string()
    .describe(
      "End date/time in ISO 8601 UTC format (exclusive), e.g. 2024-01-31T23:59:59. Max 30-day window."
    ),
};

const server = new McpServer({
  name: "dexcom-mcp",
  version: "1.0.0",
});

server.tool(
  "get_egvs",
  "Fetch estimated glucose values (EGVs) from a Dexcom CGM for a given time range. " +
    "Returns glucose readings with trend arrows (none/doubleUp/singleUp/fortyFiveUp/flat/fortyFiveDown/singleDown/doubleDown) " +
    "and trend rates in mg/dL/min. Max 30-day window.",
  dateRangeSchema,
  async ({ startDate, endDate }) => {
    try {
      const data = await client.getEgvs({ startDate, endDate });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "get_calibrations",
  "Fetch calibration entries from a Dexcom CGM for a given time range. " +
    "Returns blood glucose meter values used to calibrate the sensor. Max 30-day window.",
  dateRangeSchema,
  async ({ startDate, endDate }) => {
    try {
      const data = await client.getCalibrations({ startDate, endDate });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "get_alerts",
  "Fetch CGM alert events from a Dexcom device for a given time range. " +
    "Returns alerts (high/low/urgentLow/urgentLowSoon/rise/fall/outOfRange/noReadings/fixedLow) " +
    "with states: inactive, activeSnoozed, or activeAlarming. Max 30-day window.",
  dateRangeSchema,
  async ({ startDate, endDate }) => {
    try {
      const data = await client.getAlerts({ startDate, endDate });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "get_events",
  "Fetch user-entered events from a Dexcom device for a given time range. " +
    "Returns events such as insulin doses, carb intake, exercise, health events, and manual blood glucose readings. Max 30-day window.",
  dateRangeSchema,
  async ({ startDate, endDate }) => {
    try {
      const data = await client.getEvents({ startDate, endDate });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "get_devices",
  "Fetch a list of Dexcom devices associated with the authenticated user. " +
    "Returns device IDs, types, transmitter details, and activation/deactivation dates.",
  {},
  async () => {
    try {
      const data = await client.getDevices();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "get_data_range",
  "Fetch the available data timeframe for the authenticated Dexcom user. " +
    "Returns the earliest and latest timestamps available for EGVs, calibrations, and events. " +
    "Call this first to determine valid date ranges before querying other endpoints. " +
    "Optionally pass lastSyncTime (ISO 8601) to retrieve only data range info updated since that time.",
  {
    lastSyncTime: z
      .string()
      .optional()
      .describe("Optional ISO 8601 UTC timestamp to filter results updated since this time."),
  },
  async ({ lastSyncTime }) => {
    try {
      const data = await client.getDataRange(lastSyncTime);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return handleError(error);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Dexcom MCP server running on stdio");
