export type Language = 'pt' | 'en';

export type SoilTexture = 'argiloso' | 'franco-argiloso' | 'franco-arenoso' | 'arenoso';

export interface SoilProfile {
  texture: SoilTexture;
  organicMatterPct: number; // % MO (1.0 - 6.0)
  ph: number; // 4.5 - 8.0
  waterRetentionCapacity: number; // mm/m (60 - 210)
  nitrogenResidualKgHa: number; // kg/ha
  erosionVulnerability: 'baixa' | 'media' | 'alta';
}

export interface FarmerPriorities {
  waterConservation: number; // 1 - 10
  soilHealthCarbon: number; // 1 - 10
  yieldStability: number; // 1 - 10
  climateResilience: number; // 1 - 10
}

export interface FarmLocation {
  id: string;
  name: string;
  zoneLabel?: string;
  region: string;
  archipelagoGroup: 'Barlavento' | 'Sotavento';
  biome: string;
  latitude: number;
  longitude: number;
  areaHa: number;
  elevationM: number;
  imageUrl: string;
  imageAlt: string;
  defaultSoil: SoilProfile;
}

export interface NasaTelemetryDay {
  date: string; // YYYY-MM-DD
  tempAvgC: number;
  tempMaxC: number;
  tempMinC: number;
  surfaceTempC: number; // LST (NASA TS / ECOSTRESS)
  precipitationMm: number; // GPM / IMERG merged
  solarRadiationMjM2: number;
  topsoilWetnessPct: number; // SMAP 0-5cm (0 - 100)
  rootZoneWetnessPct: number; // SMAP/GLDAS root zone (0 - 100)
  relativeHumidityPct: number;
  windSpeedMs: number; // ERA5 10m wind speed
  et0Mm: number; // Reference evapotranspiration
  waterBalanceMm: number;
  ndviEstimate: number; // Sentinel-2 / Landsat / MODIS-VIIRS NDVI
  ndwiEstimate: number; // Sentinel-2 NDWI
}

export interface NasaTelemetrySummary {
  avgTempC: number;
  avgSurfaceTempC: number; // ECOSTRESS / TS mean LST
  maxTempPeakC: number;
  heatStressDays: number; // Days >= 32C
  totalPrecipitationMm: number;
  rainReliabilityPct: number; // GPM/IMERG precipitation distribution reliability
  avgTopsoilWetnessPct: number;
  avgRootZoneWetnessPct: number; // SMAP/GLDAS root zone average
  avgWindSpeedMs: number;
  cumulativeEt0Mm: number;
  waterDeficitMm: number;
  avgNdvi: number;
  avgNdwi: number;
  extremeRainDays: number; // Days >= 40mm
  srtmElevationM: number;
  srtmMeanSlopePct: number;
}

export type EarthObservationFeedId =
  | 'nasa-power'
  | 'smap'
  | 'gpm-imerg'
  | 'landsat-modis-viirs'
  | 'ecostress'
  | 'srtm';

export interface EarthObservationFeedInfo {
  id: EarthObservationFeedId;
  name: string;
  agency: string;
  resolution: string;
  parameters: string;
  liveMetric: string;
  whyChosenForCv: string;
  status: 'ativo' | 'integracao_pronta';
  detail: string;
}

export interface NasaTelemetryResponse {
  latitude: number;
  longitude: number;
  source: string;
  isLiveNasaApi: boolean;
  isLiveEra5Api: boolean;
  nasaApiKeyConfigured: boolean;
  climateApiConfigured: boolean;
  periodStart: string;
  periodEnd: string;
  days: NasaTelemetryDay[];
  summary: NasaTelemetrySummary;
  earthObservationFeeds: EarthObservationFeedInfo[];
  feeds: {
    powerAgro: 'ativo' | 'fallback';
    era5Ecmwf: 'ativo' | 'fallback';
    sentinel2Esa: 'calibrado' | 'ativo';
    srtmTopography: 'ativo' | 'fallback';
  };
}

export type CropCategory =
  | 'leguminosa'
  | 'graminea'
  | 'cobertura'
  | 'oleaginosa'
  | 'horticola'
  | 'fruticultura';

export type IrrigationSystem = 'sequeiro' | 'regadio' | 'misto';

export interface CropSpecies {
  id: string;
  name: string;
  scientificName: string;
  category: CropCategory;
  irrigationMode: 'sequeiro' | 'regadio' | 'ambos';
  family: string;
  cycleDays: number;
  waterDemandMm: number;
  nitrogenBalanceKgHa: number; // positive = fixes N, negative = consumes N
  organicCarbonContributionTHa: number;
  rootDepthCm: number;
  maxOptimalTempC: number;
  droughtTolerance: number; // 0 - 100
  erosionProtection: number; // 0 - 100
  recommendedSeason: 'verao' | 'outono_inverno' | 'entressafra';
  agronomicNote: string;
}

export interface RotationSeasonSlot {
  seasonIndex: number;
  label: string;
  periodLabel: string;
  cropId: string;
}

export interface RotationSimulationResult {
  sequence: CropSpecies[];
  totalWaterDemandMm: number;
  waterSavedVsBaselinePct: number;
  waterSavedMm: number;
  netNitrogenKgHa: number;
  soilCarbonDeltaTHa: number;
  avgErosionProtection: number;
  droughtResilienceIndex: number;
  heatAdaptationScore: number;
  radarAxes: {
    label: string;
    currentValue: number;
    baselineValue: number;
  }[];
  monthlyProjection: {
    monthLabel: string;
    optimizedSoilHealth: number;
    baselineSoilHealth: number;
    optimizedMoistureRetention: number;
    baselineMoistureRetention: number;
  }[];
  seasonBreakdown: {
    seasonLabel: string;
    cropName: string;
    family: string;
    waterDemandMm: number;
    nitrogenDeltaKgHa: number;
    carbonDeltaTHa: number;
    climateRisk: 'baixo' | 'moderado' | 'elevado';
  }[];
}

export type AlertSeverity = 'critico' | 'atencao' | 'informativo';
export type AlertMetric = 'topsoilWetnessPct' | 'maxTempPeakC' | 'waterDeficitMm' | 'extremeRainDays';

export interface AlertRule {
  id: string;
  title: string;
  metric: AlertMetric;
  operator: 'lt' | 'gt';
  threshold: number;
  unit: string;
  severity: AlertSeverity;
  enabled: boolean;
  recommendation: string;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  title: string;
  severity: AlertSeverity;
  metricLabel: string;
  observedValue: string;
  thresholdLabel: string;
  timestamp: string;
  recommendation: string;
  status: 'ativo' | 'reconhecido' | 'resolvido';
}

export interface FieldPlot {
  id: string;
  code: string;
  name: string;
  areaHa: number;
  slopePct: number;
  currentCrop: string;
  moistureOffsetPct: number;
  ndviOffset: number;
  tempOffsetC: number;
  erosionFactor: number;
  svgPoints: string;
  labelX: number;
  labelY: number;
}
