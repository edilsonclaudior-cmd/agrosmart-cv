import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Droplets,
  Layers,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Sprout,
  X,
} from 'lucide-react';
import { CROP_CATALOG, DEFAULT_ROTATION_SLOTS } from '../data/cropsAndFarms.ts';
import { CROP_TRANSLATIONS_EN, FARM_BIOME_EN } from '../i18n/translations.ts';
import { getCropById } from '../lib/agronomyEngine.ts';
import type {
  AlertEvent,
  FarmLocation,
  IrrigationSystem,
  Language,
  NasaTelemetrySummary,
  RotationSimulationResult,
  SoilProfile,
} from '../types/agrosmart.ts';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface AiRotationResult {
  summary: string;
  waterStrategy: string;
  soilStrategy: string;
  cropIds: string[];
}

interface AiAgronomistProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  lang: Language;
  selectedFarm: FarmLocation;
  soil: SoilProfile;
  irrigationSystem: IrrigationSystem;
  summary: NasaTelemetrySummary;
  cropIds: string[];
  simulation: RotationSimulationResult;
  alerts: AlertEvent[];
  onApplyAiRotation: (nextCropIds: string[]) => void;
}

function renderInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function FormattedAiText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-slate-800">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-1" />;
        }
        if (line.startsWith('### ') || line.startsWith('## ')) {
          return (
            <h4 key={idx} className="font-display font-bold text-slate-950 pt-1">
              {line.replace(/^#{2,3}\s+/, '')}
            </h4>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
          const cleaned = line.replace(/^([-*]|\d+\.)\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-700 shrink-0" aria-hidden="true" />
              <span>{renderInlineBold(cleaned)}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInlineBold(line)}</p>;
      })}
    </div>
  );
}

export const AiAgronomist: React.FC<AiAgronomistProps> = ({
  isOpen,
  onOpen,
  onClose,
  lang,
  selectedFarm,
  soil,
  irrigationSystem,
  summary,
  cropIds,
  simulation,
  alerts,
  onApplyAiRotation,
}) => {
  const isEn = lang === 'en';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [goalNote, setGoalNote] = useState('');
  const [recommending, setRecommending] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<AiRotationResult | null>(null);
  const [appliedPlan, setAppliedPlan] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const regionLabel = isEn
    ? FARM_BIOME_EN[selectedFarm.id]?.region ?? selectedFarm.region
    : selectedFarm.region;

  const modeLabel = isEn
    ? irrigationSystem === 'sequeiro'
      ? 'Rainfed only'
      : irrigationSystem === 'regadio'
      ? 'Drip irrigated'
      : 'Mixed (Rainfed + Drip)'
    : irrigationSystem === 'sequeiro'
    ? 'Sequeiro (Chuva)'
    : irrigationSystem === 'regadio'
    ? 'Regadio (Gota-a-gota)'
    : 'Misto (Chuva + Regadio)';

  const farmContextPayload = useMemo(
    () => ({
      farm: {
        id: selectedFarm.id,
        name: selectedFarm.name,
        region: selectedFarm.region,
        archipelagoGroup: selectedFarm.archipelagoGroup,
        biome: selectedFarm.biome,
        latitude: selectedFarm.latitude,
        longitude: selectedFarm.longitude,
        elevationM: selectedFarm.elevationM,
      },
      soil,
      irrigationSystem,
      summary,
      currentCropIds: cropIds,
      simulation: {
        droughtResilienceIndex: simulation.droughtResilienceIndex,
        waterSavedMm: simulation.waterSavedMm,
        waterSavedVsBaselinePct: simulation.waterSavedVsBaselinePct,
        netNitrogenKgHa: simulation.netNitrogenKgHa,
        soilCarbonDeltaTHa: simulation.soilCarbonDeltaTHa,
        avgErosionProtection: simulation.avgErosionProtection,
        seasonBreakdown: simulation.seasonBreakdown,
      },
      alerts: alerts.map((a) => ({
        title: a.title,
        severity: a.severity,
        metricLabel: a.metricLabel,
        observedValue: a.observedValue,
        recommendation: a.recommendation,
      })),
      availableCrops: CROP_CATALOG.map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        irrigationMode: c.irrigationMode,
        waterDemandMm: c.waterDemandMm,
        droughtTolerance: c.droughtTolerance,
        erosionProtection: c.erosionProtection,
        nitrogenBalanceKgHa: c.nitrogenBalanceKgHa,
      })),
    }),
    [selectedFarm, soil, irrigationSystem, summary, cropIds, simulation, alerts],
  );

  const quickQuestions = useMemo(
    () =>
      isEn
        ? [
            `Analyze my current 4-cycle rotation for ${regionLabel}`,
            'How should I schedule drip irrigation to cut evaporation?',
            'Which cover crops best halt erosion on this slope?',
            'What do the NASA SMAP & ECOSTRESS numbers mean today?',
          ]
        : [
            `Analise o meu plano atual de 4 ciclos para ${regionLabel}`,
            'Como gerir o regadio gota-a-gota sem perder água para o calor?',
            'Que culturas seguram melhor a terra nesta encosta?',
            'O que indicam hoje os dados da NASA (SMAP e ECOSTRESS) aqui?',
          ],
    [isEn, regionLabel],
  );

  const sendMessage = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || streaming) return;

    setChatError(null);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const modelMsgId = `m-${Date.now() + 1}`;
    const historyForServer = messages.map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg, { id: modelMsgId, role: 'model', text: '' }]);
    setInput('');
    setStreaming(true);

    try {
      const resp = await fetch('/api/ai/agronomist/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyForServer,
          context: farmContextPayload,
          lang,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(
          (errBody as { error?: string }).error ||
            (isEn ? 'Failed to connect to AI Agronomist.' : 'Falha ao contactar o Agrónomo IA.'),
        );
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr) as {
              type: 'chunk' | 'done' | 'error';
              text?: string;
              message?: string;
            };
            if (event.type === 'chunk' && event.text) {
              setMessages((prev) =>
                prev.map((m) => (m.id === modelMsgId ? { ...m, text: m.text + event.text } : m)),
              );
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
              }
            } else if (event.type === 'error') {
              throw new Error(event.message || 'AI error');
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setChatError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== modelMsgId || m.text.trim().length > 0));
    } finally {
      setStreaming(false);
    }
  };

  const handleGenerateRecommendation = async () => {
    if (recommending) return;
    setRecommending(true);
    setRecommendError(null);
    setAppliedPlan(false);

    try {
      const resp = await fetch('/api/ai/recommend-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: farmContextPayload,
          lang,
          goalNote: goalNote.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(
          (data as { error?: string }).error ||
            (isEn ? 'Unable to generate AI rotation.' : 'Não foi possível gerar a rotação com IA.'),
        );
      }
      setRecommendation(data as AiRotationResult);
    } catch (err) {
      setRecommendError(err instanceof Error ? err.message : String(err));
    } finally {
      setRecommending(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={isEn ? 'Open AI Agronomist' : 'Abrir Agrónomo IA'}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 px-4 py-3 min-h-[46px] rounded-full bg-emerald-950 hover:bg-emerald-900 text-white shadow-xl border border-lime-400/50 transition-transform hover:scale-[1.02] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2"
      >
        <span className="w-7 h-7 rounded-full bg-lime-400 text-slate-950 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
        </span>
        <span className="text-xs sm:text-sm font-bold tracking-tight">
          {isEn ? 'AI Agronomist' : 'Agrónomo IA'}
        </span>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'AgroSmart CV AI Agronomist' : 'Agrónomo IA · AgroSmart CV'}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl max-h-[92vh] bg-slate-50 border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header Bar */}
        <div className="bg-white border-b border-slate-200 px-5 py-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <Sparkles className="w-4 h-4 text-lime-600" aria-hidden="true" />
                <span>{isEn ? 'AgroSmart CV AI Agronomist' : 'Agrónomo IA · AgroSmart CV'}</span>
              </div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950 mt-0.5">
                {isEn
                  ? `Smart Field Advisor for ${regionLabel}`
                  : `Assistente Agrícola Inteligente para ${regionLabel}`}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setChatError(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{isEn ? 'New Chat' : 'Nova Conversa'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label={isEn ? 'Close AI Agronomist' : 'Fechar Agrónomo IA'}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">{isEn ? 'Close' : 'Fechar'}</span>
              </button>
            </div>
          </div>

          {/* Unboxed Active Context Metadata Strip */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span>
              <strong className="text-slate-900">{regionLabel}</strong> ({selectedFarm.name})
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>
              {isEn ? 'Mode:' : 'Sistema:'} <strong className="text-slate-900">{modeLabel}</strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {isEn ? 'Rain 30d:' : 'Chuva 30d:'} <strong className="text-slate-900">{summary.totalPrecipitationMm.toFixed(0)} mm</strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              SMAP: <strong className="text-slate-900">{summary.avgTopsoilWetnessPct.toFixed(0)}%</strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              SRTM: <strong className="text-slate-900">{summary.srtmMeanSlopePct}%</strong>
            </span>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Conversational AI Agronomist */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/70">
            <h3 className="font-display text-base font-bold text-slate-900">
              {isEn ? 'Ask the AI Agronomist' : 'Conversar com o Agrónomo IA'}
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              {isEn ? 'Live NASA + Soil Context' : 'Contexto NASA + Solo Ativo'}
            </span>
          </div>

          {/* Quick Prompt Buttons */}
          <div className="p-4 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white">
            {quickQuestions.map((q) => (
              <button
                key={q}
                type="button"
                disabled={streaming}
                onClick={() => sendMessage(q)}
                className="text-left px-3 py-2.5 text-xs font-medium text-emerald-950 bg-emerald-50/70 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Conversation Messages */}
          <div
            ref={scrollContainerRef}
            aria-live="polite"
            className="p-5 space-y-4 min-h-[300px] max-h-[460px] overflow-y-auto bg-slate-50/40"
          >
            {messages.length === 0 ? (
              <div className="py-10 text-center space-y-2 max-w-md mx-auto">
                <Sprout className="w-8 h-8 text-emerald-700 mx-auto" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">
                  {isEn
                    ? `Ready to advise on ${selectedFarm.name}`
                    : `Pronto para analisar ${selectedFarm.name}`}
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isEn
                    ? 'Click any quick question above or type your own question below about planting dates, drip watering, heat protection, or crop pests.'
                    : 'Escolha uma pergunta rápida acima ou escreva a sua dúvida abaixo sobre datas de plantio, rega gota-a-gota, proteção contra calor ou pragas.'}
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-emerald-900 text-white text-sm leading-relaxed'
                        : 'bg-white border border-slate-200 text-slate-900 shadow-2xs'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      msg.text
                    ) : msg.text ? (
                      <FormattedAiText text={msg.text} />
                    ) : (
                      <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" aria-hidden="true" />
                        {isEn ? 'Analyzing satellite & soil data...' : 'A analisar dados da NASA e do solo...'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {chatError && (
            <div className="mx-5 mb-3 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{chatError}</span>
            </div>
          )}

          {/* Message Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="p-4 border-t border-slate-200 bg-white flex items-end gap-2.5"
          >
            <label htmlFor="ai-chat-input" className="sr-only">
              {isEn ? 'Ask the AI Agronomist' : 'Pergunte ao Agrónomo IA'}
            </label>
            <textarea
              id="ai-chat-input"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder={
                isEn
                  ? `Ask about ${regionLabel} crops, drip watering, or soil protection...`
                  : `Escreva a sua dúvida sobre ${regionLabel}, regadio, sequeiro ou proteção do solo...`
              }
              className="flex-1 resize-none px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              {streaming ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{isEn ? 'Send' : 'Enviar'}</span>
            </button>
          </form>
        </div>

        {/* Right: Structured AI Rotation Designer */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="pb-4 border-b border-slate-200">
            <h3 className="font-display text-base font-bold text-slate-950">
              {isEn ? 'AI 4-Cycle Rotation Planner' : 'Gerador de Plano de 4 Ciclos com IA'}
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              {isEn
                ? 'Generates an island-specific rotation plan from the 17-crop catalog and applies it directly to your simulator.'
                : 'Cria uma sequência de 4 ciclos adaptada a esta ilha e aplica-a diretamente no simulador.'}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="ai-goal-note" className="block text-xs font-semibold text-slate-700">
              {isEn ? 'Optional farm goal (e.g. cash vegetables, goat fodder, dry-spell safety):' : 'Objetivo opcional (ex.: venda em feira, forragem, poupar água):'}
            </label>
            <input
              id="ai-goal-note"
              type="text"
              value={goalNote}
              onChange={(e) => setGoalNote(e.target.value)}
              placeholder={
                isEn
                  ? 'e.g. Maximize drip-irrigated vegetable yield with low water loss'
                  : 'Ex.: Produzir hortícolas de feira com pouca perda de água'
              }
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <button
            type="button"
            disabled={recommending}
            onClick={handleGenerateRecommendation}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-slate-950 bg-lime-400 hover:bg-lime-300 disabled:bg-slate-200 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            {recommending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>{isEn ? 'Designing optimal plan...' : 'A calcular melhor rotação...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>{isEn ? 'Generate AI Rotation Plan' : 'Gerar Diagnóstico e Plano com IA'}</span>
              </>
            )}
          </button>

          {recommendError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{recommendError}</span>
            </div>
          )}

          {recommendation && (
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="space-y-2.5 text-xs leading-relaxed text-slate-700">
                <p className="text-slate-900 font-medium">{recommendation.summary}</p>
                <div className="flex items-start gap-2 pt-1">
                  <Droplets className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <p>
                    <strong className="text-slate-900">{isEn ? 'Water Strategy:' : 'Estratégia de Água:'}</strong>{' '}
                    {recommendation.waterStrategy}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Layers className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <p>
                    <strong className="text-slate-900">{isEn ? 'Soil Protection:' : 'Proteção do Solo:'}</strong>{' '}
                    {recommendation.soilStrategy}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/70">
                {recommendation.cropIds.map((id, idx) => {
                  const crop = getCropById(id);
                  const slot = DEFAULT_ROTATION_SLOTS[idx];
                  const cropName = isEn
                    ? CROP_TRANSLATIONS_EN[crop.id]?.name ?? crop.name
                    : crop.name;
                  return (
                    <div key={`${id}-${idx}`} className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-slate-500">
                        {isEn ? `Cycle ${idx + 1}` : slot?.label ?? `Ciclo ${idx + 1}`}
                      </span>
                      <span className="font-semibold text-slate-950">{cropName}</span>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  onApplyAiRotation(recommendation.cropIds);
                  setAppliedPlan(true);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors cursor-pointer"
              >
                {appliedPlan ? (
                  <>
                    <Check className="w-4 h-4 text-lime-300" aria-hidden="true" />
                    <span>{isEn ? 'Applied to Simulator' : 'Aplicado no Simulador'}</span>
                  </>
                ) : (
                  <span>{isEn ? 'Apply This Plan to Simulator' : 'Aplicar Este Plano no Simulador'}</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  </div>
  );
};
