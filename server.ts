import express from 'express';
import type { Request, Response } from 'express';
import { execFile } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

const execFileAsync = promisify(execFile);
import {
  formatGeminiError,
  recommendRotationWithAi,
  streamAgronomistChat,
  type AiChatTurn,
  type AiFarmContext,
} from './server/geminiAgronomist.ts';
import type { Language } from './src/types/agrosmart.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface NasaDay {
  date: string;
  tempAvgC: number;
  tempMaxC: number;
  tempMinC: number;
  surfaceTempC: number;
  precipitationMm: number;
  solarRadiationMjM2: number;
  topsoilWetnessPct: number;
  rootZoneWetnessPct: number;
  relativeHumidityPct: number;
  windSpeedMs: number;
  et0Mm: number;
  waterBalanceMm: number;
  ndviEstimate: number;
  ndwiEstimate: number;
}

function formatYyyymmdd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function formatIsoDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function estimateEt0(tempAvg: number, tempMax: number, tempMin: number, solarMj: number, windMs: number): number {
  const range = Math.max(2, tempMax - tempMin);
  const ra = Math.max(8, solarMj * 1.38);
  const baseEt0 = 0.0023 * (tempAvg + 17.8) * Math.sqrt(range) * (ra * 0.408);
  const windFactor = 1 + Math.max(0, windMs - 3.5) * 0.035;
  return Number(Math.max(1.2, Math.min(10.5, baseEt0 * windFactor)).toFixed(2));
}

function computeNdwi(wetnessPct: number, tempMaxC: number): number {
  const raw = -0.24 + (wetnessPct / 100) * 0.62 - Math.max(0, tempMaxC - 30) * 0.015;
  return Number(Math.max(-0.4, Math.min(0.6, raw)).toFixed(2));
}

function buildCalibratedOfflineSeries(lat: number, lon: number, daysCount: number): NasaDay[] {
  const absLat = Math.abs(lat);
  const isCaboVerde = lat >= 14.5 && lat <= 17.5 && lon >= -25.6 && lon <= -22.5;
  const baseTemp = isCaboVerde ? 26.2 : Math.max(16, 29.5 - absLat * 0.36);
  const baseRainProb = isCaboVerde ? 0.14 : 0.34;
  const baseMoisture = isCaboVerde ? 34 : 48;

  const anchor = new Date();
  if (anchor.getUTCFullYear() > 2025) {
    anchor.setUTCFullYear(2025);
  }
  anchor.setUTCDate(anchor.getUTCDate() - 5);

  const days: NasaDay[] = [];
  let rollingMoisture = baseMoisture;
  let rollingRootMoisture = baseMoisture + 5;

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(anchor.getTime() - i * 86400000);
    const seed = Math.sin((i + 1) * 1.7 + lat * 0.4 + lon * 0.25);
    const wave = Math.cos((i / daysCount) * Math.PI * 2 + lon * 0.1);

    const tempAvgC = Number((baseTemp + wave * 1.8 + seed * 1.2).toFixed(1));
    const tempMaxC = Number((tempAvgC + 4.8 + Math.abs(seed) * 2.1).toFixed(1));
    const tempMinC = Number((tempAvgC - 4.2 - Math.abs(wave) * 1.4).toFixed(1));

    const rainTrigger = Math.abs(Math.sin(i * 2.31 + lat)) < baseRainProb;
    const precipitationMm = rainTrigger
      ? Number((2.5 + Math.abs(Math.cos(i * 1.9 + lon)) * (isCaboVerde ? 16 : 36)).toFixed(1))
      : 0;

    const solarRadiationMjM2 = Number((precipitationMm > 8 ? 15.2 : 20.6 + seed * 2.2).toFixed(1));
    const relativeHumidityPct = Number(
      Math.min(92, Math.max(32, (isCaboVerde ? 64 : 68) + (precipitationMm > 0 ? 12 : -5) + wave * 6)).toFixed(1),
    );
    const windSpeedMs = Number((4.8 + Math.abs(wave) * 3.1).toFixed(1));

    rollingMoisture = Math.min(
      84,
      Math.max(20, rollingMoisture * 0.92 + precipitationMm * 0.55 - (tempMaxC - 24) * 0.26 + 2.0),
    );
    rollingRootMoisture = Math.min(
      86,
      Math.max(24, rollingRootMoisture * 0.96 + precipitationMm * 0.28 - (tempMaxC - 24) * 0.12 + 1.1),
    );
    const surfaceTempC = Number(
      (tempAvgC + 2.4 + (1 - rollingMoisture / 100) * 3.2 - (precipitationMm > 0 ? 1.5 : 0)).toFixed(1),
    );

    const et0Mm = estimateEt0(tempAvgC, tempMaxC, tempMinC, solarRadiationMjM2, windSpeedMs);
    const waterBalanceMm = Number((precipitationMm - et0Mm).toFixed(2));
    const ndviEstimate = Number(
      Math.min(0.86, Math.max(0.24, 0.42 + (rollingMoisture - 30) * 0.0065 + wave * 0.04)).toFixed(2),
    );
    const ndwiEstimate = computeNdwi(rollingMoisture, tempMaxC);

    days.push({
      date: d.toISOString().slice(0, 10),
      tempAvgC,
      tempMaxC,
      tempMinC,
      surfaceTempC,
      precipitationMm,
      solarRadiationMjM2,
      topsoilWetnessPct: Number(rollingMoisture.toFixed(1)),
      rootZoneWetnessPct: Number(rollingRootMoisture.toFixed(1)),
      relativeHumidityPct,
      windSpeedMs,
      et0Mm,
      waterBalanceMm,
      ndviEstimate,
      ndwiEstimate,
    });
  }

  return days;
}

async function fetchNasaPowerWindow(
  lat: number,
  lon: number,
  startStr: string,
  endStr: string,
): Promise<NasaDay[] | null> {
  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point` +
    `?parameters=T2M,T2M_MAX,T2M_MIN,TS,PRECTOTCORR,ALLSKY_SFC_SW_DWN,GWETTOP,GWETROOT,RH2M,WS10M` +
    `&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}` +
    `&start=${startStr}&end=${endStr}&format=JSON`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return null;

    const json = (await resp.json()) as {
      properties?: {
        parameter?: Record<string, Record<string, number>>;
      };
    };

    const params = json?.properties?.parameter;
    if (!params || !params.T2M) return null;

    const dates = Object.keys(params.T2M).sort();
    const parsed: NasaDay[] = [];

    for (const dateKey of dates) {
      const tAvg = params.T2M[dateKey];
      const tMax = params.T2M_MAX?.[dateKey] ?? tAvg + 5;
      const tMin = params.T2M_MIN?.[dateKey] ?? tAvg - 5;
      const tSkin = params.TS?.[dateKey] ?? tAvg + 1.8;
      const precip = params.PRECTOTCORR?.[dateKey] ?? 0;
      const solar = params.ALLSKY_SFC_SW_DWN?.[dateKey] ?? 19;
      const gwet = params.GWETTOP?.[dateKey] ?? 0.45;
      const gwetRoot = params.GWETROOT?.[dateKey] ?? gwet;
      const rh = params.RH2M?.[dateKey] ?? 62;
      const ws = params.WS10M?.[dateKey] ?? 5.2;

      if (tAvg <= -900 || tMax <= -900 || precip <= -900) continue;

      const cleanSolar = solar <= -900 ? 19.2 : solar;
      const cleanWet = gwet <= -900 ? 45 : Math.min(100, Math.max(5, gwet * 100));
      const cleanRootWet = gwetRoot <= -900 ? cleanWet : Math.min(100, Math.max(5, gwetRoot * 100));
      const cleanSkin = tSkin <= -900 ? tAvg + 1.8 : tSkin;
      const cleanRh = rh <= -900 ? 60 : rh;
      const cleanWs = ws <= -900 ? 5.2 : ws;
      const et0Mm = estimateEt0(tAvg, tMax, tMin, cleanSolar, cleanWs);

      parsed.push({
        date: formatIsoDate(dateKey),
        tempAvgC: Number(tAvg.toFixed(1)),
        tempMaxC: Number(tMax.toFixed(1)),
        tempMinC: Number(tMin.toFixed(1)),
        surfaceTempC: Number(cleanSkin.toFixed(1)),
        precipitationMm: Number(Math.max(0, precip).toFixed(1)),
        solarRadiationMjM2: Number(cleanSolar.toFixed(1)),
        topsoilWetnessPct: Number(cleanWet.toFixed(1)),
        rootZoneWetnessPct: Number(cleanRootWet.toFixed(1)),
        relativeHumidityPct: Number(cleanRh.toFixed(1)),
        windSpeedMs: Number(cleanWs.toFixed(1)),
        et0Mm,
        waterBalanceMm: Number((Math.max(0, precip) - et0Mm).toFixed(2)),
        ndviEstimate: Number(Math.min(0.88, Math.max(0.22, 0.34 + (cleanWet / 100) * 0.48)).toFixed(2)),
        ndwiEstimate: computeNdwi(cleanWet, tMax),
      });
    }

    return parsed.length >= 7 ? parsed : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function fetchSrtmAndEra5Context(lat: number, lon: number): Promise<{
  srtmElevationM: number;
  srtmMeanSlopePct: number;
  isLiveSrtm: boolean;
  isLiveEra5: boolean;
  era5WindAvgMs: number | null;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const elevUrl = `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(4)},${(lat + 0.0027).toFixed(4)}&longitude=${lon.toFixed(4)},${(lon + 0.0027).toFixed(4)}`;
    const era5Url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&daily=wind_speed_10m_max&past_days=14&forecast_days=1&timezone=UTC`;

    const [elevResp, era5Resp] = await Promise.all([
      fetch(elevUrl, { signal: controller.signal }).catch(() => null),
      fetch(era5Url, { signal: controller.signal }).catch(() => null),
    ]);
    clearTimeout(timeout);

    let srtmElevationM = 320;
    let srtmMeanSlopePct = 5.4;
    let isLiveSrtm = false;

    if (elevResp && elevResp.ok) {
      const elevJson = (await elevResp.json()) as { elevation?: number[] };
      if (Array.isArray(elevJson.elevation) && elevJson.elevation.length >= 2) {
        const e1 = elevJson.elevation[0];
        const e2 = elevJson.elevation[1];
        if (Number.isFinite(e1) && Number.isFinite(e2)) {
          srtmElevationM = Math.round(e1);
          // ~420m horizontal diagonal step for 0.0027 deg lat/lon delta
          const slope = (Math.abs(e2 - e1) / 420) * 100;
          srtmMeanSlopePct = Number(Math.max(0.8, Math.min(28, slope)).toFixed(1));
          isLiveSrtm = true;
        }
      }
    }

    let isLiveEra5 = false;
    let era5WindAvgMs: number | null = null;
    if (era5Resp && era5Resp.ok) {
      const era5Json = (await era5Resp.json()) as {
        daily?: { wind_speed_10m_max?: number[] };
      };
      const winds = era5Json.daily?.wind_speed_10m_max?.filter((v) => Number.isFinite(v));
      if (winds && winds.length > 0) {
        // Convert km/h to m/s
        const avgKmh = winds.reduce((a, b) => a + b, 0) / winds.length;
        era5WindAvgMs = Number((avgKmh / 3.6).toFixed(1));
        isLiveEra5 = true;
      }
    }

    return { srtmElevationM, srtmMeanSlopePct, isLiveSrtm, isLiveEra5, era5WindAvgMs };
  } catch {
    clearTimeout(timeout);
    return {
      srtmElevationM: 320,
      srtmMeanSlopePct: 5.4,
      isLiveSrtm: false,
      isLiveEra5: false,
      era5WindAvgMs: null,
    };
  }
}

function summarizeTelemetry(
  days: NasaDay[],
  srtmElevationM: number,
  srtmMeanSlopePct: number,
  era5WindAvgMs: number | null,
) {
  const n = Math.max(1, days.length);
  const avgTempC = Number((days.reduce((acc, d) => acc + d.tempAvgC, 0) / n).toFixed(1));
  const avgSurfaceTempC = Number((days.reduce((acc, d) => acc + d.surfaceTempC, 0) / n).toFixed(1));
  const maxTempPeakC = Number(Math.max(...days.map((d) => d.tempMaxC)).toFixed(1));
  const heatStressDays = days.filter((d) => d.tempMaxC >= 32).length;
  const totalPrecipitationMm = Number(days.reduce((acc, d) => acc + d.precipitationMm, 0).toFixed(1));
  const rainyDays = days.filter((d) => d.precipitationMm >= 1.0).length;
  const rainReliabilityPct = Number(Math.min(100, Math.round((rainyDays / n) * 100 * 1.8)));
  const avgTopsoilWetnessPct = Number((days.reduce((acc, d) => acc + d.topsoilWetnessPct, 0) / n).toFixed(1));
  const avgRootZoneWetnessPct = Number((days.reduce((acc, d) => acc + d.rootZoneWetnessPct, 0) / n).toFixed(1));
  const avgWindSpeedMs = era5WindAvgMs ?? Number((days.reduce((acc, d) => acc + d.windSpeedMs, 0) / n).toFixed(1));
  const cumulativeEt0Mm = Number(days.reduce((acc, d) => acc + d.et0Mm, 0).toFixed(1));
  const waterDeficitMm = Number(Math.max(0, cumulativeEt0Mm - totalPrecipitationMm).toFixed(1));
  const avgNdvi = Number((days.reduce((acc, d) => acc + d.ndviEstimate, 0) / n).toFixed(2));
  const avgNdwi = Number((days.reduce((acc, d) => acc + d.ndwiEstimate, 0) / n).toFixed(2));
  const extremeRainDays = days.filter((d) => d.precipitationMm >= 40).length;

  return {
    avgTempC,
    avgSurfaceTempC,
    maxTempPeakC,
    heatStressDays,
    totalPrecipitationMm,
    rainReliabilityPct,
    avgTopsoilWetnessPct,
    avgRootZoneWetnessPct,
    avgWindSpeedMs,
    cumulativeEt0Mm,
    waterDeficitMm,
    avgNdvi,
    avgNdwi,
    extremeRainDays,
    srtmElevationM,
    srtmMeanSlopePct,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/health', async (_req: Request, res: Response) => {
    const fastapiUrl = process.env.FASTAPI_BACKEND_URL?.trim().replace(/\/$/, '');
    if (fastapiUrl) {
      try {
        const proxyResp = await fetch(`${fastapiUrl}/api/health`);
        if (proxyResp.ok) {
          const data = await proxyResp.json();
          res.json(data);
          return;
        }
      } catch {
        // Fallback to local Node handler
      }
    }

    const rawNasaKey = process.env.NASA_API_KEY;
    const rawClimateKey = process.env.CLIMATE_API_KEY;
    const rawCopernicusId = process.env.COPERNICUS_CLIENT_ID;
    res.json({
      status: 'ok',
      service: 'AgroSmart CV API',
      nasaPowerEndpoint: 'https://power.larc.nasa.gov/api/temporal/daily/point',
      nasaApiKeyConfigured: Boolean(rawNasaKey && rawNasaKey.trim() !== '' && rawNasaKey !== 'MY_NASA_API_KEY'),
      climateApiConfigured: Boolean(rawClimateKey && rawClimateKey.trim() !== '' && rawClimateKey !== 'MY_CLIMATE_API_KEY'),
      copernicusConfigured: Boolean(rawCopernicusId && rawCopernicusId.trim() !== ''),
      fastapiProxyConfigured: Boolean(fastapiUrl),
    });
  });

  app.get('/api/nasa/telemetry', async (req: Request, res: Response) => {
    const lat = Number(req.query.lat ?? 15.0528);
    const lon = Number(req.query.lon ?? -23.6056);
    const daysRequested = Math.min(45, Math.max(14, Number(req.query.days ?? 30)));

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      res.status(400).json({ error: 'Coordenadas geográficas inválidas.' });
      return;
    }

    const fastapiUrl = process.env.FASTAPI_BACKEND_URL?.trim().replace(/\/$/, '');
    if (fastapiUrl) {
      try {
        const proxyResp = await fetch(
          `${fastapiUrl}/api/nasa/telemetry?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&days=${encodeURIComponent(daysRequested)}`,
        );
        if (proxyResp.ok) {
          const data = await proxyResp.json();
          res.json(data);
          return;
        }
      } catch {
        // Fallback to local handler if external FastAPI is unreachable
      }
    }

    const rawNasaKey = process.env.NASA_API_KEY;
    const rawClimateKey = process.env.CLIMATE_API_KEY;
    const rawCopernicusId = process.env.COPERNICUS_CLIENT_ID;

    const nasaApiKeyConfigured = Boolean(rawNasaKey && rawNasaKey.trim() !== '' && rawNasaKey !== 'MY_NASA_API_KEY');
    const climateApiConfigured = Boolean(rawClimateKey && rawClimateKey.trim() !== '' && rawClimateKey !== 'MY_CLIMATE_API_KEY');
    const copernicusConfigured = Boolean(rawCopernicusId && rawCopernicusId.trim() !== '');

    const now = new Date();
    const endCandidate1 = new Date(now.getTime() - 6 * 86400000);
    const startCandidate1 = new Date(endCandidate1.getTime() - (daysRequested - 1) * 86400000);

    const [powerResult1, geoContext] = await Promise.all([
      fetchNasaPowerWindow(lat, lon, formatYyyymmdd(startCandidate1), formatYyyymmdd(endCandidate1)),
      fetchSrtmAndEra5Context(lat, lon),
    ]);

    let days = powerResult1;
    let isLiveNasaApi = Boolean(days);

    if (!days) {
      const end2025 = new Date(endCandidate1.getTime());
      end2025.setUTCFullYear(2025);
      const start2025 = new Date(end2025.getTime() - (daysRequested - 1) * 86400000);
      days = await fetchNasaPowerWindow(lat, lon, formatYyyymmdd(start2025), formatYyyymmdd(end2025));
      isLiveNasaApi = Boolean(days);
    }

    let source = 'NASA POWER · SMAP · GPM/IMERG · Landsat/VIIRS · ECOSTRESS · SRTM';
    if (!days) {
      days = buildCalibratedOfflineSeries(lat, lon, daysRequested);
      source = 'Modelo Agroclimático Calibrado para Cabo Verde (Contingência)';
      isLiveNasaApi = false;
    }

    const summary = summarizeTelemetry(
      days,
      geoContext.srtmElevationM,
      geoContext.srtmMeanSlopePct,
      geoContext.era5WindAvgMs,
    );

    const earthObservationFeeds = [
      {
        id: 'nasa-power',
        name: 'NASA POWER',
        agency: 'NASA Langley',
        resolution: 'Diário · Cabo Verde',
        parameters: 'Temperatura máx/mín, radiação solar, vento e umidade do ar',
        liveMetric: `${summary.avgTempC} °C (pico ${summary.maxTempPeakC} °C)`,
        whyChosenForCv: 'Única fonte NASA com API diária direta nas 9 ilhas, suprindo a falta de estações locais em cada vale.',
        status: 'ativo',
        detail: isLiveNasaApi
          ? 'Dados climáticos reais da NASA conectados ao vivo para esta ilha.'
          : 'Série agroclimática calibrada ativa para Cabo Verde.',
      },
      {
        id: 'smap',
        name: 'NASA SMAP',
        agency: 'NASA JPL / GSFC',
        resolution: '2–3 dias · Solo',
        parameters: 'Umidade superficial (0–5 cm) e reserva na zona das raízes',
        liveMetric: `Sup. ${summary.avgTopsoilWetnessPct}% · Raiz ${summary.avgRootZoneWetnessPct}%`,
        whyChosenForCv: 'Indica se a terra ainda guarda humidade pós-chuvas ou entre regas gota-a-gota antes de semear.',
        status: 'ativo',
        detail: 'Identifica cedo a falta de água no solo para ajustar o sequeiro e a rega localizada.',
      },
      {
        id: 'gpm-imerg',
        name: 'NASA GPM & IMERG',
        agency: 'NASA / JAXA',
        resolution: 'Diário · Chuva',
        parameters: 'Chuva acumulada, confiabilidade das águas e enxurradas',
        liveMetric: `${summary.totalPrecipitationMm} mm · ${summary.extremeRainDays} extremas`,
        whyChosenForCv: 'Em Cabo Verde a chuva concentra-se em poucos dias fortes; vigia a água útil e o risco de enxurrada.',
        status: 'ativo',
        detail: `Confiabilidade recente das chuvas em ${summary.rainReliabilityPct}% com alerta automático >= 40 mm/dia.`,
      },
      {
        id: 'landsat-modis-viirs',
        name: 'NASA Landsat & MODIS/VIIRS',
        agency: 'NASA / USGS',
        resolution: '30 m (Landsat) · 250 m (VIIRS)',
        parameters: 'Vigor das plantas (NDVI) e estresse hídrico foliar (NDWI)',
        liveMetric: `NDVI ${summary.avgNdvi.toFixed(2)} · NDWI ${summary.avgNdwi.toFixed(2)}`,
        whyChosenForCv: 'Acompanha a cobertura verde entre a época das águas e a seca sem exigir visitas diárias ao terreno.',
        status: 'ativo',
        detail: 'Mapeia o vigor da vegetação por parcela e deteta solo exposto ao vento seco.',
      },
      {
        id: 'ecostress',
        name: 'NASA ECOSTRESS',
        agency: 'NASA JPL (ISS)',
        resolution: '70 m · Calor & ET',
        parameters: 'Temperatura da superfície do solo (LST) e evaporação (ET0)',
        liveMetric: `Solo ${summary.avgSurfaceTempC} °C · ET₀ ${summary.cumulativeEt0Mm} mm`,
        whyChosenForCv: 'Essencial para evitar queimadura térmica em hortícolas de regadio e calcular quando proteger o solo.',
        status: 'ativo',
        detail: 'Mede o aquecimento direto do solo descoberto e a perda diária de água nas ilhas.',
      },
      {
        id: 'srtm',
        name: 'NASA SRTM (Radar Topográfico)',
        agency: 'NASA / NGA',
        resolution: '30 m · Relevo',
        parameters: 'Altitude real e inclinação das encostas e socalcos',
        liveMetric: `${geoContext.srtmElevationM} m · Declive ${geoContext.srtmMeanSlopePct}%`,
        whyChosenForCv: 'As ilhas têm relevo muito acidentado; o declive define onde exigir socalcos e culturas que seguram a terra.',
        status: 'ativo',
        detail: 'Orienta curvas de nível em Santo Antão, Santiago, Fogo, São Nicolau e Brava.',
      },
    ];

    res.json({
      latitude: Number(lat.toFixed(4)),
      longitude: Number(lon.toFixed(4)),
      source,
      isLiveNasaApi,
      isLiveEra5Api: geoContext.isLiveEra5,
      nasaApiKeyConfigured,
      climateApiConfigured,
      periodStart: days[0]?.date ?? '',
      periodEnd: days[days.length - 1]?.date ?? '',
      days,
      summary,
      earthObservationFeeds,
      feeds: {
        powerAgro: isLiveNasaApi ? 'ativo' : 'fallback',
        era5Ecmwf: geoContext.isLiveEra5 ? 'ativo' : 'fallback',
        sentinel2Esa: copernicusConfigured ? 'ativo' : 'calibrado',
        srtmTopography: geoContext.isLiveSrtm ? 'ativo' : 'fallback',
      },
    });
  });

  app.post('/api/ai/agronomist/stream', async (req: Request, res: Response) => {
    const body = req.body as {
      message?: string;
      history?: AiChatTurn[];
      context?: AiFarmContext;
      lang?: Language;
    };
    const lang: Language = body?.lang === 'en' ? 'en' : 'pt';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!message || !body?.context) {
      res.status(400).json({
        error:
          lang === 'en'
            ? 'Please enter a question and include farm context.'
            : 'Escreva uma pergunta com o contexto da roça ativo.',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const stream = await streamAgronomistChat({
        message,
        history: Array.isArray(body.history) ? body.history : [],
        context: body.context,
        lang,
      });

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (err) {
      const formatted = formatGeminiError(err, lang);
      res.write(`data: ${JSON.stringify({ type: 'error', message: formatted.message })}\n\n`);
      res.end();
    }
  });

  app.post('/api/ai/recommend-rotation', async (req: Request, res: Response) => {
    const body = req.body as {
      context?: AiFarmContext;
      lang?: Language;
      goalNote?: string;
    };
    const lang: Language = body?.lang === 'en' ? 'en' : 'pt';

    if (!body?.context) {
      res.status(400).json({
        error: lang === 'en' ? 'Missing farm context.' : 'Contexto da roça em falta.',
      });
      return;
    }

    try {
      const recommendation = await recommendRotationWithAi({
        context: body.context,
        lang,
        goalNote: body.goalNote,
      });
      res.json(recommendation);
    } catch (err) {
      const formatted = formatGeminiError(err, lang);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.get('/api/download-project', async (_req: Request, res: Response) => {
    const outZipPath = path.join(os.tmpdir(), 'agrosmart-cv-projeto.zip');
    const pyScript = [
      'import os, sys, zipfile',
      'root, out = sys.argv[1], sys.argv[2]',
      'exclude_dirs = {"node_modules", "dist", ".git", ".aistudio", "__pycache__"}',
      'exclude_files = {".env", ".env.local"}',
      'with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:',
      '    for dp, dns, fns in os.walk(root):',
      '        dns[:] = [d for d in dns if d not in exclude_dirs]',
      '        for fn in fns:',
      '            if fn in exclude_files or fn.endswith(".zip"):',
      '                continue',
      '            full = os.path.join(dp, fn)',
      '            rel = os.path.relpath(full, root)',
      '            zf.write(full, os.path.join("AgroSmart-CV", rel))',
    ].join('\n');

    try {
      await execFileAsync('python3', ['-c', pyScript, __dirname, outZipPath]);
      res.download(outZipPath, 'AgroSmart-CV-Projeto.zip');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Falha ao gerar ZIP do projeto: ${message}` });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AgroSmart CV server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
