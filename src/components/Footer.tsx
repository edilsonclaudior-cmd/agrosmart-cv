import React, { useState } from 'react';
import type { Language } from '../types/agrosmart.ts';
import type { WorkspaceTab } from './Header.tsx';

interface FooterProps {
  lang: Language;
  onSelectView: (target: 'visao-geral' | WorkspaceTab) => void;
  onOpenAi: () => void;
}

export const Footer: React.FC<FooterProps> = ({ lang, onSelectView, onOpenAi }) => {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <footer className="bg-white border-t border-slate-200 py-8">
      <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-xs text-slate-600">
        <div className="flex flex-col gap-1.5 max-w-xl">
          <div className="flex flex-wrap items-center gap-2.5">
            {!logoFailed ? (
              <span className="inline-block overflow-hidden h-6">
                <img
                  src="/assets/aistudio/Captura_de_ecr__2026-11-14_162213__1__6a2a4457.png"
                  alt="AgroSmart CV"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoFailed(true)}
                  className="h-6 w-auto object-contain -ml-0.5"
                />
              </span>
            ) : (
              <span className="font-display font-bold text-emerald-950">AgroSmart CV</span>
            )}
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="font-medium text-slate-800">
              {lang === 'en'
                ? 'Cultivating resilience alongside Cabo Verde’s farmers'
                : 'A cultivar resiliência lado a lado com quem trabalha a terra em Cabo Verde'}
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-slate-500">
            {lang === 'en'
              ? 'Built to support rural families and local agronomists across all 9 islands — turning NASA satellite insights into clear, everyday planting decisions.'
              : 'Criado para apoiar famílias rurais, agricultores e técnicos nas 9 ilhas — transformando dados de satélites da NASA em decisões simples para o dia a dia no campo.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6 shrink-0">
          <button
            type="button"
            onClick={() => onSelectView('visao-geral')}
            className="hover:text-slate-900 transition-colors cursor-pointer"
          >
            {lang === 'en' ? 'Home' : 'Início'}
          </button>
          <button
            type="button"
            onClick={() => onSelectView('rotacao')}
            className="hover:text-slate-900 transition-colors cursor-pointer"
          >
            {lang === 'en' ? 'What to Plant' : 'O que Plantar'}
          </button>
          <button
            type="button"
            onClick={() => onSelectView('clima-alertas')}
            className="hover:text-slate-900 transition-colors cursor-pointer"
          >
            {lang === 'en' ? 'Climate & Alerts' : 'Clima e Alertas'}
          </button>
          <button
            type="button"
            onClick={onOpenAi}
            className="font-semibold text-emerald-800 hover:text-emerald-950 transition-colors cursor-pointer"
          >
            {lang === 'en' ? 'AI Agronomist' : 'Agrónomo IA'}
          </button>
        </div>
      </div>
    </footer>
  );
};
