import { useCallback, useEffect, useMemo, useState } from 'react';
import { CloudSun, Sprout } from 'lucide-react';
import { Header, type WorkspaceTab } from './components/Header.tsx';
import { HeroOverview } from './components/HeroOverview.tsx';
import { MonitoringConsole } from './components/MonitoringConsole.tsx';
import { RotationSimulator } from './components/RotationSimulator.tsx';
import { AlertsCenter } from './components/AlertsCenter.tsx';
import { AiAgronomist } from './components/AiAgronomist.tsx';
import { Footer } from './components/Footer.tsx';
import {
  BENCHMARK_FARMS,
  DEFAULT_ALERT_RULES,
  DEFAULT_ROTATION_SLOTS,
} from './data/cropsAndFarms.ts';
import { FARM_BIOME_EN } from './i18n/translations.ts';
import {
  evaluateAlertRules,
  optimizeRotationForFarm,
  simulateRotation,
} from './lib/agronomyEngine.ts';
import { downloadAgroSmartGuidePdf } from './lib/pdfGuideGenerator.ts';
import type {
  AlertEvent,
  AlertRule,
  FarmerPriorities,
  FarmLocation,
  IrrigationSystem,
  Language,
  NasaTelemetryResponse,
  NasaTelemetrySummary,
  SoilProfile,
} from './types/agrosmart.ts';

const FALLBACK_SUMMARY: NasaTelemetrySummary = {
  avgTempC: 26.8,
  avgSurfaceTempC: 29.1,
  maxTempPeakC: 32.6,
  heatStressDays: 5,
  totalPrecipitationMm: 48.2,
  rainReliabilityPct: 42,
  avgTopsoilWetnessPct: 39.4,
  avgRootZoneWetnessPct: 44.8,
  avgWindSpeedMs: 5.4,
  cumulativeEt0Mm: 142.0,
  waterDeficitMm: 93.8,
  avgNdvi: 0.56,
  avgNdwi: 0.02,
  extremeRainDays: 0,
  srtmElevationM: 320,
  srtmMeanSlopePct: 5.4,
};

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('agrosmart-lang');
      return saved === 'en' ? 'en' : 'pt';
    } catch {
      return 'pt';
    }
  });

  const [activeNav, setActiveNav] = useState<'visao-geral' | WorkspaceTab>('rotacao');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('rotacao');
  const [isAiOpen, setIsAiOpen] = useState(false);

  const [selectedFarm, setSelectedFarm] = useState<FarmLocation>(BENCHMARK_FARMS[0]);
  const [soil, setSoil] = useState<SoilProfile>(BENCHMARK_FARMS[0].defaultSoil);
  const [irrigationSystem, setIrrigationSystem] = useState<IrrigationSystem>('misto');
  const [priorities, setPriorities] = useState<FarmerPriorities>({
    waterConservation: 10,
    soilHealthCarbon: 7,
    yieldStability: 6,
    climateResilience: 9,
  });

  const [cropIds, setCropIds] = useState<string[]>(
    DEFAULT_ROTATION_SLOTS.map((s) => s.cropId),
  );

  const [telemetry, setTelemetry] = useState<NasaTelemetryResponse | null>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  const [rules, setRules] = useState<AlertRule[]>(DEFAULT_ALERT_RULES);
  const [eventStatuses, setEventStatuses] = useState<Record<string, AlertEvent['status']>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'));

  const isEn = lang === 'en';

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('agrosmart-lang', lang);
    } catch {
      // ignore storage errors
    }
  }, [lang]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const handleChangeLang = (nextLang: Language) => {
    setLang(nextLang);
    showToast(nextLang === 'en' ? 'Language switched to English.' : 'Idioma alterado para Português.');
  };

  const fetchTelemetry = useCallback(async (lat: number, lon: number) => {
    setLoadingTelemetry(true);
    try {
      const resp = await fetch(
        `/api/nasa/telemetry?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&days=30`,
      );
      if (!resp.ok) {
        throw new Error('Falha ao consultar dados climáticos.');
      }
      const data = (await resp.json()) as NasaTelemetryResponse;
      setTelemetry(data);
    } catch {
      // Uses calibrated summary silently if offline
    } finally {
      setLoadingTelemetry(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry(selectedFarm.latitude, selectedFarm.longitude);
  }, [fetchTelemetry, selectedFarm.latitude, selectedFarm.longitude]);

  const handleSelectFarm = (farm: FarmLocation) => {
    setSelectedFarm(farm);
    setSoil(farm.defaultSoil);
  };

  const effectiveSummary = telemetry?.summary ?? FALLBACK_SUMMARY;

  const simulation = useMemo(
    () => simulateRotation(cropIds, soil, priorities, effectiveSummary, irrigationSystem),
    [cropIds, soil, priorities, effectiveSummary, irrigationSystem],
  );

  const alertEvents = useMemo(
    () => evaluateAlertRules(rules, effectiveSummary, selectedFarm.name, lang),
    [rules, effectiveSummary, selectedFarm.name, lang],
  );

  const scrollToWorkspace = () => {
    const el = document.getElementById('workspace-tabs');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSelectView = (target: 'visao-geral' | WorkspaceTab) => {
    setActiveNav(target);
    if (target === 'visao-geral') {
      const el = document.getElementById('visao-geral');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setActiveTab(target);
    scrollToWorkspace();
  };

  const handleChangeIrrigationSystem = (nextSystem: IrrigationSystem) => {
    setIrrigationSystem(nextSystem);
    const optimal = optimizeRotationForFarm(soil, priorities, effectiveSummary, nextSystem);
    setCropIds(optimal);
    const label = isEn
      ? nextSystem === 'regadio'
        ? 'Irrigated (Drip)'
        : nextSystem === 'sequeiro'
        ? 'Rainfed (Rainfall)'
        : 'Mixed (Rainfed + Drip)'
      : nextSystem === 'regadio'
      ? 'Regadio (Gota-a-gota)'
      : nextSystem === 'sequeiro'
      ? 'Sequeiro (Chuva)'
      : 'Misto (Sequeiro + Regadio)';
    showToast(
      isEn ? `Plan updated for ${label} mode.` : `Plano ajustado para o sistema ${label}.`,
    );
  };

  const handleOptimize = () => {
    const optimal = optimizeRotationForFarm(soil, priorities, effectiveSummary, irrigationSystem);
    setCropIds(optimal);
    showToast(
      isEn
        ? 'Best crop rotation calculated for your farm.'
        : 'Melhor sequência de rotação calculada para a sua roça.',
    );
  };

  const handleOptimizeFromPlot = () => {
    handleOptimize();
    setActiveTab('rotacao');
    setActiveNav('rotacao');
    scrollToWorkspace();
  };

  const handleResetDefault = () => {
    setIrrigationSystem('misto');
    setCropIds(DEFAULT_ROTATION_SLOTS.map((s) => s.cropId));
    showToast(
      isEn ? 'Sequence restored to default plan.' : 'Sequência restaurada para o plano inicial.',
    );
  };

  const handleExportPlan = () => {
    const headers = isEn
      ? ['Cycle', 'Crop', 'Family', 'Water_mm', 'Nitrogen_kg_ha', 'Carbon_t_ha', 'Climate_Risk']
      : ['Ciclo', 'Cultura', 'Familia', 'Agua_mm', 'Saldo_N_kg_ha', 'Carbono_t_ha', 'Risco_Climatico'];
    const rows = simulation.seasonBreakdown.map((r) => [
      r.seasonLabel,
      r.cropName,
      r.family,
      String(r.waterDemandMm),
      String(r.nitrogenDeltaKgHa),
      r.carbonDeltaTHa.toFixed(2),
      r.climateRisk,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agrosmart-cv-rotation-plan-${selectedFarm.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(isEn ? 'Rotation plan exported as CSV.' : 'Plano de rotação exportado em CSV.');
  };

  const handleRequestNotifications = async () => {
    if (typeof Notification === 'undefined') {
      showToast(
        isEn
          ? 'This browser does not support native notifications.'
          : 'Este navegador não suporta notificações nativas.',
      );
      return;
    }
    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      new Notification(isEn ? 'AgroSmart CV · Alerts Enabled' : 'AgroSmart CV · Alertas Ativados', {
        body: isEn
          ? `Monitoring active for ${selectedFarm.name}.`
          : `Monitoramento ativo para ${selectedFarm.name}.`,
      });
      showToast(
        isEn ? 'Automatic notifications enabled.' : 'Notificações automáticas habilitadas.',
      );
    } else {
      showToast(
        isEn ? 'Notification permission not granted.' : 'Permissão de notificação não concedida.',
      );
    }
  };

  const handleTriggerTestNotification = () => {
    const topAlert = alertEvents[0];
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && topAlert) {
      new Notification(`AgroSmart CV · ${topAlert.title}`, {
        body: `${topAlert.metricLabel}: ${topAlert.observedValue}. ${topAlert.recommendation}`,
      });
    }
    showToast(
      isEn
        ? `Alert sent: ${topAlert?.title ?? 'Normal Conditions'}`
        : `Aviso enviado: ${topAlert?.title ?? 'Condições Normais'}`,
    );
  };

  const handleDownloadPdf = () => {
    downloadAgroSmartGuidePdf({
      selectedFarm,
      summary: effectiveSummary,
      lang,
    });
    const regionLabel = isEn
      ? FARM_BIOME_EN[selectedFarm.id]?.region ?? selectedFarm.region
      : selectedFarm.region;
    showToast(
      isEn
        ? `Complete PDF guide downloaded for ${regionLabel}.`
        : `Guia completo em PDF baixado para ${regionLabel}.`,
    );
  };

  const activeAlertsCount = alertEvents.filter((e) => e.severity !== 'informativo').length;
  const selectedRegionLabel = isEn
    ? FARM_BIOME_EN[selectedFarm.id]?.region ?? selectedFarm.region
    : selectedFarm.region;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        lang={lang}
        onChangeLang={handleChangeLang}
        activeSection={activeNav}
        onSelectView={handleSelectView}
        onExportPlan={handleExportPlan}
        onDownloadPdf={handleDownloadPdf}
        onOpenAi={() => setIsAiOpen(true)}
      />

      <main className="flex-1">
        <HeroOverview
          lang={lang}
          farms={BENCHMARK_FARMS}
          selectedFarm={selectedFarm}
          onSelectFarm={handleSelectFarm}
          telemetry={telemetry}
          loading={loadingTelemetry}
        />

        {/* Elevated 2-Tab Workspace */}
        <div id="workspace-tabs" className="max-w-[1240px] mx-auto px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-200/80 rounded-xl">
              {[
                {
                  id: 'rotacao' as const,
                  label: isEn
                    ? '1. What to Plant (Rainfed & Irrigated)'
                    : '1. O que Plantar (Sequeiro & Regadio)',
                  icon: Sprout,
                },
                {
                  id: 'clima-alertas' as const,
                  label:
                    activeAlertsCount > 0
                      ? isEn
                        ? `2. Climate, Map & Alerts (${activeAlertsCount})`
                        : `2. Clima, Mapa e Alertas (${activeAlertsCount})`
                      : isEn
                      ? '2. Climate, Map & Alerts'
                      : '2. Clima, Mapa e Alertas',
                  icon: CloudSun,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setActiveNav(tab.id);
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-950 text-white shadow-sm font-semibold'
                        : 'text-slate-700 hover:bg-white/70 hover:text-slate-950'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-lime-400' : 'text-emerald-800'}`} aria-hidden="true" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <span className="text-xs text-slate-600 font-medium">
              {selectedFarm.archipelagoGroup} · <strong className="text-slate-950">{selectedRegionLabel}</strong> ({selectedFarm.name})
            </span>
          </div>

          {activeTab === 'rotacao' && (
            <RotationSimulator
              lang={lang}
              soil={soil}
              onChangeSoil={setSoil}
              irrigationSystem={irrigationSystem}
              onChangeIrrigationSystem={handleChangeIrrigationSystem}
              priorities={priorities}
              onChangePriorities={setPriorities}
              cropIds={cropIds}
              onChangeCropIds={setCropIds}
              onOptimize={handleOptimize}
              onResetDefault={handleResetDefault}
              simulation={simulation}
            />
          )}

          {activeTab === 'clima-alertas' && (
            <div className="space-y-8">
              <MonitoringConsole
                lang={lang}
                soil={soil}
                telemetry={telemetry}
                loading={loadingTelemetry}
                onOptimizeFromPlot={handleOptimizeFromPlot}
              />

              <AlertsCenter
                lang={lang}
                summary={effectiveSummary}
                rules={rules}
                onToggleRule={(id) =>
                  setRules((prev) =>
                    prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
                  )
                }
                events={alertEvents}
                eventStatuses={eventStatuses}
                onChangeEventStatus={(id, status) =>
                  setEventStatuses((prev) => ({ ...prev, [id]: status }))
                }
                notificationPermission={notificationPermission}
                onRequestNotifications={handleRequestNotifications}
                onTriggerTestNotification={handleTriggerTestNotification}
              />
            </div>
          )}
        </div>
      </main>

      <Footer
        lang={lang}
        onSelectView={handleSelectView}
        onOpenAi={() => setIsAiOpen(true)}
      />

      <AiAgronomist
        isOpen={isAiOpen}
        onOpen={() => setIsAiOpen(true)}
        onClose={() => setIsAiOpen(false)}
        lang={lang}
        selectedFarm={selectedFarm}
        soil={soil}
        irrigationSystem={irrigationSystem}
        summary={effectiveSummary}
        cropIds={cropIds}
        simulation={simulation}
        alerts={alertEvents}
        onApplyAiRotation={(nextIds) => {
          setCropIds(nextIds);
          setActiveTab('rotacao');
          setActiveNav('rotacao');
          setIsAiOpen(false);
          showToast(
            isEn
              ? 'AI-recommended 4-cycle rotation applied to your simulator.'
              : 'Rotação sugerida pela IA aplicada no simulador.',
          );
        }}
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 right-5 z-50 max-w-sm px-4 py-3 bg-slate-900 text-white text-xs font-medium rounded-lg shadow-lg border border-slate-700"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
