import React, { useState } from 'react';
import { Layers, Sparkles, Compass, Satellite, ExternalLink } from 'lucide-react';
import { DEFAULT_FIELD_PLOTS } from '../data/cropsAndFarms.ts';
import { NASA_FEED_EN, PLOT_TRANSLATIONS_EN } from '../i18n/translations.ts';
import type {
  EarthObservationFeedInfo,
  FieldPlot,
  Language,
  NasaTelemetryResponse,
  SoilProfile,
} from '../types/agrosmart.ts';

interface MonitoringConsoleProps {
  lang: Language;
  soil: SoilProfile;
  telemetry: NasaTelemetryResponse | null;
  loading: boolean;
  onOptimizeFromPlot: () => void;
}

type MapLayer = 'ndvi' | 'ndwi' | 'moisture' | 'lst' | 'srtm';
type ChartView = 'climate' | 'spectral';

const DEFAULT_FEED_SUMMARIES: EarthObservationFeedInfo[] = [
  {
    id: 'nasa-power',
    name: 'NASA POWER',
    agency: 'NASA Langley',
    resolution: 'Diário · Cabo Verde',
    parameters: 'Temperatura máx/mín, radiação solar, vento e umidade do ar',
    liveMetric: '26.4 °C (pico 32.8 °C)',
    whyChosenForCv:
      'Única fonte NASA com API diária direta nas 9 ilhas, suprindo a falta de estações locais em cada vale.',
    status: 'ativo',
    detail: 'Séries agroclimáticas diárias integradas para orientar o calendário agrícola de cada ilha.',
  },
  {
    id: 'smap',
    name: 'NASA SMAP',
    agency: 'NASA JPL / GSFC',
    resolution: '2–3 dias · Solo',
    parameters: 'Umidade superficial (0–5 cm) e reserva na zona das raízes',
    liveMetric: 'Sup. 42.0% · Raiz 44.8%',
    whyChosenForCv:
      'Indica se a terra ainda guarda humidade pós-chuvas ou entre regas gota-a-gota antes de semear.',
    status: 'ativo',
    detail: 'Identifica cedo a falta de água no solo para ajustar o sequeiro e a rega localizada.',
  },
  {
    id: 'gpm-imerg',
    name: 'NASA GPM & IMERG',
    agency: 'NASA / JAXA',
    resolution: 'Diário · Chuva',
    parameters: 'Chuva acumulada, confiabilidade das águas e enxurradas',
    liveMetric: '18.4 mm · 0 extremas',
    whyChosenForCv:
      'Em Cabo Verde a chuva concentra-se em poucos dias fortes; vigia a água útil e o risco de enxurrada.',
    status: 'ativo',
    detail: 'Monitoriza a confiabilidade das chuvas e dispara alerta acima de 40 mm/dia.',
  },
  {
    id: 'landsat-modis-viirs',
    name: 'NASA Landsat & MODIS/VIIRS',
    agency: 'NASA / USGS',
    resolution: '30 m (Landsat) · 250 m (VIIRS)',
    parameters: 'Vigor das plantas (NDVI) e estresse hídrico foliar (NDWI)',
    liveMetric: 'NDVI 0.54 · NDWI 0.02',
    whyChosenForCv:
      'Acompanha a cobertura verde entre a época das águas e a seca sem exigir visitas diárias ao terreno.',
    status: 'ativo',
    detail: 'Mapeia o vigor da vegetação por parcela e deteta solo exposto ao vento seco.',
  },
  {
    id: 'ecostress',
    name: 'NASA ECOSTRESS',
    agency: 'NASA JPL (ISS)',
    resolution: '70 m · Calor & ET',
    parameters: 'Temperatura da superfície do solo (LST) e evaporação (ET0)',
    liveMetric: 'Solo 29.1 °C · ET₀ 111 mm',
    whyChosenForCv:
      'Essencial para evitar queimadura térmica em hortícolas de regadio e calcular quando proteger o solo.',
    status: 'ativo',
    detail: 'Mede o aquecimento direto do solo descoberto e a perda diária de água nas ilhas.',
  },
  {
    id: 'srtm',
    name: 'NASA SRTM (Radar Topográfico)',
    agency: 'NASA / NGA',
    resolution: '30 m · Relevo',
    parameters: 'Altitude real e inclinação das encostas e socalcos',
    liveMetric: '320 m · Declive 5.4%',
    whyChosenForCv:
      'As ilhas têm relevo muito acidentado; o declive define onde exigir socalcos e culturas que seguram a terra.',
    status: 'ativo',
    detail: 'Orienta curvas de nível em Santo Antão, Santiago, Fogo, São Nicolau e Brava.',
  },
];

export const MonitoringConsole: React.FC<MonitoringConsoleProps> = ({
  lang,
  soil,
  telemetry,
  loading,
  onOptimizeFromPlot,
}) => {
  const [activeLayer, setActiveLayer] = useState<MapLayer>('ndvi');
  const [chartView, setChartView] = useState<ChartView>('climate');
  const [selectedPlot, setSelectedPlot] = useState<FieldPlot>(DEFAULT_FIELD_PLOTS[0]);
  const [cursorCoords, setCursorCoords] = useState<{ x: string; y: string } | null>(null);
  const [hoverDayIdx, setHoverDayIdx] = useState<number | null>(null);
  const isEn = lang === 'en';

  const summary = telemetry?.summary;
  const days = telemetry?.days ?? [];
  const feeds = telemetry?.earthObservationFeeds?.length
    ? telemetry.earthObservationFeeds
    : DEFAULT_FEED_SUMMARIES;

  const baseLat = telemetry?.latitude ?? 15.0528;
  const baseLon = telemetry?.longitude ?? -23.6056;
  const worldviewUrl = `https://worldview.earthdata.nasa.gov/?v=${(baseLon - 0.6).toFixed(2)},${(baseLat - 0.5).toFixed(2)},${(baseLon + 0.6).toFixed(2)},${(baseLat + 0.5).toFixed(2)}&l=Reference_Labels_15m,IMERG_Precipitation_Rate,VIIRS_SNPP_CorrectedReflectance_TrueColor`;

  const getPlotText = (plot: FieldPlot) => {
    if (!isEn) return { name: plot.name, currentCrop: plot.currentCrop };
    return PLOT_TRANSLATIONS_EN[plot.id] ?? { name: plot.name, currentCrop: plot.currentCrop };
  };

  const getPlotMetrics = (plot: FieldPlot) => {
    const baseMoist = summary?.avgTopsoilWetnessPct ?? 42;
    const baseRootMoist = summary?.avgRootZoneWetnessPct ?? 45;
    const baseNdvi = summary?.avgNdvi ?? 0.58;
    const baseNdwi = summary?.avgNdwi ?? 0.04;
    const baseLst = summary?.avgSurfaceTempC ?? 29.1;
    const baseSlope = summary?.srtmMeanSlopePct ?? plot.slopePct;
    const slope = Number((baseSlope * plot.erosionFactor).toFixed(1));
    const elevation = Math.round((summary?.srtmElevationM ?? 320) + (plot.erosionFactor - 0.8) * 35);
    const erosionBias = soil.erosionVulnerability === 'alta' ? 1.15 : 1.0;

    const moisture = Math.min(95, Math.max(12, baseMoist + plot.moistureOffsetPct));
    const rootZoneMoisture = Math.min(96, Math.max(15, baseRootMoist + plot.moistureOffsetPct * 0.7));
    const ndvi = Math.min(0.92, Math.max(0.18, baseNdvi + plot.ndviOffset));
    const ndwi = Math.min(0.55, Math.max(-0.35, baseNdwi + plot.moistureOffsetPct * 0.012));
    const surfaceTempC = Number((baseLst + plot.tempOffsetC).toFixed(1));
    const erosionRisk = Math.min(96, Math.max(10, Math.round(slope * 7.2 * erosionBias)));

    return { moisture, rootZoneMoisture, ndvi, ndwi, surfaceTempC, slope, elevation, erosionRisk };
  };

  const getPlotFillColor = (plot: FieldPlot): string => {
    const m = getPlotMetrics(plot);
    if (activeLayer === 'moisture') {
      if (m.moisture >= 50) return '#15803d';
      if (m.moisture >= 35) return '#0284c7';
      return '#d97706';
    }
    if (activeLayer === 'ndvi') {
      if (m.ndvi >= 0.64) return '#15803d';
      if (m.ndvi >= 0.45) return '#65a30d';
      return '#d97706';
    }
    if (activeLayer === 'ndwi') {
      if (m.ndwi >= 0.12) return '#0284c7';
      if (m.ndwi >= -0.05) return '#0f766e';
      return '#d97706';
    }
    if (activeLayer === 'lst') {
      if (m.surfaceTempC >= 33) return '#dc2626';
      if (m.surfaceTempC >= 29.5) return '#d97706';
      return '#15803d';
    }
    if (m.slope >= 8.5) return '#dc2626';
    if (m.slope >= 4.5) return '#d97706';
    return '#15803d';
  };

  const selectedMetrics = getPlotMetrics(selectedPlot);
  const selectedPlotText = getPlotText(selectedPlot);

  const chartW = 760;
  const chartH = 220;
  const padL = 44;
  const padR = 44;
  const padT = 20;
  const padB = 30;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const maxTempScale = Math.max(40, ...days.map((d) => d.tempMaxC + 2));
  const minTempScale = Math.min(10, ...days.map((d) => d.tempMinC - 2));
  const maxPrecipScale = Math.max(40, ...days.map((d) => d.precipitationMm * 1.15));

  const xForIdx = (i: number) =>
    days.length <= 1 ? padL : padL + (i / (days.length - 1)) * innerW;
  const yForTemp = (t: number) =>
    padT + innerH - ((t - minTempScale) / Math.max(1, maxTempScale - minTempScale)) * innerH;
  const yForMoisture = (m: number) => padT + innerH - (m / 100) * innerH;
  const yForNdvi = (v: number) => padT + innerH - (v / 1.0) * innerH;
  const hForPrecip = (p: number) => (p / maxPrecipScale) * (innerH * 0.75);

  const tempLinePath = days
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xForIdx(i).toFixed(1)} ${yForTemp(d.tempMaxC).toFixed(1)}`)
    .join(' ');
  const moistureLinePath = days
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xForIdx(i).toFixed(1)} ${yForMoisture(d.topsoilWetnessPct).toFixed(1)}`)
    .join(' ');
  const rootMoistureLinePath = days
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xForIdx(i).toFixed(1)} ${yForMoisture(d.rootZoneWetnessPct).toFixed(1)}`)
    .join(' ');
  const moistureAreaPath =
    days.length > 0
      ? `${moistureLinePath} L ${xForIdx(days.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${xForIdx(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
      : '';
  const ndviLinePath = days
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xForIdx(i).toFixed(1)} ${yForNdvi(d.ndviEstimate).toFixed(1)}`)
    .join(' ');
  const et0LinePath = days
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xForIdx(i).toFixed(1)} ${yForMoisture(d.et0Mm * 10).toFixed(1)}`)
    .join(' ');

  const hoveredDay = hoverDayIdx !== null ? days[hoverDayIdx] : null;

  return (
    <section id="monitoramento" className="pt-8 space-y-8">
      {/* Map + Plot Inspector */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-800" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-slate-950">
                {isEn
                  ? 'Field Plot Map (NASA Satellites & SRTM Terrain)'
                  : 'Mapa das Parcelas (Satélites NASA & Relevo SRTM)'}
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {isEn
                ? 'Click any plot to inspect plant vigor (Landsat/VIIRS), SMAP moisture, ECOSTRESS heat, and SRTM slope.'
                : 'Clique em uma parcela para ver vigor das plantas (Landsat/VIIRS), umidade SMAP, calor ECOSTRESS e declive SRTM.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'ndvi' as const, label: isEn ? 'Health (NDVI)' : 'Saúde (NDVI)' },
              { id: 'ndwi' as const, label: isEn ? 'Leaf Water' : 'Água na Folha' },
              { id: 'moisture' as const, label: isEn ? 'SMAP Soil' : 'Solo SMAP' },
              { id: 'lst' as const, label: isEn ? 'Heat (ECOSTRESS)' : 'Calor (ECOSTRESS)' },
              { id: 'srtm' as const, label: isEn ? 'Terrain (SRTM)' : 'Relevo (SRTM)' },
            ].map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => setActiveLayer(layer.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeLayer === layer.id
                    ? 'bg-white text-slate-950 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {layer.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5 items-stretch">
          <div className="lg:col-span-8 relative bg-[#08120E] rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between">
            <svg
              viewBox="0 0 600 350"
              className="w-full h-auto block cursor-crosshair select-none"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const rx = (e.clientX - rect.left) / rect.width;
                const ry = (e.clientY - rect.top) / rect.height;
                setCursorCoords({
                  x: (baseLat + (0.5 - ry) * 0.04).toFixed(4),
                  y: (baseLon + (rx - 0.5) * 0.04).toFixed(4),
                });
              }}
              onMouseLeave={() => setCursorCoords(null)}
            >
              <defs>
                <pattern id="agro-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="600" height="350" fill="url(#agro-grid)" />

              <path d="M 10 80 Q 200 40 590 105" fill="none" stroke="rgba(167, 243, 208, 0.16)" strokeWidth="1.2" />
              <path d="M 10 240 Q 300 200 590 265" fill="none" stroke="rgba(167, 243, 208, 0.16)" strokeWidth="1.2" />

              {DEFAULT_FIELD_PLOTS.map((plot) => {
                const isSelected = selectedPlot.id === plot.id;
                const fill = getPlotFillColor(plot);
                const m = getPlotMetrics(plot);
                const pText = getPlotText(plot);
                const valueText =
                  activeLayer === 'ndvi'
                    ? `${isEn ? 'Vigor' : 'Vigor'} ${m.ndvi.toFixed(2)}`
                    : activeLayer === 'ndwi'
                    ? isEn
                      ? `Leaf ${m.ndwi >= 0 ? 'Hydrated' : 'Dry'}`
                      : `Folha ${m.ndwi >= 0 ? 'Hidratada' : 'Seca'}`
                    : activeLayer === 'moisture'
                    ? `${isEn ? 'Soil' : 'Terra'} ${m.moisture.toFixed(0)}%`
                    : activeLayer === 'lst'
                    ? `${isEn ? 'Surface' : 'Solo'} ${m.surfaceTempC.toFixed(1)}°C`
                    : `${isEn ? 'Slope' : 'Declive'} ${m.slope}%`;

                return (
                  <g key={plot.id} onClick={() => setSelectedPlot(plot)} className="cursor-pointer">
                    <polygon
                      points={plot.svgPoints}
                      fill={fill}
                      fillOpacity={isSelected ? 0.56 : 0.32}
                      stroke={isSelected ? '#ffffff' : 'rgba(203, 213, 225, 0.65)'}
                      strokeWidth={isSelected ? 2.5 : 1.2}
                    />
                    <text
                      x={plot.labelX}
                      y={plot.labelY - 8}
                      textAnchor="middle"
                      className="fill-white text-[12px] font-semibold"
                      style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                    >
                      {plot.code} · {pText.name}
                    </text>
                    <text
                      x={plot.labelX}
                      y={plot.labelY + 12}
                      textAnchor="middle"
                      className="fill-emerald-100 text-[11px]"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {valueText}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="px-3.5 py-2.5 bg-[#060E0A] border-t border-emerald-950 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono tabular-nums text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                {cursorCoords
                  ? `LAT ${cursorCoords.x} · LON ${cursorCoords.y}`
                  : isEn
                  ? 'Click a plot to view satellite details'
                  : 'Clique numa parcela para ver os detalhes'}
              </span>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-emerald-700 inline-block rounded-[2px]" />
                  {isEn ? 'Good' : 'Bom'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-amber-600 inline-block rounded-[2px]" />
                  {isEn ? 'Watch' : 'Atenção'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-rose-600 inline-block rounded-[2px]" />
                  {isEn ? 'Critical' : 'Crítico'}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col justify-between bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="space-y-3">
              <div>
                <span className="text-xs font-mono text-slate-500">
                  {selectedPlot.code} · {selectedPlot.areaHa} ha · {isEn ? 'Elev.' : 'Alt.'} {selectedMetrics.elevation} m
                </span>
                <h3 className="font-display text-lg font-bold text-slate-950 mt-0.5">
                  {selectedPlotText.name}
                </h3>
                <p className="text-xs text-slate-600 mt-1">{selectedPlotText.currentCrop}</p>
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">
                    {isEn ? 'Vigor (Landsat / VIIRS)' : 'Vigor (Landsat / VIIRS)'}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-800 text-right">
                    {selectedMetrics.ndvi.toFixed(2)} (
                    {selectedMetrics.ndvi >= 0.6
                      ? isEn
                        ? 'Strong'
                        : 'Forte'
                      : isEn
                      ? 'Moderate'
                      : 'Moderado'}
                    )
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">
                    {isEn ? 'Leaf Water (NDWI)' : 'Água na Folha (NDWI)'}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 text-right">
                    {selectedMetrics.ndwi >= 0
                      ? isEn
                        ? 'Hydrated'
                        : 'Sem sede'
                      : isEn
                      ? 'Early stress'
                      : 'Seca inicial'}{' '}
                    ({selectedMetrics.ndwi.toFixed(2)})
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">
                    {isEn ? 'Soil Moisture (SMAP)' : 'Umidade Solo (SMAP)'}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 text-right">
                    {isEn ? 'Top' : 'Sup.'} {selectedMetrics.moisture.toFixed(0)}% ·{' '}
                    {isEn ? 'Root' : 'Raiz'} {selectedMetrics.rootZoneMoisture.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">
                    {isEn ? 'Surface Heat (ECOSTRESS)' : 'Calor do Solo (ECOSTRESS)'}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 text-right">
                    {selectedMetrics.surfaceTempC.toFixed(1)} °C
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">
                    {isEn ? 'Slope & Elevation (SRTM)' : 'Inclinação & Altitude (SRTM)'}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 text-right">
                    {selectedMetrics.slope.toFixed(1)}% · {selectedMetrics.elevation} m
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                {selectedMetrics.erosionRisk >= 55
                  ? isEn
                    ? 'Steep slope: plant along contour lines and keep trailing ground cover to prevent runoff.'
                    : 'Encosta íngreme: plante em curvas de nível e mantenha cobertura rasteira para evitar erosão.'
                  : isEn
                  ? 'Favorable terrain for rotating legumes, cereals, and mulched vegetables.'
                  : 'Terreno favorável para alternar culturas com leguminosas ou hortícolas protegidas.'}
              </p>
              <button
                type="button"
                onClick={onOptimizeFromPlot}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                {isEn ? 'Generate Planting Plan for this Plot' : 'Gerar Plano de Plantio para esta Parcela'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Multi-Channel Time Series */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h3 className="font-display text-base font-bold text-slate-950">
              {isEn
                ? `Climate & NASA Satellites — Last ${days.length || 30} Days`
                : `Clima & Satélites NASA dos Últimos ${days.length || 30} Dias`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {chartView === 'climate'
                ? isEn
                  ? 'GPM rain (blue bars), SMAP topsoil (green) & root moisture (dashed), POWER Max Temp (orange)'
                  : 'Chuva GPM (barras azuis), Umidade SMAP superficial (verde) e raiz (tracejado), Temp Máx POWER (laranja)'
                : isEn
                ? 'Landsat/VIIRS plant vigor (green) and POWER/ECOSTRESS evaporation (dashed)'
                : 'Vigor das plantas Landsat/VIIRS (verde) e Evaporação POWER/ECOSTRESS (tracejado)'}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setChartView('climate')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                chartView === 'climate'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isEn ? 'Rain, Heat & Soil' : 'Chuva, Calor e Solo'}
            </button>
            <button
              type="button"
              onClick={() => setChartView('spectral')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                chartView === 'spectral'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isEn ? 'Plants & Evaporation' : 'Plantas & Evaporação'}
            </button>
          </div>
        </div>

        {loading && days.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs font-mono text-slate-500">
            {isEn ? 'Querying NASA satellite feeds...' : 'Consultando dados dos satélites NASA...'}
          </div>
        ) : (
          <div className="relative mt-4">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full h-auto overflow-visible"
              onMouseLeave={() => setHoverDayIdx(null)}
            >
              <defs>
                <linearGradient id="moistureGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#15803d" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#15803d" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = padT + innerH * t;
                const rightVal =
                  chartView === 'climate' ? `${Math.round(100 * (1 - t))}%` : `${(1 - t).toFixed(2)}`;
                const leftVal =
                  chartView === 'climate'
                    ? `${Math.round(maxTempScale - t * (maxTempScale - minTempScale))}°`
                    : `${((1 - t) * 10).toFixed(1)}mm`;
                return (
                  <g key={t}>
                    <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                    <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-mono tabular-nums">
                      {leftVal}
                    </text>
                    <text x={chartW - padR + 8} y={y + 4} textAnchor="start" className="fill-slate-400 text-[10px] font-mono tabular-nums">
                      {rightVal}
                    </text>
                  </g>
                );
              })}

              {chartView === 'climate' ? (
                <>
                  {days.map((d, i) => {
                    const barH = hForPrecip(d.precipitationMm);
                    const barW = Math.max(4, innerW / Math.max(1, days.length) - 4);
                    const x = xForIdx(i) - barW / 2;
                    return (
                      <rect
                        key={d.date}
                        x={x}
                        y={padT + innerH - barH}
                        width={barW}
                        height={barH}
                        fill="#0284c7"
                        fillOpacity={0.35}
                        rx={1.5}
                      />
                    );
                  })}
                  {moistureAreaPath && <path d={moistureAreaPath} fill="url(#moistureGrad)" />}
                  <path d={moistureLinePath} fill="none" stroke="#15803d" strokeWidth="2.2" />
                  <path d={rootMoistureLinePath} fill="none" stroke="#0d9488" strokeWidth="1.7" strokeDasharray="4 3" />
                  <path d={tempLinePath} fill="none" stroke="#d97706" strokeWidth="2" />
                </>
              ) : (
                <>
                  <path d={ndviLinePath} fill="none" stroke="#15803d" strokeWidth="2.4" />
                  <path d={et0LinePath} fill="none" stroke="#0284c7" strokeWidth="2" strokeDasharray="4 3" />
                </>
              )}

              {days.map((d, i) => {
                const x = xForIdx(i);
                const sliceW = innerW / Math.max(1, days.length);
                return (
                  <rect
                    key={`hit-${d.date}`}
                    x={x - sliceW / 2}
                    y={padT}
                    width={sliceW}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHoverDayIdx(i)}
                  />
                );
              })}

              {hoverDayIdx !== null && days[hoverDayIdx] && (
                <line
                  x1={xForIdx(hoverDayIdx)}
                  y1={padT}
                  x2={xForIdx(hoverDayIdx)}
                  y2={padT + innerH}
                  stroke="#0f172a"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              )}

              {days
                .filter((_, i) => i === 0 || i === Math.floor(days.length / 2) || i === days.length - 1)
                .map((d) => {
                  const idx = days.indexOf(d);
                  return (
                    <text
                      key={`lbl-${d.date}`}
                      x={xForIdx(idx)}
                      y={chartH - 6}
                      textAnchor="middle"
                      className="fill-slate-500 text-[10px] font-mono tabular-nums"
                    >
                      {d.date}
                    </text>
                  );
                })}
            </svg>

            <div className="mt-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums text-slate-700">
              {hoveredDay ? (
                <>
                  <span className="font-semibold text-slate-900">{hoveredDay.date}</span>
                  <span>
                    {isEn ? 'Max' : 'Máx'}: {hoveredDay.tempMaxC.toFixed(1)} °C
                  </span>
                  <span>
                    {isEn ? 'Soil LST' : 'Solo LST'}: {hoveredDay.surfaceTempC.toFixed(1)} °C
                  </span>
                  <span>
                    {isEn ? 'GPM Rain' : 'Chuva GPM'}: {hoveredDay.precipitationMm.toFixed(1)} mm
                  </span>
                  <span>
                    {isEn ? 'SMAP Top/Root' : 'SMAP Sup/Raiz'}: {hoveredDay.topsoilWetnessPct.toFixed(0)}% /{' '}
                    {hoveredDay.rootZoneWetnessPct.toFixed(0)}%
                  </span>
                  <span>NDVI: {hoveredDay.ndviEstimate.toFixed(2)}</span>
                </>
              ) : (
                <span className="text-slate-500">
                  {isEn
                    ? 'Hover over the chart to inspect daily readings (NASA POWER, SMAP, GPM & ECOSTRESS).'
                    : 'Passe o mouse sobre o gráfico para ver os valores de cada dia (NASA POWER, SMAP, GPM e ECOSTRESS).'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 6 Focused NASA Missions Selected Exclusively for Cabo Verde */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Satellite className="w-4 h-4 text-emerald-800" aria-hidden="true" />
              <h3 className="font-display text-base font-bold text-slate-950">
                {isEn
                  ? 'Selected NASA Datasets for Cabo Verde (6 Core Missions)'
                  : 'Dados da NASA Escolhidos para Cabo Verde (6 Missões Essenciais)'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {isEn
                ? 'Focused exclusively on the 6 NASA missions that address Cabo Verde realities across all 9 islands (short rains, heat, steep slopes, and drip irrigation).'
                : 'Selecionámos apenas as 6 missões da NASA que respondem diretamente aos desafios das 9 ilhas (sequeiro curto, calor, encostas e regadio gota-a-gota).'}
            </p>
          </div>

          <a
            href={worldviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            {isEn
              ? 'Open NASA Worldview Imagery (IMERG & VIIRS)'
              : 'Abrir Imagem NASA Worldview (IMERG & VIIRS)'}
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {feeds.map((feed) => {
            const enFeed = isEn ? NASA_FEED_EN[feed.id] : null;
            return (
              <div
                key={feed.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between gap-2.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-950">{enFeed?.name ?? feed.name}</h4>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {feed.agency} · {enFeed?.resolution ?? feed.resolution}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-800 shrink-0">
                      {isEn ? 'Active' : 'Ativo'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 font-mono tabular-nums mt-2.5">
                    {feed.liveMetric}
                  </p>
                  <p className="text-xs text-slate-700 font-medium mt-1">
                    {enFeed?.parameters ?? feed.parameters}
                  </p>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-200/80">
                  <strong className="text-emerald-900">
                    {isEn ? 'Why in Cabo Verde:' : 'Porquê em Cabo Verde:'}
                  </strong>{' '}
                  {enFeed?.whyChosenForCv ?? feed.whyChosenForCv}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
