import {
  BASELINE_IRRIGATED_IDS,
  BASELINE_MONOCULTURE_IDS,
  CROP_CATALOG,
} from '../data/cropsAndFarms.ts';
import { getLocalizedAlertRule } from '../i18n/translations.ts';
import type {
  AlertEvent,
  AlertRule,
  CropSpecies,
  FarmerPriorities,
  IrrigationSystem,
  Language,
  NasaTelemetrySummary,
  RotationSimulationResult,
  SoilProfile,
} from '../types/agrosmart.ts';

const cropMap = new Map<string, CropSpecies>(CROP_CATALOG.map((c) => [c.id, c]));

export function getCropById(id: string): CropSpecies {
  return cropMap.get(id) ?? CROP_CATALOG[0];
}

function getTextureWaterFactor(texture: SoilProfile['texture']): number {
  switch (texture) {
    case 'argiloso':
      return 1.12;
    case 'franco-argiloso':
      return 1.06;
    case 'franco-arenoso':
      return 0.91;
    case 'arenoso':
      return 0.8;
  }
}

export function simulateRotation(
  cropIds: string[],
  soil: SoilProfile,
  priorities: FarmerPriorities,
  climate: NasaTelemetrySummary,
  irrigationSystem: IrrigationSystem = 'misto',
): RotationSimulationResult {
  const sequence = cropIds.map(getCropById);
  const baselineIds =
    irrigationSystem === 'regadio' ? BASELINE_IRRIGATED_IDS : BASELINE_MONOCULTURE_IDS;
  const baselineSequence = baselineIds.map(getCropById);

  const textureFactor = getTextureWaterFactor(soil.texture);
  const omBonus = 1 + (soil.organicMatterPct - 2.5) * 0.04;

  // Drip irrigation reduces evaporation losses slightly vs open rainfed exposure
  const irrigationEfficiencyFactor = irrigationSystem === 'regadio' ? 0.92 : 1.0;

  const computeSequenceStats = (seq: CropSpecies[]) => {
    let consecutiveFamilyPenalties = 0;
    const uniqueFamilies = new Set<string>();
    let totalWater = 0;
    let totalN = 0;
    let totalCarbon = 0;
    let erosionSum = 0;
    let droughtSum = 0;
    let thermalStressPenalty = 0;

    seq.forEach((crop, idx) => {
      uniqueFamilies.add(crop.family);
      const prev = idx > 0 ? seq[idx - 1] : null;
      const sameCropAsPrev = prev && prev.id === crop.id;
      const sameFamilyAsPrev = prev && prev.family === crop.family;

      if (sameCropAsPrev) consecutiveFamilyPenalties += 1.6;
      else if (sameFamilyAsPrev) consecutiveFamilyPenalties += 0.85;

      // Cover crop or leguminous residue preceding reduces next crop evaporation
      const prevWasCover = prev?.category === 'cobertura' || prev?.id === 'feijao-bongolon';
      const waterEff = (prevWasCover ? 0.87 : 1.0) * irrigationEfficiencyFactor;

      const climateAridityMultiplier =
        1 + Math.min(0.22, Math.max(0, climate.waterDeficitMm / 350));
      totalWater += crop.waterDemandMm * waterEff * climateAridityMultiplier;

      totalN += crop.nitrogenBalanceKgHa;
      const tillageRetention =
        crop.category === 'cobertura' || crop.category === 'fruticultura' ? 1.15 : 1.0;
      totalCarbon += crop.organicCarbonContributionTHa * tillageRetention * omBonus;

      if (climate.maxTempPeakC > crop.maxOptimalTempC) {
        thermalStressPenalty += (climate.maxTempPeakC - crop.maxOptimalTempC) * 4.2;
      }
      // ECOSTRESS surface heat impact (bare-ground crops suffer more under high LST)
      if (climate.avgSurfaceTempC > 31 && crop.category !== 'cobertura') {
        thermalStressPenalty += (climate.avgSurfaceTempC - 31) * 1.4;
      }
      // SMAP/GLDAS deep root-zone moisture bonus for deep-rooted crops
      const rootBonus =
        crop.rootDepthCm >= 135 && climate.avgRootZoneWetnessPct >= 42 ? 6 : 0;

      erosionSum += crop.erosionProtection;
      const baseDrought =
        crop.irrigationMode === 'regadio' && irrigationSystem !== 'sequeiro'
          ? Math.max(crop.droughtTolerance, 68)
          : crop.droughtTolerance;
      droughtSum += Math.min(99, baseDrought + rootBonus);
    });

    const diversityFactor = Math.min(
      1.18,
      0.84 + uniqueFamilies.size * 0.11 - consecutiveFamilyPenalties * 0.06,
    );
    const avgErosion = Math.min(98, Math.max(25, (erosionSum / seq.length) * diversityFactor));
    const droughtResilience = Math.min(
      98,
      Math.max(25, (droughtSum / seq.length) * textureFactor * diversityFactor),
    );
    const heatAdaptation = Math.min(98, Math.max(25, 92 - thermalStressPenalty * 0.8));

    return {
      totalWater: Math.round(totalWater),
      totalN: Math.round(totalN),
      totalCarbon: Number((totalCarbon * diversityFactor).toFixed(2)),
      avgErosion: Math.round(avgErosion),
      droughtResilience: Math.round(droughtResilience),
      heatAdaptation: Math.round(heatAdaptation),
      uniqueFamiliesCount: uniqueFamilies.size,
      consecutiveFamilyPenalties,
    };
  };

  const opt = computeSequenceStats(sequence);
  const base = computeSequenceStats(baselineSequence);

  const waterSavedMm = Math.max(-250, base.totalWater - opt.totalWater);
  const waterSavedVsBaselinePct = Number(
    (((base.totalWater - opt.totalWater) / Math.max(1, base.totalWater)) * 100).toFixed(1),
  );

  const clampScore = (v: number) => Math.round(Math.min(98, Math.max(18, v)));

  const radarAxes = [
    {
      label: 'Retenção Hídrica',
      currentValue: clampScore(
        opt.droughtResilience * 0.65 + (100 - (opt.totalWater / 2200) * 60) * 0.35,
      ),
      baselineValue: clampScore(
        base.droughtResilience * 0.65 + (100 - (base.totalWater / 2200) * 60) * 0.35,
      ),
    },
    {
      label: 'Fixação de N',
      currentValue: clampScore(55 + opt.totalN * 0.25),
      baselineValue: clampScore(55 + base.totalN * 0.25),
    },
    {
      label: 'Carbono no Solo',
      currentValue: clampScore(32 + opt.totalCarbon * 13.5),
      baselineValue: clampScore(32 + base.totalCarbon * 13.5),
    },
    {
      label: 'Tolerância Térmica',
      currentValue: clampScore(opt.heatAdaptation),
      baselineValue: clampScore(base.heatAdaptation),
    },
    {
      label: 'Controle de Erosão',
      currentValue: clampScore(opt.avgErosion),
      baselineValue: clampScore(base.avgErosion),
    },
    {
      label: 'Estabilidade Safra',
      currentValue: clampScore(
        (opt.droughtResilience + opt.heatAdaptation + opt.avgErosion) / 3 +
          (priorities.yieldStability >= 7 ? 4 : 0),
      ),
      baselineValue: clampScore(
        (base.droughtResilience + base.heatAdaptation + base.avgErosion) / 3 - 5,
      ),
    },
  ];

  // 12-month predictive trajectory
  const months = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'];
  const baseSoilIndex = 48 + soil.organicMatterPct * 4.5;
  const optGainPerMonth = (opt.totalCarbon * 3.8 + (opt.avgErosion - 60) * 0.14) / 12;
  const baseDriftPerMonth =
    (base.totalCarbon * 1.4 - 4.2 - (climate.heatStressDays > 6 ? 1.8 : 0.6)) / 12;

  const monthlyProjection = months.map((monthLabel, idx) => {
    const seasonalWave = Math.sin((idx / 11) * Math.PI * 2) * 3.2;
    const optimizedSoilHealth = Number(
      Math.min(
        96,
        Math.max(20, baseSoilIndex + optGainPerMonth * (idx + 1) + seasonalWave * 0.4),
      ).toFixed(1),
    );
    const baselineSoilHealth = Number(
      Math.min(
        92,
        Math.max(20, baseSoilIndex + baseDriftPerMonth * (idx + 1) - seasonalWave * 0.5),
      ).toFixed(1),
    );

    const baseMoist = Math.max(22, Math.min(85, climate.avgTopsoilWetnessPct));
    const optimizedMoistureRetention = Number(
      Math.min(
        92,
        Math.max(22, baseMoist + (opt.droughtResilience - 62) * 0.24 + idx * 0.45 + seasonalWave),
      ).toFixed(1),
    );
    const baselineMoistureRetention = Number(
      Math.min(88, Math.max(18, baseMoist - 3.5 - idx * 0.35 + seasonalWave * 1.1)).toFixed(1),
    );

    return {
      monthLabel,
      optimizedSoilHealth,
      baselineSoilHealth,
      optimizedMoistureRetention,
      baselineMoistureRetention,
    };
  });

  const seasonLabels = [
    'Ciclo 1 (Águas)',
    'Ciclo 2 (Pós-Águas)',
    'Ciclo 3 (Época Seca)',
    'Ciclo 4 (Águas Seg.)',
  ];
  const seasonBreakdown = sequence.map((crop, idx) => {
    const prev = idx > 0 ? sequence[idx - 1] : null;
    const waterAdj = Math.round(
      crop.waterDemandMm * (prev?.category === 'cobertura' ? 0.87 : 1) * irrigationEfficiencyFactor,
    );
    const tempRisk = climate.maxTempPeakC - crop.maxOptimalTempC;
    const deficitRisk =
      irrigationSystem === 'sequeiro' && climate.waterDeficitMm > 40 && crop.droughtTolerance < 68;
    const climateRisk: 'baixo' | 'moderado' | 'elevado' =
      tempRisk > 3 || deficitRisk
        ? 'elevado'
        : tempRisk > 0.5 || (irrigationSystem === 'sequeiro' && crop.droughtTolerance < 65)
        ? 'moderado'
        : 'baixo';

    return {
      seasonLabel: seasonLabels[idx] ?? `Ciclo ${idx + 1}`,
      cropName: crop.name,
      family: crop.family,
      waterDemandMm: waterAdj,
      nitrogenDeltaKgHa: crop.nitrogenBalanceKgHa,
      carbonDeltaTHa: Number((crop.organicCarbonContributionTHa * omBonus).toFixed(2)),
      climateRisk,
    };
  });

  return {
    sequence,
    totalWaterDemandMm: opt.totalWater,
    waterSavedVsBaselinePct,
    waterSavedMm,
    netNitrogenKgHa: opt.totalN,
    soilCarbonDeltaTHa: opt.totalCarbon,
    avgErosionProtection: opt.avgErosion,
    droughtResilienceIndex: opt.droughtResilience,
    heatAdaptationScore: opt.heatAdaptation,
    radarAxes,
    monthlyProjection,
    seasonBreakdown,
  };
}

export function optimizeRotationForFarm(
  soil: SoilProfile,
  priorities: FarmerPriorities,
  climate: NasaTelemetrySummary,
  irrigationSystem: IrrigationSystem = 'misto',
): string[] {
  const allowsRainfed = (c: CropSpecies) =>
    c.irrigationMode === 'sequeiro' || c.irrigationMode === 'ambos';
  const allowsIrrigated = (c: CropSpecies) =>
    c.irrigationMode === 'regadio' || c.irrigationMode === 'ambos';

  let s1Pool: CropSpecies[];
  let s2Pool: CropSpecies[];
  let s3Pool: CropSpecies[];
  let s4Pool: CropSpecies[];

  if (irrigationSystem === 'sequeiro') {
    s1Pool = CROP_CATALOG.filter(
      (c) => allowsRainfed(c) && (c.category === 'leguminosa' || c.category === 'graminea'),
    );
    s2Pool = CROP_CATALOG.filter(
      (c) => allowsRainfed(c) && (c.id === 'sorgo' || c.id === 'batata-doce' || c.id === 'feijao-caupi' || c.id === 'mandioca'),
    );
    s3Pool = CROP_CATALOG.filter((c) => allowsRainfed(c) && c.category === 'cobertura');
    s4Pool = CROP_CATALOG.filter(
      (c) => allowsRainfed(c) && ['feijao-congo', 'feijao-caupi', 'girassol', 'mandioca'].includes(c.id),
    );
  } else if (irrigationSystem === 'regadio') {
    s1Pool = CROP_CATALOG.filter(
      (c) => allowsIrrigated(c) && ['tomate', 'pimentao', 'batata-comum', 'repolho'].includes(c.id),
    );
    s2Pool = CROP_CATALOG.filter(
      (c) => allowsIrrigated(c) && ['feijao-caupi', 'crotalaria', 'batata-doce'].includes(c.id),
    );
    s3Pool = CROP_CATALOG.filter(
      (c) => allowsIrrigated(c) && ['cebola', 'cenoura', 'repolho', 'crotalaria'].includes(c.id),
    );
    s4Pool = CROP_CATALOG.filter(
      (c) => allowsIrrigated(c) && ['batata-doce', 'tomate', 'cenoura', 'banana-cana', 'feijao-caupi'].includes(c.id),
    );
  } else {
    // Misto: Sequeiro nas águas + Regadio na pós-águas / seca
    s1Pool = CROP_CATALOG.filter(
      (c) => ['feijao-congo', 'milho', 'sorgo', 'pimentao'].includes(c.id),
    );
    s2Pool = CROP_CATALOG.filter(
      (c) => ['tomate', 'batata-comum', 'repolho', 'batata-doce'].includes(c.id),
    );
    s3Pool = CROP_CATALOG.filter(
      (c) => ['feijao-caupi', 'cebola', 'cenoura', 'crotalaria'].includes(c.id),
    );
    s4Pool = CROP_CATALOG.filter(
      (c) => ['feijao-bongolon', 'feijao-congo', 'batata-doce', 'repolho'].includes(c.id),
    );
  }

  let bestSequence: string[] =
    irrigationSystem === 'regadio'
      ? ['tomate', 'feijao-caupi', 'cebola', 'repolho']
      : irrigationSystem === 'sequeiro'
      ? ['feijao-congo', 'sorgo', 'feijao-bongolon', 'feijao-caupi']
      : ['feijao-congo', 'tomate', 'feijao-caupi', 'cebola'];
  let bestObjective = -Infinity;

  const totalWeight =
    priorities.waterConservation +
    priorities.soilHealthCarbon +
    priorities.yieldStability +
    priorities.climateResilience;
  const wWater = priorities.waterConservation / totalWeight;
  const wSoil = priorities.soilHealthCarbon / totalWeight;
  const wYield = priorities.yieldStability / totalWeight;
  const wClimate = priorities.climateResilience / totalWeight;

  for (const s1 of s1Pool) {
    for (const s2 of s2Pool) {
      for (const s3 of s3Pool) {
        for (const s4 of s4Pool) {
          const candidate = [s1.id, s2.id, s3.id, s4.id];
          const sim = simulateRotation(candidate, soil, priorities, climate, irrigationSystem);

          const uniqueFamilies = new Set(sim.sequence.map((c) => c.family)).size;
          const foodOrCashBonus = sim.sequence.reduce((acc, c) => {
            if (['tomate', 'cebola', 'batata-comum', 'repolho', 'pimentao', 'cenoura'].includes(c.id)) {
              return acc + 9;
            }
            if (['milho', 'sorgo', 'feijao-congo', 'feijao-caupi', 'batata-doce'].includes(c.id)) {
              return acc + 8;
            }
            return acc + 4;
          }, 0);

          const waterScore = Math.max(0, 100 - (sim.totalWaterDemandMm / 2100) * 75);
          const soilScore = Math.min(
            100,
            sim.soilCarbonDeltaTHa * 16 +
              Math.max(-20, sim.netNitrogenKgHa * 0.25) +
              sim.avgErosionProtection * 0.35 +
              uniqueFamilies * 4,
          );
          const yieldScore = Math.min(100, foodOrCashBonus + uniqueFamilies * 6 + sim.droughtResilienceIndex * 0.35);
          const climateScore = sim.droughtResilienceIndex * 0.55 + sim.heatAdaptationScore * 0.45;

          const objective =
            waterScore * wWater +
            soilScore * wSoil +
            yieldScore * wYield +
            climateScore * wClimate;

          if (objective > bestObjective) {
            bestObjective = objective;
            bestSequence = candidate;
          }
        }
      }
    }
  }

  return bestSequence;
}

export function evaluateAlertRules(
  rules: AlertRule[],
  summary: NasaTelemetrySummary,
  farmName: string,
  lang: Language = 'pt',
): AlertEvent[] {
  const nowLabel = new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const todayWord = lang === 'en' ? 'Today' : 'Hoje';
  const events: AlertEvent[] = [];

  for (const rawRule of rules) {
    if (!rawRule.enabled) continue;
    const rule = getLocalizedAlertRule(rawRule, lang);
    const value =
      rule.metric === 'topsoilWetnessPct'
        ? summary.avgTopsoilWetnessPct
        : summary[rule.metric];
    const triggered = rule.operator === 'lt' ? value < rule.threshold : value > rule.threshold;

    if (triggered) {
      const metricNames: Record<AlertRule['metric'], string> =
        lang === 'en'
          ? {
              topsoilWetnessPct: 'Topsoil Moisture (0–5 cm)',
              maxTempPeakC: 'Daily Heat Peak',
              waterDeficitMm: '30-Day Water Deficit',
              extremeRainDays: 'Extreme Rain Days',
            }
          : {
              topsoilWetnessPct: 'Umidade Superficial (0–5 cm)',
              maxTempPeakC: 'Pico Térmico Diário',
              waterDeficitMm: 'Déficit Hídrico 30d',
              extremeRainDays: 'Dias de Chuva Extrema',
            };

      events.push({
        id: `${rule.id}-${farmName}`,
        ruleId: rule.id,
        title: rule.title,
        severity: rule.severity,
        metricLabel: metricNames[rule.metric],
        observedValue: `${Number(value.toFixed(1))} ${rule.unit}`,
        thresholdLabel: `${rule.operator === 'lt' ? '<' : '>'} ${rule.threshold} ${rule.unit}`,
        timestamp: `${todayWord} · ${nowLabel}`,
        recommendation: rule.recommendation,
        status: 'ativo',
      });
    }
  }

  if (events.length === 0) {
    events.push({
      id: `nominal-${farmName}`,
      ruleId: 'nominal-check',
      title:
        lang === 'en'
          ? 'Climate Conditions Within Safe Range'
          : 'Parâmetros Climáticos Dentro da Faixa Segura',
      severity: 'informativo',
      metricLabel: lang === 'en' ? 'Water & Thermal Balance' : 'Balanço Hídrico e Térmico',
      observedValue:
        lang === 'en'
          ? `${summary.avgTopsoilWetnessPct.toFixed(1)} % moisture · ${summary.avgTempC.toFixed(1)} °C`
          : `${summary.avgTopsoilWetnessPct.toFixed(1)} % umidade · ${summary.avgTempC.toFixed(1)} °C`,
      thresholdLabel: lang === 'en' ? 'Within target thresholds' : 'Dentro das metas configuradas',
      timestamp: `${todayWord} · ${nowLabel}`,
      recommendation:
        lang === 'en'
          ? 'Keep current crop rotation plan and track cover-crop or localized drip windows in the dry season.'
          : 'Manter plano atual de rotação e acompanhar janela de cobertura ou rega localizada na entressafra.',
      status: 'ativo',
    });
  }

  return events;
}
