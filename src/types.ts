// Dexcom API v3 Types — aligned with OpenAPI schema
// https://raw.githubusercontent.com/rockybranches/dexcom-openapi-schema/main/openapi.json

export type TransmitterGeneration =
  | "unknown"
  | "g4"
  | "g5"
  | "g6"
  | "g6+"
  | "dexcomPro"
  | "g7";

export type DisplayDevice = string;

export type TrendArrow =
  | "none"
  | "unknown"
  | "doubleUp"
  | "singleUp"
  | "fortyFiveUp"
  | "flat"
  | "fortyFiveDown"
  | "singleDown"
  | "doubleDown"
  | "notComputable"
  | "rateOutOfRange";

export type AlertName =
  | "unknown"
  | "high"
  | "low"
  | "rise"
  | "fall"
  | "outOfRange"
  | "urgentLow"
  | "urgentLowSoon"
  | "noReadings"
  | "fixedLow";

export type AlertState =
  | "unknown"
  | "inactive"
  | "activeSnoozed"
  | "activeAlarming";

export type GlucoseUnit = "unknown" | "mg/dL" | "mmol/L";
export type RateUnit = "unknown" | "mg/dL/min" | "mmol/L/min";
export type EgvStatus = "unknown" | "high" | "low" | "ok";

// Common response wrapper (used by egvs, calibrations, alerts)
export interface DexcomResponse<T> {
  recordType: string;
  recordVersion: string;
  userId: string;
  records: T[];
}

// EGV record — GET /v3/users/self/egvs
export interface EgvRecord {
  recordId: string;
  systemTime: string;
  displayTime: string;
  transmitterId: string | null;
  transmitterTicks: number | null;
  value: number | null;
  status: EgvStatus | null;
  trend: TrendArrow | null;
  trendRate: number | null;
  unit: GlucoseUnit;
  rateUnit: RateUnit;
  displayDevice: DisplayDevice;
  transmitterGeneration: TransmitterGeneration;
}

export type EgvsResponse = DexcomResponse<EgvRecord>;

// Calibration record — GET /v3/users/self/calibrations
export interface CalibrationRecord {
  recordId: string;
  systemTime: string;
  displayTime: string;
  unit: GlucoseUnit;
  value: number;
  displayDevice: DisplayDevice;
  transmitterGeneration: TransmitterGeneration;
  transmitterId: string | null;
  transmitterTicks: number | null;
}

export type CalibrationsResponse = DexcomResponse<CalibrationRecord>;

// Alert record — GET /v3/users/self/alerts
// Note: no unit/value fields per schema
export interface AlertRecord {
  recordId: string;
  systemTime: string;
  displayTime: string;
  alertName: AlertName;
  alertState: AlertState;
  displayDevice: DisplayDevice;
  transmitterGeneration: TransmitterGeneration;
  transmitterId: string | null;
}

export type AlertsResponse = DexcomResponse<AlertRecord>;

// Event record — GET /v3/users/self/events
// Schema returns a plain array (no DexcomResponse wrapper)
export interface EventRecord {
  eventId: string;
  eventType: string;
  systemTime: string;
  displayTime: string;
  value: string | number | null;
  unit: string | null;
  transmitterId: string | null;
  transmitterGeneration: string | null;
  displayDevice: string | null;
}

// Device record — GET /v3/users/self/devices
// Schema returns a plain array (no DexcomResponse wrapper)
export interface DeviceRecord {
  deviceId: string;
  deviceType: string;
  transmitterGeneration: TransmitterGeneration | null;
  transmitterId: string | null;
  displayDevice: string | null;
  activationDate: string;
  deactivationDate: string | null;
}

// DataRange response — GET /v3/users/self/dataRange
export interface DataRangeMoment {
  systemTime: string;
  displayTime: string;
}

export interface DateRange {
  start: DataRangeMoment | null;
  end: DataRangeMoment | null;
}

export interface DataRangeResponse {
  recordType: string;
  recordVersion: string;
  userId: string;
  calibrations: DateRange;
  egvs: DateRange;
  events: DateRange;
}

// OAuth token response — POST /v2/oauth2/token
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}
