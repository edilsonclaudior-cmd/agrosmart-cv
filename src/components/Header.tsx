import React, { useState } from 'react';
import { Download, FileText, Languages, Menu, Sparkles, X } from 'lucide-react';
import type { Language } from '../types/agrosmart.ts';

export type WorkspaceTab = 'rotacao' | 'clima-alertas';

interface HeaderProps {
  lang: Language;
  onChangeLang: (lang: Language) => void;
  activeSection: string;
  onSelectView: (target: 'visao-geral' | WorkspaceTab) => void;
  onExportPlan: () => void;
  onDownloadPdf: () => void;
  onOpenAi: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onChangeLang,
  activeSection,
  onSelectView,
  onExportPlan,
  onDownloadPdf,
  onOpenAi,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: 'visao-geral' | WorkspaceTab; label: string }[] =
    lang === 'en'
      ? [
          { id: 'visao-geral', label: 'Home' },
          { id: 'rotacao', label: 'What to Plant' },
          { id: 'clima-alertas', label: 'Climate & Alerts' },
        ]
      : [
          { id: 'visao-geral', label: 'Início' },
          { id: 'rotacao', label: 'O que Plantar' },
          { id: 'clima-alertas', label: 'Clima e Alertas' },
        ];

  const handleLinkClick = (id: 'visao-geral' | WorkspaceTab) => {
    setMobileMenuOpen(false);
    onSelectView(id);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        <a
          href="#visao-geral"
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick('visao-geral');
          }}
          className="inline-flex items-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded"
          aria-label={lang === 'en' ? 'AgroSmart CV - Home' : 'AgroSmart CV - Início'}
        >
          {!logoFailed ? (
            <span className="inline-block overflow-hidden h-9">
              <img
                src="/assets/aistudio/Captura_de_ecr__2026-11-14_162213__1__6a2a4457.png"
                alt="AgroSmart CV"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="h-9 w-auto object-contain -ml-0.5"
              />
            </span>
          ) : (
            <span className="font-display text-xl font-bold tracking-tight text-emerald-950 whitespace-nowrap shrink-0">
              AgroSmart <span className="text-lime-600">CV</span>
            </span>
          )}
        </a>

        <nav
          aria-label={lang === 'en' ? 'Main navigation' : 'Navegação principal'}
          className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600"
        >
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick(item.id);
                }}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  isActive
                    ? 'border-emerald-700 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {/* PT / EN Language Toggle */}
          <div
            role="group"
            aria-label={lang === 'en' ? 'Language selector' : 'Seletor de idioma'}
            className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-md"
          >
            <Languages className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1 hidden sm:block" aria-hidden="true" />
            <button
              type="button"
              onClick={() => onChangeLang('pt')}
              aria-pressed={lang === 'pt'}
              className={`px-2 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                lang === 'pt'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PT
            </button>
            <button
              type="button"
              onClick={() => onChangeLang('en')}
              aria-pressed={lang === 'en'}
              className={`px-2 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                lang === 'en'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenAi}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-950 bg-lime-400 hover:bg-lime-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            {lang === 'en' ? 'AI' : 'IA'}
          </button>

          <button
            type="button"
            onClick={onDownloadPdf}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            {lang === 'en' ? 'PDF Guide' : 'Guia PDF'}
          </button>

          <button
            type="button"
            onClick={onExportPlan}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{lang === 'en' ? 'Export Plan' : 'Baixar Plano'}</span>
            <span className="sm:hidden">CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={
              mobileMenuOpen
                ? lang === 'en'
                  ? 'Close menu'
                  : 'Fechar menu'
                : lang === 'en'
                ? 'Open menu'
                : 'Abrir menu'
            }
            aria-expanded={mobileMenuOpen}
            className="md:hidden p-2 text-slate-700 hover:text-slate-900 rounded-md border border-slate-200 cursor-pointer"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Menu className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          aria-label={lang === 'en' ? 'Mobile menu' : 'Menu móvel'}
          className="md:hidden border-t border-slate-200 bg-white px-6 py-3 flex flex-col gap-1"
        >
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick(item.id);
              }}
              className={`py-2 text-sm font-medium ${
                activeSection === item.id ? 'text-emerald-800 font-semibold' : 'text-slate-700'
              }`}
            >
              {item.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenAi();
            }}
            className="py-2 text-left text-sm font-semibold text-emerald-800 inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {lang === 'en' ? 'Open AI Agronomist' : 'Abrir Agrónomo IA'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onDownloadPdf();
            }}
            className="py-2 text-left text-sm font-medium text-emerald-800"
          >
            {lang === 'en' ? 'Download PDF Guide' : 'Baixar Guia PDF'}
          </button>
        </nav>
      )}
    </header>
  );
};
