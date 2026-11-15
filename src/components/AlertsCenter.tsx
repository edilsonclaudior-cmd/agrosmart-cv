import React, { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { getLocalizedAlertRule } from '../i18n/translations.ts';
import type {
  AlertEvent,
  AlertRule,
  AlertSeverity,
  Language,
  NasaTelemetrySummary,
} from '../types/agrosmart.ts';

interface AlertsCenterProps {
  lang: Language;
  summary: NasaTelemetrySummary;
  rules: AlertRule[];
  onToggleRule: (ruleId: string) => void;
  events: AlertEvent[];
  eventStatuses: Record<string, AlertEvent['status']>;
  onChangeEventStatus: (eventId: string, status: AlertEvent['status']) => void;
  notificationPermission: NotificationPermission | 'unsupported';
  onRequestNotifications: () => void;
  onTriggerTestNotification: () => void;
}

export const AlertsCenter: React.FC<AlertsCenterProps> = ({
  lang,
  summary,
  rules,
  onToggleRule,
  events,
  eventStatuses,
  onChangeEventStatus,
  notificationPermission,
  onRequestNotifications,
  onTriggerTestNotification,
}) => {
  const [filter, setFilter] = useState<'todos' | AlertSeverity>('todos');
  const isEn = lang === 'en';

  const filteredEvents = events.filter((ev) =>
    filter === 'todos' ? true : ev.severity === filter,
  );

  const waterRiskLevel =
    summary.waterDeficitMm > 45 || summary.avgTopsoilWetnessPct < 35
      ? 'elevado'
      : summary.waterDeficitMm > 25
      ? 'moderado'
      : 'baixo';
  const heatRiskLevel =
    summary.maxTempPeakC >= 34.5 || summary.heatStressDays >= 8
      ? 'elevado'
      : summary.maxTempPeakC >= 31.5
      ? 'moderado'
      : 'baixo';
  const erosionRiskLevel =
    summary.extremeRainDays >= 2
      ? 'elevado'
      : summary.extremeRainDays === 1
      ? 'moderado'
      : 'baixo';

  const renderRiskBadge = (level: 'baixo' | 'moderado' | 'elevado') => {
    if (level === 'elevado') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
          <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
          {isEn ? 'High Risk' : 'Risco Alto'}
        </span>
      );
    }
    if (level === 'moderado') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          {isEn ? 'Watch' : 'Atenção'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        {isEn ? 'Safe' : 'Seguro'}
      </span>
    );
  };

  return (
    <section id="alertas" className="pt-8 pb-4">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950 text-balance">
              {isEn ? 'Farm Alerts & Field Protection' : 'Avisos e Proteção da Roça'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {isEn
                ? 'Monitors dry spells, heat waves, and flash-flood erosion risk so you can act early.'
                : 'O sistema vigia falta de chuva, ondas de calor e risco de enxurrada para avisar você a tempo.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {notificationPermission !== 'granted' ? (
              <button
                type="button"
                onClick={onRequestNotifications}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                {isEn ? 'Enable Browser Alerts' : 'Ativar Avisos no Navegador'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onTriggerTestNotification}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
                {isEn ? 'Send Test Alert' : 'Testar Aviso Agora'}
              </button>
            )}
          </div>
        </div>

        {/* 3-Column Real-Time Risk Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 border border-slate-200 rounded-xl divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-white">
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-slate-500 block">
                {isEn ? 'Water Deficit' : 'Falta de Água'}
              </span>
              <span className="text-sm font-mono tabular-nums font-bold text-slate-900">
                {isEn ? 'Deficit' : 'Déficit'} {summary.waterDeficitMm.toFixed(0)} mm ·{' '}
                {isEn ? 'Soil' : 'Solo'} {summary.avgTopsoilWetnessPct.toFixed(0)}%
              </span>
            </div>
            {renderRiskBadge(waterRiskLevel)}
          </div>
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-slate-500 block">
                {isEn ? 'Heat Stress' : 'Calor Forte'}
              </span>
              <span className="text-sm font-mono tabular-nums font-bold text-slate-900">
                {isEn ? 'Peak' : 'Pico'} {summary.maxTempPeakC.toFixed(1)} °C · {summary.heatStressDays}{' '}
                {isEn ? 'days >= 32°C' : 'dias ≥ 32°C'}
              </span>
            </div>
            {renderRiskBadge(heatRiskLevel)}
          </div>
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-slate-500 block">
                {isEn ? 'Heavy Rain / Erosion' : 'Chuva Pesada / Erosão'}
              </span>
              <span className="text-sm font-mono tabular-nums font-bold text-slate-900">
                {summary.extremeRainDays} {isEn ? 'days >= 40 mm' : 'dias ≥ 40 mm'}
              </span>
            </div>
            {renderRiskBadge(erosionRiskLevel)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Active Alerts Feed */}
          <div className="lg:col-span-8 border border-slate-200 rounded-xl bg-white overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-base font-bold text-slate-900">
                {isEn
                  ? `What needs attention now (${filteredEvents.length})`
                  : `O que exige atenção agora (${filteredEvents.length})`}
              </h3>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {[
                  { id: 'todos' as const, label: isEn ? 'All' : 'Todos' },
                  { id: 'critico' as const, label: isEn ? 'Urgent' : 'Urgentes' },
                  { id: 'atencao' as const, label: isEn ? 'Watch' : 'Atenção' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      filter === tab.id
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredEvents.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  {isEn ? 'No alerts for the selected filter.' : 'Nenhum aviso para o filtro selecionado.'}
                </div>
              ) : (
                filteredEvents.map((ev) => {
                  const status = eventStatuses[ev.id] ?? ev.status;
                  return (
                    <div key={ev.id} className="p-5 bg-white">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {ev.severity === 'critico' && (
                              <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                                <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                                {isEn ? 'Urgent' : 'Urgente'}
                              </span>
                            )}
                            {ev.severity === 'atencao' && (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                                {isEn ? 'Watch' : 'Atenção'}
                              </span>
                            )}
                            {ev.severity === 'informativo' && (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                                <Info className="w-3.5 h-3.5" aria-hidden="true" />
                                {isEn ? 'All Clear' : 'Tudo Certo'}
                              </span>
                            )}
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-slate-600">
                              {ev.metricLabel}: <strong className="text-slate-900">{ev.observedValue}</strong>
                            </span>
                          </div>

                          <h4 className="font-display text-base font-bold text-slate-900">
                            {ev.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          {status !== 'resolvido' ? (
                            <button
                              type="button"
                              onClick={() => onChangeEventStatus(ev.id, 'resolvido')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              {isEn ? 'Mark Reviewed' : 'Marcar como Visto'}
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-slate-500">
                              {isEn ? 'Reviewed' : 'Visto'}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                        <strong className="text-slate-800">
                          {isEn ? 'What to do:' : 'O que fazer:'}
                        </strong>{' '}
                        {ev.recommendation}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Simple On/Off Watchers */}
          <div className="lg:col-span-4 border border-slate-200 rounded-xl p-5 bg-white space-y-4">
            <div className="pb-3 border-b border-slate-200">
              <h3 className="font-display text-base font-bold text-slate-900">
                {isEn ? 'Automated Watchers' : 'Vigias Automáticos'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEn
                  ? 'Choose which automatic alerts stay active for this island.'
                  : 'Escolha quais avisos deseja manter ligados para esta ilha.'}
              </p>
            </div>

            <div className="space-y-3">
              {rules.map((rawRule) => {
                const rule = getLocalizedAlertRule(rawRule, lang);
                return (
                  <div
                    key={rule.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900">{rule.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {isEn
                          ? `Auto alert (${rule.operator === 'lt' ? 'below' : 'above'} ${rule.threshold} ${rule.unit})`
                          : `Aviso automático (${rule.operator === 'lt' ? 'abaixo de' : 'acima de'} ${rule.threshold} ${rule.unit})`}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.enabled}
                      onClick={() => onToggleRule(rule.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        rule.enabled
                          ? 'bg-emerald-800 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {rule.enabled ? (isEn ? 'On' : 'Ligado') : isEn ? 'Off' : 'Desligado'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
