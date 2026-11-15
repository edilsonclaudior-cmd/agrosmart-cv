import { GoogleGenAI, Type } from '@google/genai';
import type {
  AlertEvent,
  CropSpecies,
  FarmLocation,
  IrrigationSystem,
  Language,
  NasaTelemetrySummary,
  RotationSimulationResult,
  SoilProfile,
} from '../src/types/agrosmart.ts';

export interface AiChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface AiFarmContext {
  farm: Pick<FarmLocation, 'id' | 'name' | 'region' | 'archipelagoGroup' | 'biome' | 'latitude' | 'longitude' | 'elevationM'>;
  soil: SoilProfile;
  irrigationSystem: IrrigationSystem;
  summary: NasaTelemetrySummary;
  currentCropIds: string[];
  simulation: Pick<
    RotationSimulationResult,
    'droughtResilienceIndex' | 'waterSavedMm' | 'waterSavedVsBaselinePct' | 'netNitrogenKgHa' | 'soilCarbonDeltaTHa' | 'avgErosionProtection' | 'seasonBreakdown'
  >;
  alerts: Pick<AlertEvent, 'title' | 'severity' | 'metricLabel' | 'observedValue' | 'recommendation'>[];
  availableCrops: Pick<CropSpecies, 'id' | 'name' | 'category' | 'irrigationMode' | 'waterDemandMm' | 'droughtTolerance' | 'erosionProtection' | 'nitrogenBalanceKgHa'>[];
}

export interface AiRotationRecommendation {
  summary: string;
  waterStrategy: string;
  soilStrategy: string;
  cropIds: string[];
}

const MODEL_NAME = 'gemini-4-hydrogen';

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('MISSING_GEMINI_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildAgronomistSystemInstruction(context: AiFarmContext, lang: Language): string {
  const languageDirective =
    lang === 'en'
      ? 'Respond strictly in clear, practical English tailored for farmers and agronomists in Cabo Verde.'
      : 'Responda sempre em Português claro, prático e acessível para agricultores e técnicos de Cabo Verde.';

  const modeLabel =
    context.irrigationSystem === 'sequeiro'
      ? 'Sequeiro (apenas água das chuvas)'
      : context.irrigationSystem === 'regadio'
      ? 'Regadio (gota-a-gota / irrigação localizada)'
      : 'Misto (época das águas em sequeiro + regadio na seca)';

  const cropSummaryList = context.availableCrops
    .map(
      (c) =>
        `${c.id} (${c.name}, ${c.irrigationMode}, água ${c.waterDemandMm}mm, seca ${c.droughtTolerance}/100, erosão ${c.erosionProtection}/100, N ${c.nitrogenBalanceKgHa >= 0 ? `+${c.nitrogenBalanceKgHa}` : c.nitrogenBalanceKgHa} kg/ha)`,
    )
    .join('\n');

  const currentPlan = context.simulation.seasonBreakdown
    .map((s, idx) => `${s.seasonLabel}: ${s.cropName} [${context.currentCropIds[idx] ?? s.family}]`)
    .join(' | ');

  const alertsText =
    context.alerts.length > 0
      ? context.alerts
          .map((a) => `- [${a.severity}] ${a.title} (${a.metricLabel}: ${a.observedValue})`)
          .join('\n')
      : 'Sem alertas críticos no momento.';

  return `Você é o Agrónomo IA do AgroSmart CV, especialista em agricultura de Cabo Verde (todas as 9 ilhas de Barlavento e Sotavento), sequeiro resiliente, regadio gota-a-gota, conservação de solos em encostas e interpretação prática das 6 missões da NASA usadas na plataforma (NASA POWER, SMAP, GPM & IMERG, Landsat/MODIS/VIIRS, ECOSTRESS e SRTM).

${languageDirective}

Regras de conduta:
1. Baseie todas as recomendações nos dados reais abaixo da ilha e talhão selecionados.
2. Dê conselhos objetivos, organizados em tópicos curtos, fáceis de aplicar no campo (ex.: cobertura morta/palha, curvas de nível/socalcos, rega gota-a-gota ao amanhecer ou fim de tarde, consorciação milho + feijão-congo/pedra, quebra-ventos contra o alísio/harmatão).
3. Quando citar culturas, dê preferência às do catálogo do AgroSmart CV abaixo.
4. Mantenha a resposta direta e concisa (idealmente entre 120 e 260 palavras, salvo se o utilizador pedir explicação detalhada).

CONTEXTO ATIVO DA PROPRIEDADE:
- Ilha / Região: ${context.farm.region} (${context.farm.archipelagoGroup}) — ${context.farm.name}
- Bioma: ${context.farm.biome}
- Coordenadas: ${context.farm.latitude.toFixed(4)}, ${context.farm.longitude.toFixed(4)} · Altitude SRTM: ${context.summary.srtmElevationM} m · Declive médio SRTM: ${context.summary.srtmMeanSlopePct}%
- Sistema de Cultivo: ${modeLabel}
- Solo Local: textura ${context.soil.texture}, matéria orgânica ${context.soil.organicMatterPct}%, pH ${context.soil.ph}, capacidade de água ${context.soil.waterRetentionCapacity} mm, erosão ${context.soil.erosionVulnerability}

TELEMETRIA NASA (Últimos 30 dias):
- Temperatura média (POWER): ${context.summary.avgTempC} °C (pico ${context.summary.maxTempPeakC} °C · ${context.summary.heatStressDays} dias >= 32 °C)
- Temperatura da superfície do solo (ECOSTRESS): ${context.summary.avgSurfaceTempC} °C · Evapotranspiração ET0: ${context.summary.cumulativeEt0Mm} mm
- Chuva acumulada (GPM/IMERG): ${context.summary.totalPrecipitationMm} mm · Dias extremos >=40mm: ${context.summary.extremeRainDays} · Déficit hídrico: ${context.summary.waterDeficitMm} mm
- Humidade do solo (SMAP): superficial ${context.summary.avgTopsoilWetnessPct}% · zona das raízes ${context.summary.avgRootZoneWetnessPct}%
- Vegetação (Landsat/VIIRS): NDVI ${context.summary.avgNdvi} · NDWI ${context.summary.avgNdwi} · Vento médio: ${context.summary.avgWindSpeedMs} m/s

ROTAÇÃO ATUAL NO SIMULADOR (4 ciclos):
- Sequência: ${currentPlan}
- Resiliência à seca: ${context.simulation.droughtResilienceIndex}/100 · Água poupada: ${context.simulation.waterSavedMm} mm (${context.simulation.waterSavedVsBaselinePct}%) · Saldo N: ${context.simulation.netNitrogenKgHa} kg/ha · Carbono: ${context.simulation.soilCarbonDeltaTHa} t/ha · Proteção erosão: ${context.simulation.avgErosionProtection}/100

ALERTAS ATIVOS:
${alertsText}

CATÁLOGO DISPONÍVEL NO AGROSMART CV:
${cropSummaryList}`;
}

export function formatGeminiError(err: unknown, lang: Language): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('MISSING_GEMINI_API_KEY')) {
    return {
      status: 503,
      message:
        lang === 'en'
          ? 'Gemini AI key is not configured yet. Please set your API key in Settings > Secrets to activate the AI Agronomist.'
          : 'A chave da IA Gemini ainda não está configurada. Defina a chave em Definições > Secrets para ativar o Agrónomo IA.',
    };
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message:
        lang === 'en'
          ? 'Gemini API key permission error. Please verify your key in Settings > Secrets.'
          : 'Erro de permissão na chave Gemini. Verifique a chave configurada em Definições > Secrets.',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        lang === 'en'
          ? 'AI request quota temporarily reached. Please wait a few moments and try again.'
          : 'Limite temporário de pedidos à IA atingido. Aguarde alguns segundos e tente novamente.',
    };
  }
  return {
    status: 500,
    message:
      lang === 'en'
        ? `Unable to reach the AI Agronomist right now: ${raw}`
        : `Não foi possível contactar o Agrónomo IA neste momento: ${raw}`,
  };
}

export async function streamAgronomistChat(params: {
  message: string;
  history: AiChatTurn[];
  context: AiFarmContext;
  lang: Language;
}) {
  const ai = createGeminiClient();
  const systemInstruction = buildAgronomistSystemInstruction(params.context, params.lang);

  const recentHistory = params.history.slice(-10).map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));

  const contents = [
    ...recentHistory,
    {
      role: 'user' as const,
      parts: [{ text: params.message }],
    },
  ];

  return ai.models.generateContentStream({
    model: MODEL_NAME,
    contents,
    config: {
      systemInstruction,
    },
  });
}

export async function recommendRotationWithAi(params: {
  context: AiFarmContext;
  lang: Language;
  goalNote?: string;
}): Promise<AiRotationRecommendation> {
  const ai = createGeminiClient();
  const systemInstruction = buildAgronomistSystemInstruction(params.context, params.lang);
  const validIds = new Set(params.context.availableCrops.map((c) => c.id));

  const modeFilteredIds = params.context.availableCrops
    .filter((c) => {
      if (params.context.irrigationSystem === 'sequeiro') {
        return c.irrigationMode === 'sequeiro' || c.irrigationMode === 'ambos';
      }
      if (params.context.irrigationSystem === 'regadio') {
        return c.irrigationMode === 'regadio' || c.irrigationMode === 'ambos';
      }
      return true;
    })
    .map((c) => c.id);

  const prompt =
    params.lang === 'en'
      ? `Analyze this Cabo Verde farm's NASA telemetry, soil, slope, and "${params.context.irrigationSystem}" farming mode. Choose the optimal 4-cycle rotation using ONLY crop IDs from this allowed list: [${modeFilteredIds.join(', ')}].${params.goalNote ? ` Farmer focus: ${params.goalNote}.` : ''} Ensure botanical family diversity (avoid repeating the same crop consecutively) and explain the water and soil strategy concisely in English.`
      : `Analise a telemetria NASA, solo, declive e o sistema "${params.context.irrigationSystem}" desta roça em Cabo Verde. Escolha a melhor rotação de 4 ciclos usando APENAS IDs desta lista permitida: [${modeFilteredIds.join(', ')}].${params.goalNote ? ` Foco do agricultor: ${params.goalNote}.` : ''} Garanta alternância de famílias botânicas (sem repetir culturas seguidas) e explique em Português de forma clara a estratégia de água e proteção do solo.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: 'Concise agronomic diagnosis for this island and current conditions (2-3 sentences).',
          },
          waterStrategy: {
            type: Type.STRING,
            description: 'Practical irrigation or rainfall capture advice based on NASA SMAP, GPM, and ECOSTRESS.',
          },
          soilStrategy: {
            type: Type.STRING,
            description: 'Soil fertility and erosion control advice based on SRTM slope and local texture.',
          },
          cropIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Exactly 4 valid crop IDs for Cycle 1 through Cycle 4.',
          },
        },
        required: ['summary', 'waterStrategy', 'soilStrategy', 'cropIds'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<AiRotationRecommendation>;
  const rawIds = Array.isArray(parsed.cropIds) ? parsed.cropIds : [];
  const sanitizedIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const candidate = rawIds[i];
    if (typeof candidate === 'string' && validIds.has(candidate)) {
      sanitizedIds.push(candidate);
    } else {
      sanitizedIds.push(
        contextFallbackCropId(i, params.context.irrigationSystem, modeFilteredIds, params.context.currentCropIds),
      );
    }
  }

  return {
    summary:
      parsed.summary?.trim() ||
      (params.lang === 'en'
        ? 'Rotation optimized for current island moisture and slope conditions.'
        : 'Rotação otimizada para a humidade e declive atuais da ilha.'),
    waterStrategy:
      parsed.waterStrategy?.trim() ||
      (params.lang === 'en'
        ? 'Use straw mulching and schedule drip cycles at dawn or dusk.'
        : 'Use cobertura de palha e programe regas ao amanhecer ou fim de tarde.'),
    soilStrategy:
      parsed.soilStrategy?.trim() ||
      (params.lang === 'en'
        ? 'Alternate legumes with deep-rooted crops and protect slopes.'
        : 'Alterne leguminosas com culturas de raiz profunda para segurar o solo.'),
    cropIds: sanitizedIds,
  };
}

function contextFallbackCropId(
  slotIdx: number,
  system: IrrigationSystem,
  allowed: string[],
  current: string[],
): string {
  const defaults =
    system === 'regadio'
      ? ['feijao-vagem', 'cebola-roxa', 'batata-doce', 'tomate-regadio']
      : system === 'sequeiro'
      ? ['milho-cabo-verde', 'feijao-congo', 'sorgo-granifero', 'batata-doce']
      : ['milho-cabo-verde', 'feijao-congo', 'tomate-regadio', 'batata-doce'];
  const pick = defaults[slotIdx] ?? current[slotIdx] ?? allowed[0] ?? 'feijao-congo';
  return allowed.includes(pick) ? pick : allowed[0] ?? 'feijao-congo';
}
