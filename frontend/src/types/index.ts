export type ThreatLevel = "NO_DANGER" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RiskLevel = ThreatLevel;

export interface SimulationInput {
  tide_level_meters: number;
  rainfall_mm_per_hour: number;
  forecast_hours: number;
  wind_speed_kmh?: number;
  cyclone_active?: boolean;
  soil_saturation?: number;
}

export interface DriverItem {
  factor_key: string;
  factor_name: string;
  contribution_pct: number;
  raw_value?: number;
}

export interface FacilityItem {
  name: string;
  type: string;
  elevation_meters: number;
  capacity: number;
  status: string;
}

export interface RoadItem {
  name: string;
  elevation_meters: number;
  status: string;
  depth_over_road_m?: number;
}

export interface EnhancedZoneResult {
  zone_id: string;
  zone_name: string;
  state: string;
  region: string;
  elevation_meters: number;
  population: number;
  dist_to_coast_km: floatNumber;
  dist_to_river_km: floatNumber;
  drainage_capacity_pct: number;
  latitude: number;
  longitude: number;

  // ML Predictions
  flood_probability: number;
  is_flooded: boolean;
  projected_depth_meters: number;
  onset_time_minutes: number;
  peak_time_minutes: number;
  threat_level: ThreatLevel;

  // Explainable AI (XAI)
  primary_drivers: DriverItem[];
  plain_language_explanation: string;

  // Decision & Infrastructure Impact
  priority_score: number;
  evacuation_priority_rank: number;
  threatened_facilities: FacilityItem[];
  safe_shelters: FacilityItem[];
  submerged_roads: RoadItem[];
  passable_roads: RoadItem[];
  recommended_action: string;

  // Alert SMS Text
  alert_headline: string;
  sms_text: string;
}

type floatNumber = number;

export interface AIValidationMetrics {
  roc_auc: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  depth_mae_meters: number;
  depth_r2: number;
  onset_time_mae_minutes: number;
  peak_time_mae_minutes: number;
}

export interface SimulationResponse {
  threat_index: number;
  overall_risk: ThreatLevel;
  simulation_params: SimulationInput;
  estimated_inundated_area_sq_km: number;
  total_population_at_risk: number;
  critical_zones_count: number;
  zones: EnhancedZoneResult[];
  recommendation: string;
  ai_validation_metrics?: AIValidationMetrics | Record<string, any>;
}

export interface SITREPRankedZone {
  rank: number;
  zone_name: string;
  threat_level: ThreatLevel | string;
  depth_m: number;
  onset_min: number;
  action: string;
}

export interface SITREPReport {
  incident_name: string;
  report_type: string;
  timestamp: string;
  weather_condition: string;
  telemetry: {
    astronomical_tide_surge_m: number;
    peak_rainfall_intensity_mm_h: number;
    cyclonic_surge_active: boolean;
  };
  impact_assessment: {
    total_zones_evaluated: number;
    critical_zones_count: number;
    total_population_at_risk: number;
    estimated_inundation_area_sq_km: number;
  };
  executive_summary: string;
  tactical_directives: string[];
  ranked_zone_overview: SITREPRankedZone[];
}

export interface PriorityQueueItem {
  rank: number;
  zone_id: string;
  zone_name: string;
  state: string;
  threat_level: ThreatLevel;
  priority_score: number;
  projected_depth_meters: number;
  onset_time_minutes: number;
  peak_time_minutes: number;
  affected_population: number;
  threatened_facilities: FacilityItem[];
  safe_shelters: FacilityItem[];
  submerged_roads: RoadItem[];
  recommended_action: string;
  sms_alert: string;
}

export interface PriorityQueueResponse {
  total_zones: number;
  overall_threat: ThreatLevel;
  priority_queue: PriorityQueueItem[];
}

export interface EmergencyAlert {
  id: string;
  zone_id: string;
  zone_name: string;
  severity: "info" | "warning" | "danger" | "critical" | string;
  title: string;
  message: string;
  timestamp: string;
  evacuation_recommended: boolean;
  recommended_shelter_ids?: string[];
}

export interface BroadcastRequest {
  zone_ids: string[];
  alert_title: string;
  alert_message: string;
  target_channels?: string[];
}

export interface BroadcastResponse {
  status: string;
  broadcast_id: string;
  sent_timestamp: string;
  recipient_count: number;
  zones_notified: string[];
}

// Backwards compatibility aliases
export interface FloodZone {
  id: string;
  name: string;
  location: string;
  elevationMeters: number;
  riskLevel: ThreatLevel;
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

// Elevation Safety & Terrain Types
export interface ElevationSafetyProperties {
  classification: "danger" | "neutral" | "safe";
  relative_percentile: number;
  relative_elevation_percentile: number;
  elevation_min_m: number;
  elevation_max_m: number;
  elevation_mean_m: number;
  area_m2: number;
  area_km2: number;
  color: string;
}

export interface ElevationSafetyFeature {
  type: "Feature";
  properties: ElevationSafetyProperties;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

export interface ElevationSafetyCollection {
  type: "FeatureCollection";
  features: ElevationSafetyFeature[];
  metadata: Record<string, any>;
}

export interface MapOverlaysState {
  dem: boolean;
  hillshade: boolean;
  elevationSafety: boolean;
  depthContours: boolean;
  evacuationRoutes: boolean;
  shelters: boolean;
  drains: boolean;
}

// India-Wide Baseline & Hotspot Types
export interface IndiaBaselineProperties {
  classification: "safer" | "neutral" | "susceptible";
  terrain_score: number;
  flow_accumulation_rank: number;
  elevation_m: number;
  color: string;
  region: string;
}

export interface IndiaBaselineFeature {
  type: "Feature";
  properties: IndiaBaselineProperties;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

export interface IndiaBaselineCollection {
  type: "FeatureCollection";
  features: IndiaBaselineFeature[];
  metadata: Record<string, any>;
}

export interface IndiaHotspotProperties {
  classification: "high_risk" | "moderate_risk" | "low_risk";
  hotspot_score: number;
  terrain_susceptibility: number;
  rainfall_score: number;
  elevation_m: number;
  rainfall_mm_hr: number;
  color: string;
  region: string;
}

export interface IndiaHotspotFeature {
  type: "Feature";
  properties: IndiaHotspotProperties;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

export interface IndiaHotspotCollection {
  type: "FeatureCollection";
  features: IndiaHotspotFeature[];
  metadata: Record<string, any>;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  message: string;
  zone_id?: string;
  user_role?: "civilian" | "commander" | "engineer";
  conversation_history?: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  threat_level: string;
  target_zone: string;
  grounded_facts?: Record<string, any>;
  tools_invoked: string[];
  suggested_actions: string[];
  referenced_zones: string[];
}

// --- GeoJSON Spatial Layers ---
export interface GeoJSONGeometry {
  type: "Point" | "LineString" | "Polygon" | "MultiPolygon";
  coordinates: any;
}

export interface GeoJSONFeature<P = Record<string, any>> {
  type: "Feature";
  properties: P;
  geometry: GeoJSONGeometry;
}

export interface GeoJSONFeatureCollection<P = Record<string, any>> {
  type: "FeatureCollection";
  name?: string;
  features: GeoJSONFeature<P>[];
}

export interface HistoricFloodProperties {
  flood_id: string;
  event_name: string;
  state: string;
  district: string;
  waterbody: string;
  year: number;
  start_date: string;
  end_date: string;
  affected_area_sq_km: number;
  peak_depth_meters: number;
  primary_cause: string;
  return_period_years: number;
  fatalities: number;
  economic_damage_usd_m: number;
  center: [number, number];
}

export interface InfrastructureProperties {
  id: string;
  name: string;
  category: "HOSPITAL" | "BRIDGE" | "POWER_SUBSTATION" | "SHELTER";
  zone_id: string;
  zone_name: string;
  state: string;
  ground_elevation_m: number;
  risk_tier: "CRITICAL_LOWLAND" | "VULNERABLE_LOWLAND" | "MODERATE_BUFFER" | "SAFE_HIGHLAND";
  capacity?: number;
  flood_cutoff_depth_m?: number;
  clearance_m?: number | null;
}

export interface SubmersibleRoadProperties {
  id: string;
  name: string;
  road_type: string;
  zone_id: string;
  flood_cutoff_depth_m: number;
}

export interface MapLayersBundle {
  historic_floods: GeoJSONFeatureCollection<HistoricFloodProperties>;
  vulnerable_infrastructure: GeoJSONFeatureCollection<InfrastructureProperties>;
  safe_shelters: GeoJSONFeatureCollection<InfrastructureProperties>;
  submersible_roads: GeoJSONFeatureCollection<SubmersibleRoadProperties>;
  summary: {
    total_historic_events: number;
    total_critical_infrastructure: number;
    total_safe_shelters: number;
    total_submersible_roads: number;
    elevation_source: string;
  };
}
