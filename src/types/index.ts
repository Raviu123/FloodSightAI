export type RiskLevel = "NO_DANGER" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface FloodZone {
  id: string;
  name: string;
  location: string;
  elevationMeters: number;
  riskLevel: RiskLevel;
  predictedPeakTime: string;
  affectedPopulation: number;
  waterLevelMeters: number;
}

export interface SimulationParams {
  tideLevelMeters: number;
  rainfallMmPerHour: number;
  timeHours: number;
  cycloneActive: boolean;
  windSpeedKmh: number;
}

export interface AlertNotification {
  id: string;
  zoneId: string;
  zoneName: string;
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  timestamp: string;
  evacuationRecommended: boolean;
}

export interface QuickMetric {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  status?: "normal" | "warning" | "danger";
}
