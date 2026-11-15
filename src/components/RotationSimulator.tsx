import React, { useState } from 'react';
import {
  ArrowRight,
  CloudRain,
  Droplets,
  Layers,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sprout,
} from 'lucide-react';
import { CROP_CATALOG, DEFAULT_ROTATION_SLOTS } from '../data/cropsAndFarms.ts';
import {
  CROP_TRANSLATIONS_EN,
  getCategoryLabel,
  getIrrigationBadge,
} from '../i18n/translations.ts';
import { getCropById } from '../lib/agronomyEngine.ts';
import soilProfileImg from '../assets/images/soil_profile_cross_section_1794676421117.jpg';
import type {
  FarmerPriorities,
  IrrigationSystem,
  Language,
  RotationSimulationResult,
  SoilProfile,
  SoilTexture,
} from '../types/agrosmart.ts';

interface RotationSimulatorProps {
  lang: Language;
  soil: SoilProfile;
  onChangeSoil: (soil: SoilProfile) => void;
  irrigationSystem: IrrigationSystem;
  onChangeIrrigationSystem: (mode: IrrigationSystem) => void;
  priorities: FarmerPriorities;
  onChangePriorities: (p: FarmerPriorities) => void;
  cropIds: string[];
  onChangeCropIds: (nextIds: string[]) => void;
  onOptimize: () => void;
  onResetDefault: () => void;
  simulation: RotationSimulationResult;
}

const CATEGORY_BAR_COLORS: Record<string, string> = {
  leguminosa: 'bg-emerald-600',
  graminea: 'bg-amber-500',
  cobertura: 'bg-teal-600',
  oleaginosa: 'bg-sky-600',
  horticola: 'bg-lime-600',
  fruticultura: 'bg-cyan-600',
};

const SLOT_LABELS_EN: { label: string; periodLabel: string }[] = [
  { label: 'Cycle 1', periodLabel: 'Rains (Aug – Nov)' },
  { label: 'Cycle 2', periodLabel: 'Post-Rain (Dec – Mar)' },
  { label: 'Cycle 3', periodLabel: 'Dry Season (Apr – Jul)' },
  { label: 'Cycle 4', periodLabel: 'Next Rains (Aug – Nov)' },
];

const sequeiroOptions = CROP_CATALOG.filter((c) => c.irrigationMode === 'sequeiro');
const regadioOptions = CROP_CATALOG.filter((c) => c.irrigationMode === 'regadio');
const ambosOptions = CROP_CATALOG.filter((c) => c.irrigationMode === 'ambos');

export const RotationSimulator: React.FC<RotationSimulatorProps> = ({
  lang,
  soil,
  onChangeSoil,
  irrigationSystem,
  onChangeIrrigationSystem,
  priorities,
  onChangePriorities,
  cropIds,
  onChangeCropIds,
  onOptimize,
  onResetDefault,
  simulation,
}) => {
  const [soilImgFailed, setSoilImgFailed] = useState(false);
  const [curveMode, setCurveMode] = useState<'soilHealth' | 'moisture'>('soilHealth');
  const [hoverMonthIdx, setHoverMonthIdx] = useState<number | null>(null);
  const isEn = lang === 'en';

  const getCropText = (id: string, ptName: string, ptNote: string) => {
    if (!isEn) return { name: ptName, note: ptNote };
    const tr = CROP_TRANSLATIONS_EN[id];
    return tr ? { name: tr.name, note: tr.agronomicNote } : { name: ptName, note: ptNote };
  };

  const handleSlotChange = (index: number, newCropId: string) => {
    const next = [...cropIds];
    next[index] = newCropId;
    onChangeCropIds(next);
  };

  const applyGoalPreset = (goal: 'agua' | 'solo' | 'colheita' | 'calor') => {
    if (goal === 'agua') {
      onChangePriorities({ waterConservation: 10, soilHealthCarbon: 7, yieldStability: 6, climateResilience: 9 });
    } else if (goal === 'solo') {
      onChangePriorities({ waterConservation: 7, soilHealthCarbon: 10, yieldStability: 6, climateResilience: 8 });
    } else if (goal === 'colheita') {
      onChangePriorities({ waterConservation: 6, soilHealthCarbon: 6, yieldStability: 10, climateResilience: 7 });
    } else {
      onChangePriorities({ waterConservation: 8, soilHealthCarbon: 7, yieldStability: 6, climateResilience: 10 });
    }
  };

  const activeGoal =
    priorities.waterConservation >= 10
      ? 'agua'
      : priorities.soilHealthCarbon >= 10
      ? 'solo'
      : priorities.yieldStability >= 10
      ? 'colheita'
      : priorities.climateResilience >= 10
      ? 'calor'
      : 'custom';

  const baselineLabel = isEn
    ? irrigationSystem === 'regadio'
      ? 'tomato only'
      : 'maize only'
    : irrigationSystem === 'regadio'
    ? 'só tomate'
    : 'só milho';

  const baselineTitleLabel = isEn
    ? irrigationSystem === 'regadio'
      ? 'Tomato Only'
      : 'Maize Only'
    : irrigationSystem === 'regadio'
    ? 'Só Tomate'
    : 'Só Milho';

  // 12-Month Simple Trajectory Chart Geometry
  const proj = simulation.monthlyProjection;
  const chartW = 760;
  const chartH = 220;
  const padL = 44;
  const padR = 24;
  const padT = 18;
  const padB = 30;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const getOptVal = (d: (typeof proj)[number]) =>
    curveMode === 'soilHealth' ? d.optimizedSoilHealth : d.optimizedMoistureRetention;
  const getBaseVal = (d: (typeof proj)[number]) =>
    curveMode === 'soilHealth' ? d.baselineSoilHealth : d.baselineMoistureRetention;

  const minVal = 15;
  const maxVal = 100;
  const xForIdx = (i: number) => padL + (i / Math.max(1, proj.length - 1)) * innerW;
  const yForVal = (v: number) =>
    padT + innerH - ((v - minVal) / (maxVal - minVal)) * innerH;

  const optPath = proj
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xForIdx(i).toFixed(1)} ${yForVal(getOptVal(d)).toFixed(1)}`)
    .join(' ');
  const optAreaPath =
    proj.length > 0
      ? `${optPath} L ${xForIdx(proj.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${xForIdx(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
      : '';
  const basePath = proj
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xForIdx(i).toFixed(1)} ${yForVal(getBaseVal(d)).toFixed(1)}`)
    .join(' ');
  const hoveredPoint = hoverMonthIdx !== null ? proj[hoverMonthIdx] : null;

  const waterBarPct = Math.max(8, Math.min(100, simulation.waterSavedVsBaselinePct * 2.2));
  const nitrogenBarPct = Math.max(10, Math.min(100, 50 + simulation.netNitrogenKgHa * 0.35));

  return (
    <section id="rotacao" className="py-8">
      <div className="space-y-8">
        {/* Tactile Water System & Soil Control Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">
                {isEn
                  ? 'Build Your Planting Plan (Rainfed & Irrigated)'
                  : 'Monte o seu Plano de Plantio (Sequeiro & Regadio)'}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {isEn
                  ? 'Rotate rainfed staples, drip-irrigated vegetables, and cover crops to harvest more while saving water.'
                  : 'Alterne entre culturas de sequeiro, hortícolas de regadio gota-a-gota e cobertura do solo para colher mais gastando menos água.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onResetDefault}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                {isEn ? 'Default' : 'Padrão'}
              </button>
              <button
                type="button"
                onClick={onOptimize}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-slate-950 bg-lime-400 hover:bg-lime-300 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                {isEn ? 'Suggest Best Auto Rotation' : 'Sugerir Melhor Rotação Automática'}
              </button>
            </div>
          </div>

          {/* 3 Interactive Water System Mode Cards */}
          <div className="pt-5 border-t border-slate-200 space-y-5">
            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-2">
                {isEn
                  ? '1. Choose how you farm your land:'
                  : '1. Escolha como você planta na sua roça:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'sequeiro' as const,
                    title: isEn ? 'Rainfed Only (Rainfall)' : 'Só Sequeiro (Chuva)',
                    desc: isEn
                      ? 'Drought-hardy maize, beans, sorghum, cassava, and millet.'
                      : 'Milho, feijões, sorgo, mandioca e milheto resistentes à seca.',
                    icon: CloudRain,
                  },
                  {
                    id: 'regadio' as const,
                    title: isEn ? 'Irrigated Only (Drip)' : 'Só Regadio (Gota-a-gota)',
                    desc: isEn
                      ? 'Tomato, onion, cabbage, potato, carrot, pepper, and banana.'
                      : 'Tomate, cebola, repolho, batata, cenoura, pimentão e banana.',
                    icon: Droplets,
                  },
                  {
                    id: 'misto' as const,
                    title: isEn ? 'Mixed (Rainfed + Drip)' : 'Misto (Chuva + Regadio)',
                    desc: isEn
                      ? 'Combines wet-season rainfed staples with dry-season vegetables.'
                      : 'Combina época das águas no sequeiro com hortícolas na seca.',
                    icon: Layers,
                  },
                ].map((sys) => {
                  const Icon = sys.icon;
                  const active = irrigationSystem === sys.id;
                  return (
                    <button
                      key={sys.id}
                      type="button"
                      onClick={() => onChangeIrrigationSystem(sys.id)}
                      className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                        active
                          ? 'bg-emerald-950 text-white border-emerald-900 shadow-md'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-bold">{sys.title}</span>
                        <Icon
                          className={`w-4 h-4 ${active ? 'text-lime-400' : 'text-emerald-800'}`}
                          aria-hidden="true"
                        />
                      </div>
                      <p
                        className={`text-xs mt-1 leading-relaxed ${
                          active ? 'text-emerald-100/85' : 'text-slate-600'
                        }`}
                      >
                        {sys.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
              <div className="md:col-span-3">
                <label htmlFor="simple-soil-texture" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {isEn ? '2. Your soil type:' : '2. Tipo da sua terra:'}
                </label>
                <select
                  id="simple-soil-texture"
                  value={soil.texture}
                  onChange={(e) => onChangeSoil({ ...soil, texture: e.target.value as SoilTexture })}
                  className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="argiloso">
                    {isEn ? 'Heavy clay soil (holds water)' : 'Terra pesada / barrenta (segura água)'}
                  </option>
                  <option value="franco-argiloso">
                    {isEn ? 'Balanced loam soil' : 'Terra mista equilibrada'}
                  </option>
                  <option value="franco-arenoso">
                    {isEn ? 'Light sandy-loam soil' : 'Terra leve / solta'}
                  </option>
                  <option value="arenoso">
                    {isEn ? 'Sandy soil (drains fast)' : 'Terra arenosa (seca rápido)'}
                  </option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label htmlFor="simple-soil-erosion" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {isEn ? 'Runoff / erosion risk:' : 'Risco de enxurrada:'}
                </label>
                <select
                  id="simple-soil-erosion"
                  value={soil.erosionVulnerability}
                  onChange={(e) =>
                    onChangeSoil({
                      ...soil,
                      erosionVulnerability: e.target.value as SoilProfile['erosionVulnerability'],
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="baixa">{isEn ? 'Flat terrain (Low)' : 'Terreno plano (Baixo)'}</option>
                  <option value="media">{isEn ? 'Moderate slope' : 'Inclinação média'}</option>
                  <option value="alta">
                    {isEn ? 'Steep hillside / Terrace (High)' : 'Encosta íngreme / Socalco (Alto)'}
                  </option>
                </select>
              </div>

              <div className="md:col-span-6">
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {isEn ? '3. Your top priority:' : '3. Sua prioridade principal:'}
                </span>
                <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
                  {[
                    { id: 'agua' as const, label: isEn ? 'Save Water' : 'Poupar Água' },
                    { id: 'solo' as const, label: isEn ? 'Rebuild Soil' : 'Recuperar Terra Fraca' },
                    { id: 'colheita' as const, label: isEn ? 'Boost Yield' : 'Produzir Mais' },
                    { id: 'calor' as const, label: isEn ? 'Survive Drought' : 'Aguentar Seca e Calor' },
                  ].map((goal) => (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => applyGoalPreset(goal.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        activeGoal === goal.id
                          ? 'bg-white text-emerald-950 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {goal.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4-Season Interactive Sequence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {DEFAULT_ROTATION_SLOTS.map((slot, idx) => {
            const crop = getCropById(cropIds[idx] ?? slot.cropId);
            const cropText = getCropText(crop.id, crop.name, crop.agronomicNote);
            const barColor = CATEGORY_BAR_COLORS[crop.category] ?? 'bg-emerald-700';
            const slotLabel = isEn ? SLOT_LABELS_EN[idx]?.label ?? slot.label : slot.label;
            const slotPeriod = isEn ? SLOT_LABELS_EN[idx]?.periodLabel ?? slot.periodLabel : slot.periodLabel;

            return (
              <div
                key={slot.seasonIndex}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`h-2 w-full ${barColor}`} />
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                        <span className="font-mono text-emerald-800">0{idx + 1}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" aria-hidden="true" />
                        {slotLabel}
                      </span>
                      <span className="font-mono text-[11px]">{slotPeriod}</span>
                    </div>

                    <div>
                      <label htmlFor={`season-select-${idx}`} className="sr-only">
                        {isEn ? `Select crop for ${slotLabel}` : `Selecionar cultura para ${slotLabel}`}
                      </label>
                      <select
                        id={`season-select-${idx}`}
                        value={crop.id}
                        onChange={(e) => handleSlotChange(idx, e.target.value)}
                        className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      >
                        <optgroup label={isEn ? 'Rainfed Crops (Rainfall)' : 'Culturas de Sequeiro (Chuva)'}>
                          {sequeiroOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {getCropText(option.id, option.name, option.agronomicNote).name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label={isEn ? 'Irrigated Crops (Vegetables & Valleys)' : 'Culturas de Regadio (Hortícolas & Vale)'}>
                          {regadioOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {getCropText(option.id, option.name, option.agronomicNote).name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label={isEn ? 'Versatile (Rainfed & Irrigated)' : 'Versáteis (Sequeiro & Regadio)'}>
                          {ambosOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {getCropText(option.id, option.name, option.agronomicNote).name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      <p className="text-[11px] font-semibold text-emerald-800 mt-1.5">
                        {getCategoryLabel(crop.category, lang)} · {getIrrigationBadge(crop.irrigationMode, lang)}
                      </p>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{cropText.note}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">{isEn ? 'Water need:' : 'Uso de água:'}</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {crop.waterDemandMm} mm (
                        {crop.irrigationMode === 'regadio'
                          ? isEn
                            ? 'drip'
                            : 'rega'
                          : crop.droughtTolerance >= 85
                          ? isEn
                            ? 'low water'
                            : 'pouca água'
                          : isEn
                          ? 'moderate'
                          : 'médio'}
                        )
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">{isEn ? 'Soil impact:' : 'Efeito na terra:'}</span>
                      <span
                        className={`font-semibold ${
                          crop.nitrogenBalanceKgHa >= 0 ? 'text-emerald-800' : 'text-slate-700'
                        }`}
                      >
                        {crop.nitrogenBalanceKgHa >= 0
                          ? isEn
                            ? 'Enriches (adds nitrogen)'
                            : 'Aduba (traz nitrogênio)'
                          : isEn
                          ? 'Draws nutrients'
                          : 'Consome nutrientes'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Visual Impact Outcome Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-5 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 relative min-h-[240px] shadow-sm">
            {!soilImgFailed ? (
              <img
                src={soilProfileImg}
                alt={isEn ? 'Healthy soil layers with deep roots' : 'Camada de solo saudável com raízes profundas'}
                referrerPolicy="no-referrer"
                onError={() => setSoilImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full min-h-[240px] flex flex-col items-center justify-center p-6 bg-slate-900 text-white">
                <Sprout className="w-9 h-9 text-lime-400 mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold">{isEn ? 'Soil Health' : 'Saúde do Solo'}</p>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent text-white">
              <span className="text-[11px] font-mono uppercase tracking-wider text-lime-300">
                {isEn ? 'Roots & Living Cover' : 'Raízes & Cobertura Viva'}
              </span>
              <p className="text-xs sm:text-sm font-medium mt-1 leading-relaxed">
                {isEn
                  ? 'Whether rainfed or drip-irrigated, rotating distinct plant families breaks soil pests and holds moisture near the roots.'
                  : 'No sequeiro ou no regadio gota-a-gota, alternar famílias diferentes evita pragas no solo e segura a água perto das raízes.'}
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 text-white border border-emerald-900 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-300">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>{isEn ? 'Estimated Real Gain' : 'Ganho Real Estimado'}</span>
              </div>
              <h3 className="font-display text-xl font-bold text-white mt-1">
                {isEn
                  ? `What you gain compared to planting ${baselineLabel}`
                  : `O que você ganha comparado a plantar ${baselineLabel}`}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 my-6">
              <div className="bg-white/10 border border-white/15 rounded-xl p-4">
                <div className="text-xs font-semibold text-emerald-200">
                  {isEn ? 'Water Saved' : 'Água Poupada'}
                </div>
                <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-lime-300">
                  {simulation.waterSavedMm >= 0 ? `+${simulation.waterSavedMm}` : simulation.waterSavedMm} mm
                </div>
                <div className="mt-2 h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
                  <div className="h-full bg-lime-400 rounded-full" style={{ width: `${waterBarPct}%` }} />
                </div>
                <p className="text-[11px] text-emerald-100/85 mt-2">
                  {simulation.waterSavedVsBaselinePct >= 0
                    ? isEn
                      ? `${simulation.waterSavedVsBaselinePct}% less water needed.`
                      : `${simulation.waterSavedVsBaselinePct}% menos água necessária.`
                    : isEn
                    ? 'Consumption close to baseline.'
                    : 'Consumo próximo da referência.'}
                </p>
              </div>

              <div className="bg-white/10 border border-white/15 rounded-xl p-4">
                <div className="text-xs font-semibold text-emerald-200">
                  {isEn ? 'Natural Nitrogen (N)' : 'Adubo Natural (N)'}
                </div>
                <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-white">
                  {simulation.netNitrogenKgHa >= 0 ? `+${simulation.netNitrogenKgHa}` : simulation.netNitrogenKgHa} kg/ha
                </div>
                <div className="mt-2 h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${nitrogenBarPct}%` }} />
                </div>
                <p className="text-[11px] text-emerald-100/85 mt-2">
                  {simulation.netNitrogenKgHa >= 0
                    ? isEn
                      ? 'Soil gains natural nitrogen.'
                      : 'A terra ganha nitrogênio natural.'
                    : isEn
                    ? 'Add Cowpea or Sunn Hemp.'
                    : 'Inclua Feijão-Pedra ou Crotalária.'}
                </p>
              </div>

              <div className="bg-white/10 border border-white/15 rounded-xl p-4">
                <div className="text-xs font-semibold text-emerald-200">
                  {isEn ? 'Soil Protection' : 'Proteção do Solo'}
                </div>
                <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-sky-300">
                  {simulation.avgErosionProtection} / 100
                </div>
                <div className="mt-2 h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-400 rounded-full"
                    style={{ width: `${simulation.avgErosionProtection}%` }}
                  />
                </div>
                <p className="text-[11px] text-emerald-100/85 mt-2">
                  +{simulation.soilCarbonDeltaTHa.toFixed(1)}{' '}
                  {isEn ? 't/ha organic matter.' : 't/ha de matéria orgânica.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Simple 1-Year Soil Trajectory Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-950">
                {isEn ? 'Your soil 1 year from now' : 'Sua terra daqui a 1 ano'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {isEn
                  ? `Green line: using this rotation · Dashed gray line: planting ${baselineLabel} non-stop.`
                  : `Linha verde: usando esta rotação · Linha cinza tracejada: plantando ${baselineLabel} sem parar.`}
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setCurveMode('soilHealth')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  curveMode === 'soilHealth'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isEn ? 'Soil Health' : 'Saúde da Terra'}
              </button>
              <button
                type="button"
                onClick={() => setCurveMode('moisture')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  curveMode === 'moisture'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isEn ? 'Retained Soil Water (%)' : 'Água Guardada no Solo (%)'}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full h-auto overflow-visible"
              onMouseLeave={() => setHoverMonthIdx(null)}
            >
              <defs>
                <linearGradient id="predSimpleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#15803d" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#15803d" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {[20, 40, 60, 80, 100].map((tick) => {
                const y = yForVal(tick);
                return (
                  <g key={tick}>
                    <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                    <text
                      x={padL - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono tabular-nums"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {optAreaPath && <path d={optAreaPath} fill="url(#predSimpleGrad)" />}
              <path d={basePath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 4" />
              <path d={optPath} fill="none" stroke="#15803d" strokeWidth="2.8" />

              {proj.map((d, i) => (
                <g key={d.monthLabel}>
                  <circle
                    cx={xForIdx(i)}
                    cy={yForVal(getOptVal(d))}
                    r={hoverMonthIdx === i ? 5.5 : 3.2}
                    fill="#15803d"
                  />
                  <text
                    x={xForIdx(i)}
                    y={chartH - 8}
                    textAnchor="middle"
                    className="fill-slate-500 text-[10px] font-mono tabular-nums"
                  >
                    {d.monthLabel}
                  </text>
                  <rect
                    x={xForIdx(i) - innerW / Math.max(1, proj.length * 2)}
                    y={padT}
                    width={innerW / Math.max(1, proj.length)}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHoverMonthIdx(i)}
                  />
                </g>
              ))}

              {hoverMonthIdx !== null && hoveredPoint && (
                <line
                  x1={xForIdx(hoverMonthIdx)}
                  y1={padT}
                  x2={xForIdx(hoverMonthIdx)}
                  y2={padT + innerH}
                  stroke="#0f172a"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              )}
            </svg>

            <div className="mt-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs font-mono tabular-nums text-slate-700">
              {hoveredPoint ? (
                <>
                  <span className="font-semibold text-slate-900">
                    {isEn ? `Month ${hoveredPoint.monthLabel}` : `Mês ${hoveredPoint.monthLabel}`}
                  </span>
                  <span className="text-emerald-800 font-semibold">
                    {isEn ? 'With Rotation' : 'Com Rotação'}: {getOptVal(hoveredPoint).toFixed(0)}
                    {curveMode === 'moisture' ? '%' : ' pts'}
                  </span>
                  <span>
                    {baselineTitleLabel}: {getBaseVal(hoveredPoint).toFixed(0)}
                    {curveMode === 'moisture' ? '%' : ' pts'}
                  </span>
                  <span className="font-semibold text-emerald-900">
                    {isEn ? 'Gain' : 'Ganho'}: +{(getOptVal(hoveredPoint) - getBaseVal(hoveredPoint)).toFixed(0)}
                  </span>
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between w-full gap-4">
                  <span className="text-slate-500">
                    {isEn
                      ? 'Hover over the months to compare soil improvement.'
                      : 'Passe o mouse sobre os meses para ver a diferença na sua terra.'}
                  </span>
                  <div className="flex items-center gap-4 text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-4 h-0.5 bg-emerald-700 inline-block" />
                      {isEn ? 'With rotation' : 'Com rotação'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-4 h-0.5 border-t-2 border-dashed border-slate-400 inline-block" />
                      {baselineTitleLabel}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
