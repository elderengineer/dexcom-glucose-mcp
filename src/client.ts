import type {
  AlertsResponse,
  CalibrationsResponse,
  DataRangeResponse,
  DeviceRecord,
  EventRecord,
  EgvsResponse,
  TokenResponse,
} from "./types.js";

export type DexcomRegion = "us" | "eu" | "jp" | "sandbox";

export class DexcomAuthError extends Error {
  constructor() {
    super(
      "Dexcom access token is invalid or expired. " +
        "Re-authenticate by running:\n\n  npm run get-token"
    );
    this.name = "DexcomAuthError";
  }
}

const BASE_URLS: Record<DexcomRegion, string> = {
  us: "https://api.dexcom.com",
  eu: "https://api.dexcom.eu",
  jp: "https://api.dexcom.jp",
  sandbox: "https://sandbox-api.dexcom.com",
};

const AUTH_URLS: Record<DexcomRegion, string> = {
  us: "https://api.dexcom.com/v2/oauth2/token",
  eu: "https://api.dexcom.eu/v2/oauth2/token",
  jp: "https://api.dexcom.jp/v2/oauth2/token",
  sandbox: "https://sandbox-api.dexcom.com/v2/oauth2/token",
};

export interface DateRangeParams extends Record<string, string> {
  startDate: string;
  endDate: string;
}

export class DexcomClient {
  private accessToken: string;
  private baseUrl: string;

  constructor(accessToken: string, region: DexcomRegion = "us") {
    this.accessToken = accessToken;
    this.baseUrl = BASE_URLS[region];
  }

  static async exchangeAuthCode(
    clientId: string,
    clientSecret: string,
    authCode: string,
    redirectUri: string,
    region: DexcomRegion = "us"
  ): Promise<TokenResponse> {
    const url = AUTH_URLS[region];
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: authCode,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${text}`);
    }

    return response.json() as Promise<TokenResponse>;
  }

  static async refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
    redirectUri: string,
    region: DexcomRegion = "us"
  ): Promise<TokenResponse> {
    const url = AUTH_URLS[region];
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token refresh failed (${response.status}): ${text}`);
    }

    return response.json() as Promise<TokenResponse>;
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      throw new DexcomAuthError();
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Dexcom API error (${response.status}): ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async getEgvs(params: DateRangeParams): Promise<EgvsResponse> {
    return this.get<EgvsResponse>("/v3/users/self/egvs", params);
  }

  async getCalibrations(params: DateRangeParams): Promise<CalibrationsResponse> {
    return this.get<CalibrationsResponse>("/v3/users/self/calibrations", params);
  }

  async getAlerts(params: DateRangeParams): Promise<AlertsResponse> {
    return this.get<AlertsResponse>("/v3/users/self/alerts", params);
  }

  // Returns a plain array per the schema (no DexcomResponse wrapper)
  async getEvents(params: DateRangeParams): Promise<EventRecord[]> {
    return this.get<EventRecord[]>("/v3/users/self/events", params);
  }

  // No date params per the schema
  async getDevices(): Promise<DeviceRecord[]> {
    return this.get<DeviceRecord[]>("/v3/users/self/devices");
  }

  // lastSyncTime is optional per the schema
  async getDataRange(lastSyncTime?: string): Promise<DataRangeResponse> {
    const params = lastSyncTime ? { lastSyncTime } : undefined;
    return this.get<DataRangeResponse>("/v3/users/self/dataRange", params);
  }
}
