import React, { useState } from 'react';
import {
  Compass,
  Droplets,
  MapPin,
  Mountain,
  Satellite,
  Sparkles,
  ThermometerSun,
} from 'lucide-react';
import { FARM_BIOME_EN } from '../i18n/translations.ts';
import type { FarmLocation, Language, NasaTelemetryResponse } from '../types/agrosmart.ts';

interface HeroOverviewProps {
  lang: Language;
  farms: FarmLocation[];
  selectedFarm: FarmLocation;
  onSelectFarm: (farm: FarmLocation) => void;
  telemetry: NasaTelemetryResponse | null;
  loading: boolean;
}

// Project Cabo Verde lat/lon cleanly onto a 460x300 SVG canvas
function projectCoord(lat: number, lon: number) {
  const minLon = -25.45;
  const maxLon = -22.55;
  const minLat = 14.65;
  const maxLat = 17.35;
  const x = 32 + ((lon - minLon) / (maxLon - minLon)) * 396;
  const y = 268 - ((lat - minLat) / (maxLat - minLat)) * 236;
  return { x, y };
}

const ISLAND_SHAPES: Record<string, string> = {
  'santo-antao-cv': 'M -20,-8 L -6,-15 L 14,-11 L 19,-1 L 9,10 L -11,13 L -22,3 Z',
  'sao-vicente-cv': 'M -12,-7 L 2,-10 L 12,-4 L 9,7 L -4,9 L -13,2 Z',
  'sao-nicolau-cv': 'M -16,-5 L 4,-9 L 17,-2 L 13,6 L -3,8 L -15,3 Z',
  'sal-cv': 'M -6,-14 L 5,-13 L 7,2 L 4,14 L -5,12 L -7,-1 Z',
  'boa-vista-cv': 'M -14,-11 L 6,-13 L 15,-2 L 11,12 L -6,13 L -15,2 Z',
  'maio-cv': 'M -7,-12 L 6,-10 L 8,4 L 2,13 L -7,9 Z',
  'santiago-cv': 'M -12,-18 L 6,-19 L 16,-4 L 13,15 L -3,19 L -15,6 Z',
  'fogo-cv': 'M -11,-11 L 4,-13 L 13,-2 L 9,11 L -5,12 L -12,1 Z',
  'brava-cv': 'M -8,-7 L 4,-8 L 8,1 L 3,8 L -7,6 Z',
};

const LABEL_OFFSETS: Record<string, { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }> = {
  'santo-antao-cv': { dx: 0, dy: -21, anchor: 'middle' },
  'sao-vicente-cv': { dx: -16, dy: 20, anchor: 'end' },
  'sao-nicolau-cv': { dx: 0, dy: 20, anchor: 'middle' },
  'sal-cv': { dx: 14, dy: 4, anchor: 'start' },
  'boa-vista-cv': { dx: 0, dy: 24, anchor: 'middle' },
  'maio-cv': { dx: 14, dy: 4, anchor: 'start' },
  'santiago-cv': { dx: 16, dy: 24, anchor: 'start' },
  'fogo-cv': { dx: 0, dy: -19, anchor: 'middle' },
  'brava-cv': { dx: -12, dy: 14, anchor: 'end' },
};

export const HeroOverview: React.FC<HeroOverviewProps> = ({
  lang,
  farms,
  selectedFarm,
  onSelectFarm,
  telemetry,
  loading,
}) => {
  const [failedFarmId, setFailedFarmId] = useState<string | null>(null);
  const summary = telemetry?.summary;
  const heroImgFailed = failedFarmId === selectedFarm.id;
  const isEn = lang === 'en';

  const islandRepresentatives = farms.filter(
    (farm, index, arr) => arr.findIndex((f) => f.region === farm.region) === index,
  );
  const barlaventoFarms = islandRepresentatives.filter((f) => f.archipelagoGroup === 'Barlavento');
  const sotaventoFarms = islandRepresentatives.filter((f) => f.archipelagoGroup === 'Sotavento');
  const zonesForSelectedIsland = farms.filter((f) => f.region === selectedFarm.region);

  const selectedRegion = isEn
    ? FARM_BIOME_EN[selectedFarm.id]?.region ?? selectedFarm.region
    : selectedFarm.region;
  const selectedBiome = isEn
    ? FARM_BIOME_EN[selectedFarm.id]?.biome ?? selectedFarm.biome
    : selectedFarm.biome;

  const getPlainAdvice = () => {
    if (!summary) {
      return isEn
        ? 'Reading climate and terrain data for your island...'
        : 'A ler o clima e o terreno da sua ilha...';
    }
    const isDry = summary.waterDeficitMm > 30;
    const isSteep = summary.srtmMeanSlopePct >= 6;
    if (isDry && isSteep) {
      return isEn
        ? 'Dry spell on steep slopes: for rainfed plots use Pigeon Pea or Sorghum; for irrigated plots use drip irrigation with straw mulch.'
        : 'Está seco e o terreno é inclinado: no sequeiro use Feijão-Congo ou Sorgo; no regadio prefira gota-a-gota com cobertura de palha.';
    }
    if (isDry) {
      return isEn
        ? 'Low recent rainfall: pick drought-hardy crops (Pigeon Pea, Cowpea, Pearl Millet) or drip-irrigated vegetables (onion, carrot, tomato).'
        : 'Choveu pouco recentemente: escolha culturas resistentes (Feijão-Congo, Feijão-Pedra, Milheto) ou hortícolas em regadio gota-a-gota (cebola, cenoura, tomate).';
    }
    if (isSteep) {
      return isEn
        ? 'Sloped terrain: rotate maize or vegetables with nitrogen-fixing beans and trailing cover (Sweet Potato or Lablab) to halt erosion.'
        : 'O terreno tem declive: alterne milho ou hortícolas com feijões e cobertura rasteira (Batata-Doce ou Bongolon) para travar a erosão.';
    }
    return isEn
      ? 'Favorable weather: alternate rainfed staples (maize, beans) with irrigated vegetables (tomato, onion, cabbage) to keep soil fertile.'
      : 'Clima favorável: alterne culturas de sequeiro (milho, feijão) com hortícolas de regadio (tomate, cebola, repolho) para manter a terra fértil.';
  };

  return (
    <section
      id="visao-geral"
      className="relative overflow-hidden bg-gradient-to-br from-[#041B13] via-[#0A2F22] to-[#081F2C] text-white border-b border-emerald-950"
    >
      {/* Subtle Topographic Background Contour Lines */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 500"
        className="pointer-events-none absolute inset-0 w-full h-full opacity-20"
        preserveAspectRatio="none"
      >
        <path d="M -50 110 Q 300 40 650 130 T 1260 95" fill="none" stroke="#6EE7B7" strokeWidth="1" />
        <path d="M -50 260 Q 380 180 740 270 T 1260 220" fill="none" stroke="#A3E635" strokeWidth="0.8" />
        <path d="M -50 400 Q 420 330 820 410 T 1260 360" fill="none" stroke="#38BDF8" strokeWidth="0.8" />
      </svg>

      <div className="relative max-w-[1240px] mx-auto px-6 py-10 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left: Headline + Interactive Cabo Verde Archipelago Map */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-lime-300 tracking-wide">
                <Compass className="w-4 h-4" aria-hidden="true" />
                <span>
                  {isEn
                    ? 'Cabo Verde Archipelago · All 9 Islands'
                    : 'Arquipélago de Cabo Verde · Todas as 9 Ilhas'}
                </span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-bold tracking-tight text-white leading-[1.1] text-balance">
                {isEn ? (
                  <>
                    Pick your island and discover what to plant in{' '}
                    <span className="text-lime-400">rainfed & irrigated plots</span>
                  </>
                ) : (
                  <>
                    Escolha a sua ilha e descubra o que plantar no{' '}
                    <span className="text-lime-400">sequeiro e no regadio</span>
                  </>
                )}
              </h1>

              <p className="text-sm sm:text-base text-emerald-100/85 leading-relaxed max-w-[60ch]">
                {isEn
                  ? 'Click any island on the map or buttons below. The system automatically reads NASA satellite climate and terrain data to recommend the best crop rotation.'
                  : 'Clique em qualquer ilha no mapa ou nos botões abaixo. O sistema lê automaticamente o clima e o relevo por satélite para recomendar a melhor rotação.'}
              </p>
            </div>

            {/* Interactive Cabo Verde Archipelago SVG Map */}
            <div className="bg-slate-950/55 border border-emerald-800/60 rounded-2xl p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-[11px] font-mono text-emerald-200/80 mb-2 px-1">
                <span>
                  {isEn
                    ? 'INTERACTIVE MAP · BARLAVENTO & SOTAVENTO'
                    : 'MAPA INTERATIVO · BARLAVENTO & SOTAVENTO'}
                </span>
                <span className="text-lime-300 font-semibold">
                  {isEn ? 'Active:' : 'Ativa:'} {selectedRegion} ({selectedFarm.archipelagoGroup})
                </span>
              </div>

              <svg
                viewBox="0 0 460 285"
                className="w-full h-auto rounded-xl bg-gradient-to-b from-[#062430] to-[#041821] border border-white/10"
                role="img"
                aria-label={
                  isEn
                    ? 'Interactive map of all 9 inhabited islands of Cabo Verde'
                    : 'Mapa interativo das 9 ilhas habitadas de Cabo Verde'
                }
              >
                <defs>
                  <pattern id="cv-sea-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                    <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="460" height="285" fill="url(#cv-sea-grid)" />

                <text x="18" y="24" className="fill-sky-300/45 text-[9.5px] font-mono tracking-widest">
                  {isEn ? 'BARLAVENTO (NORTH)' : 'BARLAVENTO (NORTE)'}
                </text>
                <text x="18" y="272" className="fill-emerald-300/45 text-[9.5px] font-mono tracking-widest">
                  {isEn ? 'SOTAVENTO (SOUTH)' : 'SOTAVENTO (SUL)'}
                </text>

                <path
                  d="M 20 165 Q 230 140 440 155"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="4 4"
                />

                {(() => {
                  const pt = projectCoord(16.76, -24.74);
                  return (
                    <ellipse
                      cx={pt.x}
                      cy={pt.y}
                      rx={6}
                      ry={3}
                      fill="#1e3a3a"
                      stroke="#475569"
                      strokeWidth="0.7"
                      opacity={0.6}
                    />
                  );
                })()}

                {islandRepresentatives.map((islandRep) => {
                  const isActive = islandRep.region === selectedFarm.region;
                  const targetFarm = isActive ? selectedFarm : islandRep;
                  const pt = projectCoord(islandRep.latitude, islandRep.longitude);
                  const shapePath = ISLAND_SHAPES[islandRep.id] ?? ISLAND_SHAPES['brava-cv'];
                  const lbl = LABEL_OFFSETS[islandRep.id] ?? { dx: 0, dy: -16, anchor: 'middle' as const };

                  return (
                    <g
                      key={islandRep.id}
                      transform={`translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`}
                      onClick={() => onSelectFarm(targetFarm)}
                      className="cursor-pointer group"
                    >
                      {isActive && (
                        <circle
                          cx={0}
                          cy={0}
                          r={24}
                          fill="rgba(163, 230, 53, 0.14)"
                          stroke="rgba(163, 230, 53, 0.45)"
                          strokeWidth="1"
                        />
                      )}
                      <path
                        d={shapePath}
                        fill={isActive ? '#84CC16' : '#1E4D3B'}
                        stroke={isActive ? '#ECFCCB' : '#6EE7B7'}
                        strokeWidth={isActive ? 1.8 : 1}
                        className="transition-colors duration-200 group-hover:fill-lime-400"
                      />
                      <circle cx={0} cy={0} r={isActive ? 3.5 : 2.2} fill={isActive ? '#052e16' : '#A7F3D0'} />
                      <text
                        x={lbl.dx}
                        y={lbl.dy}
                        textAnchor={lbl.anchor}
                        className={`text-[10px] transition-colors ${
                          isActive ? 'fill-lime-300 font-bold' : 'fill-slate-200/85 font-medium group-hover:fill-white'
                        }`}
                        style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                      >
                        {islandRep.region.replace('Ilha do ', '').replace('Ilha ', '')}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Quick Buttons Grouped by Barlavento & Sotavento */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-sky-300/80">
                    Barlavento
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {barlaventoFarms.map((farm) => {
                      const active = farm.region === selectedFarm.region;
                      return (
                        <button
                          key={farm.id}
                          type="button"
                          onClick={() => onSelectFarm(farm)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                            active
                              ? 'bg-lime-400 text-slate-950 font-bold shadow-xs'
                              : 'bg-white/10 text-slate-200 hover:bg-white/20'
                          }`}
                        >
                          {farm.region.replace('Ilha do ', '')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-emerald-300/80">
                    Sotavento
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {sotaventoFarms.map((farm) => {
                      const active = farm.region === selectedFarm.region;
                      return (
                        <button
                          key={farm.id}
                          type="button"
                          onClick={() => onSelectFarm(farm)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                            active
                              ? 'bg-lime-400 text-slate-950 font-bold shadow-xs'
                              : 'bg-white/10 text-slate-200 hover:bg-white/20'
                          }`}
                        >
                          {farm.region.replace('Ilha do ', '').replace('Ilha ', '')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {zonesForSelectedIsland.length > 1 && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-lime-300/90">
                    {isEn
                      ? `Agricultural Zones in ${selectedRegion} (${zonesForSelectedIsland.length})`
                      : `Zonas Agrícolas de ${selectedRegion} (${zonesForSelectedIsland.length})`}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {zonesForSelectedIsland.map((zone) => {
                      const active = zone.id === selectedFarm.id;
                      return (
                        <button
                          key={zone.id}
                          type="button"
                          onClick={() => onSelectFarm(zone)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                            active
                              ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                              : 'bg-white/10 text-emerald-100 hover:bg-white/20'
                          }`}
                        >
                          {zone.zoneLabel ?? zone.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Dramatic Real Island Photo Showcase + Live Overlay Stats */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className="relative flex-1 min-h-[290px] sm:min-h-[340px] rounded-2xl overflow-hidden border border-white/15 bg-slate-950 shadow-2xl">
              {!heroImgFailed ? (
                <img
                  key={selectedFarm.id}
                  src={selectedFarm.imageUrl}
                  alt={selectedFarm.imageAlt}
                  referrerPolicy="no-referrer"
                  onError={() => setFailedFarmId(selectedFarm.id)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-emerald-950 text-white">
                  <Satellite className="w-10 h-10 text-lime-400 mb-2" aria-hidden="true" />
                  <p className="text-sm font-semibold">{selectedFarm.name}</p>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />

              <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2 text-[11px] font-mono text-white/90">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/70 backdrop-blur-sm border border-white/15">
                  <MapPin className="w-3 h-3 text-lime-400" aria-hidden="true" />
                  {selectedFarm.archipelagoGroup} · {selectedFarm.latitude.toFixed(2)}°, {selectedFarm.longitude.toFixed(2)}°
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-950/70 backdrop-blur-sm border border-white/15 tabular-nums">
                  SRTM {summary?.srtmElevationM ?? selectedFarm.elevationM} m
                </span>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-5 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-lime-300">
                    {selectedRegion} · {selectedBiome}
                  </p>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight mt-0.5">
                    {selectedFarm.name}
                  </h2>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/15 text-xs">
                  <div>
                    <span className="block text-[10px] text-slate-300">
                      {isEn ? 'Temperature' : 'Temperatura'}
                    </span>
                    <span className="font-mono tabular-nums font-bold text-white">
                      {loading || !summary ? '...' : `${summary.avgTempC.toFixed(1)} °C`}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-300">
                      {isEn ? 'Rain (30d)' : 'Chuva (30d)'}
                    </span>
                    <span className="font-mono tabular-nums font-bold text-sky-300">
                      {loading || !summary ? '...' : `${summary.totalPrecipitationMm.toFixed(0)} mm`}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-300">
                      {isEn ? 'Soil Moisture' : 'Umidade Solo'}
                    </span>
                    <span className="font-mono tabular-nums font-bold text-lime-300">
                      {loading || !summary ? '...' : `${summary.avgTopsoilWetnessPct.toFixed(0)}%`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 High-Contrast Glass Decision Cards */}
        <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/[0.08] border border-white/15 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
              <ThermometerSun className="w-4 h-4" aria-hidden="true" />
              <span>{isEn ? 'Rain & Heat (Last 30 days)' : 'Chuva e Calor (Últimos 30 dias)'}</span>
            </div>
            <p className="mt-2 font-display text-lg font-bold text-white tabular-nums">
              {loading || !summary
                ? isEn
                  ? 'Loading data...'
                  : 'A carregar dados...'
                : isEn
                ? `${summary.avgTempC.toFixed(0)} °C · ${summary.totalPrecipitationMm.toFixed(0)} mm rainfall`
                : `${summary.avgTempC.toFixed(0)} °C · ${summary.totalPrecipitationMm.toFixed(0)} mm de chuva`}
            </p>
            <p className="mt-1 text-xs text-emerald-100/80">
              {summary
                ? summary.waterDeficitMm > 30
                  ? isEn
                    ? `${summary.waterDeficitMm.toFixed(0)} mm deficit — dry conditions require water saving.`
                    : `Faltam ${summary.waterDeficitMm.toFixed(0)} mm — tempo seco pede poupança de água.`
                  : isEn
                  ? 'Balanced rainfall for the recent growing window.'
                  : 'Chuva equilibrada para o ciclo recente.'
                : isEn
                ? 'Querying NASA POWER & SMAP...'
                : 'Consultando NASA POWER e SMAP...'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.08] border border-white/15 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <Mountain className="w-4 h-4" aria-hidden="true" />
              <span>{isEn ? 'Soil Moisture & Slope' : 'Estado da Terra e Declive'}</span>
            </div>
            <p className="mt-2 font-display text-lg font-bold text-white tabular-nums">
              {loading || !summary
                ? isEn
                  ? 'Loading terrain...'
                  : 'A carregar relevo...'
                : isEn
                ? `Moisture ${summary.avgTopsoilWetnessPct.toFixed(0)}% · Slope ${summary.srtmMeanSlopePct}%`
                : `Umidade ${summary.avgTopsoilWetnessPct.toFixed(0)}% · Declive ${summary.srtmMeanSlopePct}%`}
            </p>
            <p className="mt-1 text-xs text-emerald-100/80">
              {summary
                ? summary.srtmMeanSlopePct >= 6
                  ? isEn
                    ? 'Steep hillside — protect soil with terraces and live cover.'
                    : 'Encosta inclinada — proteja com socalcos e cobertura viva.'
                  : isEn
                  ? 'Gentle terrain — ideal for raised beds and row crops.'
                  : 'Terreno suave — favorável para canteiros e linhas.'
                : isEn
                ? 'Reading SRTM elevation radar...'
                : 'Lendo radar topográfico SRTM...'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-lime-400 text-slate-950 border border-lime-300 shadow-md">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>
                {isEn ? `Today's Advice for ${selectedRegion}` : `Conselho de Hoje para ${selectedRegion}`}
              </span>
            </div>
            <p className="mt-2 text-xs sm:text-sm font-medium leading-relaxed text-slate-900">
              {getPlainAdvice()}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-950/80">
              <Droplets className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isEn
                  ? 'Ready to simulate Rainfed & Irrigated plans below'
                  : 'Pronto para simular Sequeiro e Regadio abaixo'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
