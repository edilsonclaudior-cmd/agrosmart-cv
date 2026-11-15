import { jsPDF } from 'jspdf';
import {
  BENCHMARK_FARMS,
  CROP_CATALOG,
  DEFAULT_ALERT_RULES,
} from '../data/cropsAndFarms.ts';
import type { FarmLocation, Language, NasaTelemetrySummary } from '../types/agrosmart.ts';

function sanitizeWinAnsi(text: string): string {
  return text
    .replace(/₀/g, '0')
    .replace(/₂/g, '2')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/→/g, '->')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/•/g, '*')
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '');
}

export function buildAgroSmartGuidePdf(options?: {
  selectedFarm?: FarmLocation;
  summary?: NasaTelemetrySummary;
  lang?: Language;
}): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 18;
  let y = 18;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > bottomLimit) {
      doc.addPage();
      y = 18;
    }
  };

  const addSectionTitle = (num: string, title: string) => {
    ensureSpace(16);
    y += 3;
    doc.setFillColor(6, 78, 59); // emerald-900
    doc.rect(marginX, y, 3, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(6, 78, 59);
    doc.text(sanitizeWinAnsi(`${num}. ${title}`), marginX + 6, y + 5.3);
    y += 11;
  };

  const addSubTitle = (title: string) => {
    ensureSpace(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizeWinAnsi(title), marginX, y);
    y += 5.5;
  };

  const addParagraph = (text: string, indent = 0) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(sanitizeWinAnsi(text), contentWidth - indent) as string[];
    const lineHeight = 4.6;
    for (const line of lines) {
      ensureSpace(lineHeight + 2);
      doc.text(line, marginX + indent, y);
      y += lineHeight;
    }
    y += 2;
  };

  const addBullet = (label: string, text: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(15, 23, 42);
    const full = sanitizeWinAnsi(`* ${label}: ${text}`);
    const lines = doc.splitTextToSize(full, contentWidth - 4) as string[];
    const lineHeight = 4.5;
    for (let i = 0; i < lines.length; i++) {
      ensureSpace(lineHeight + 2);
      if (i === 0) {
        const prefix = sanitizeWinAnsi(`* ${label}: `);
        const rest = lines[0].slice(prefix.length);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(6, 78, 59);
        doc.text(prefix, marginX + 2, y);
        const prefixW = doc.getTextWidth(prefix);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(rest, marginX + 2 + prefixW, y);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(lines[i], marginX + 5, y);
      }
      y += lineHeight;
    }
    y += 1.2;
  };

  const drawTable = (
    headers: string[],
    colWidths: number[],
    rows: string[][],
    fontSize = 8,
  ) => {
    const headerH = 7;
    const lineH = 3.8;

    const drawHeader = () => {
      ensureSpace(headerH + 8);
      doc.setFillColor(236, 253, 245); // emerald-50
      doc.setDrawColor(167, 243, 208);
      doc.rect(marginX, y, contentWidth, headerH, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      doc.setTextColor(6, 78, 59);
      let cx = marginX + 2;
      headers.forEach((h, i) => {
        doc.text(sanitizeWinAnsi(h), cx, y + 4.8);
        cx += colWidths[i];
      });
      y += headerH;
    };

    drawHeader();

    rows.forEach((row, rIdx) => {
      const wrappedCols = row.map((cell, cIdx) =>
        doc.splitTextToSize(sanitizeWinAnsi(cell), Math.max(10, colWidths[cIdx] - 3)) as string[],
      );
      const maxLines = Math.max(...wrappedCols.map((c) => c.length));
      const rowH = Math.max(6, maxLines * lineH + 2.6);

      if (y + rowH > bottomLimit) {
        doc.addPage();
        y = 18;
        drawHeader();
      }

      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentWidth, rowH, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX, y, contentWidth, rowH, 'S');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(30, 41, 59);

      let cx = marginX + 2;
      wrappedCols.forEach((lines, cIdx) => {
        if (cIdx === 0) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');
        lines.forEach((ln, lIdx) => {
          doc.text(ln, cx, y + 4 + lIdx * lineH);
        });
        cx += colWidths[cIdx];
      });

      y += rowH;
    });
    y += 4;
  };

  // ==================== COVER BANNER ====================
  doc.setFillColor(4, 47, 46); // deep emerald/teal
  const isEn = options?.lang === 'en';
  doc.rect(0, 0, pageWidth, 44, 'F');
  doc.setFillColor(132, 204, 22); // lime-500 accent strip
  doc.rect(0, 44, pageWidth, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('AgroSmart CV', marginX, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(190, 242, 100);
  doc.text(
    sanitizeWinAnsi(
      isEn
        ? 'Detailed Website Documentation & Satellite Agronomy Guide'
        : 'Explicação Detalhada do Website e Guia Agronómico por Satélite',
    ),
    marginX,
    25,
  );

  doc.setFontSize(8.8);
  doc.setTextColor(203, 213, 225);
  const generatedDate = new Date().toLocaleDateString(isEn ? 'en-US' : 'pt-PT');
  doc.text(
    sanitizeWinAnsi(
      isEn
        ? `All 9 Cabo Verde Islands · Rainfed & Irrigated · 6 Selected NASA Missions · Generated ${generatedDate}`
        : `Todas as 9 Ilhas de Cabo Verde · Sequeiro & Regadio · 6 Missões NASA Selecionadas · Gerado em ${generatedDate}`,
    ),
    marginX,
    35,
  );

  y = 54;

  // Live Context Box if passed
  if (options?.selectedFarm && options?.summary) {
    const f = options.selectedFarm;
    const s = options.summary;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(134, 239, 172);
    doc.roundedRect(marginX, y, contentWidth, 18, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(6, 78, 59);
    doc.text(
      sanitizeWinAnsi(
        isEn
          ? `Active Reading: ${f.region} (${f.name}) - ${f.archipelagoGroup}`
          : `Leitura Ativa no Momento: ${f.region} (${f.name}) - ${f.archipelagoGroup}`,
      ),
      marginX + 4,
      y + 6,
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(
      sanitizeWinAnsi(
        isEn
          ? `Avg Temp: ${s.avgTempC.toFixed(1)} °C | Soil Heat (ECOSTRESS): ${s.avgSurfaceTempC.toFixed(1)} °C | 30d Rain (GPM): ${s.totalPrecipitationMm.toFixed(0)} mm | SMAP Top/Root: ${s.avgTopsoilWetnessPct.toFixed(0)}% / ${s.avgRootZoneWetnessPct.toFixed(0)}% | SRTM Slope: ${s.srtmMeanSlopePct}%`
          : `Temp Média: ${s.avgTempC.toFixed(1)} °C | Calor Solo (ECOSTRESS): ${s.avgSurfaceTempC.toFixed(1)} °C | Chuva 30d (GPM): ${s.totalPrecipitationMm.toFixed(0)} mm | SMAP Sup/Raiz: ${s.avgTopsoilWetnessPct.toFixed(0)}% / ${s.avgRootZoneWetnessPct.toFixed(0)}% | Declive SRTM: ${s.srtmMeanSlopePct}%`,
      ),
      marginX + 4,
      y + 12.5,
    );
    y += 23;
  }

  if (isEn) {
    addSectionTitle('1', 'What AgroSmart CV Is and What It Solves');
    addParagraph(
      'AgroSmart CV is an interactive agricultural decision-support web platform tailored specifically for Cabo Verde. It transforms real Earth observations from 6 core NASA missions into clear, actionable crop rotation advice for farmers, extensionists, and cooperatives.',
    );
    addParagraph(
      'Across Cabo Verde, farming spans rainfed mountain slopes (dependent on brief August-November rains) and drip-irrigated valleys. The site organizes everything into two streamlined workspaces in both Portuguese and English.',
    );

    addSectionTitle('2', 'Navigation & Interface Structure');
    addBullet(
      'Top Header',
      'Displays the AgroSmart CV brand, quick links (Home, What to Plant, Climate & Alerts), a PT/EN language switcher, a PDF Guide button, and an Export Plan CSV button.',
    );
    addBullet(
      'All 9 Islands Archipelago Hero',
      'Interactive SVG map covering Barlavento and Sotavento, quick island selector buttons, real zone photography, and 3 live decision cards (Rain & Heat, Soil Moisture & Slope, and Today\'s Advice).',
    );
    addBullet(
      'Tab 1 - What to Plant (Rainfed & Irrigated)',
      'Choose Rainfed, Irrigated (Drip), or Mixed mode, set soil type and runoff risk, pick your top priority, and auto-optimize a 4-season crop rotation across 17 local crops.',
    );
    addBullet(
      'Tab 2 - Climate, Map & Alerts',
      'Includes the 4-plot interactive map (P-01 to P-04) with 5 satellite layers, a 30-day time-series chart, the 6 selected NASA missions for Cabo Verde, and automated browser alerts.',
    );

    addSectionTitle('3', 'Complete Coverage: All 9 Inhabited Islands');
    drawTable(
      ['Island', 'Group', 'Reference Zone', 'Elev.', 'Default Soil & Risk'],
      [28, 22, 54, 14, 60],
      BENCHMARK_FARMS.map((f) => [
        f.region,
        f.archipelagoGroup,
        f.name,
        `${f.elevationM}m`,
        `${f.defaultSoil.texture} | OM ${f.defaultSoil.organicMatterPct}% | Erosion ${f.defaultSoil.erosionVulnerability}`,
      ]),
      7.8,
    );

    addSectionTitle('4', 'Crop Rotation Simulator (17 Crops)');
    drawTable(
      ['Crop', 'Mode', 'Family', 'Cycle', 'Water', 'N Balance / Root'],
      [48, 22, 28, 16, 18, 46],
      CROP_CATALOG.map((c) => [
        c.name,
        c.irrigationMode === 'ambos' ? 'Both' : c.irrigationMode === 'regadio' ? 'Irrigated' : 'Rainfed',
        c.family,
        `${c.cycleDays}d`,
        `${c.waterDemandMm}mm`,
        `${c.nitrogenBalanceKgHa >= 0 ? '+' : ''}${c.nitrogenBalanceKgHa} kg/ha | ${c.rootDepthCm} cm`,
      ]),
      7.4,
    );

    addSectionTitle('5', '6 Selected NASA Missions for Cabo Verde');
    drawTable(
      ['NASA Mission', 'What It Measures', 'Why Chosen for Cabo Verde'],
      [38, 48, 92],
      [
        ['NASA POWER', 'Max/min temp, solar, wind, RH', 'Only NASA source with a live daily API across all 9 islands, filling weather-station gaps.'],
        ['NASA SMAP', 'Topsoil & root-zone moisture', 'Shows whether soil holds water after rains or between drip cycles before sowing.'],
        ['NASA GPM & IMERG', 'Daily rainfall & storm runoff', 'Island rain falls in brief intense bursts; tracks useful rain and alerts >= 40 mm/day.'],
        ['Landsat & MODIS/VIIRS', 'Plant vigor (NDVI) & NDWI', 'Tracks green cover between wet and dry seasons without daily site visits.'],
        ['NASA ECOSTRESS', 'Surface heat (LST) & ET0', 'Prevents heat stress in drip vegetables and signals when mulching is needed.'],
        ['NASA SRTM', 'Elevation & slope at 30 m', 'The islands are steeply mountainous; slope guides terraces and erosion-control crops.'],
      ],
      7.6,
    );

    addSectionTitle('6', 'Automated Farm Alerts');
    drawTable(
      ['Watcher', 'Trigger', 'Severity', 'Action'],
      [46, 32, 20, 80],
      DEFAULT_ALERT_RULES.map((r) => [
        r.title,
        `${r.operator === 'lt' ? 'Below' : 'Above'} ${r.threshold} ${r.unit}`,
        r.severity === 'critico' ? 'Urgent' : r.severity === 'atencao' ? 'Watch' : 'Info',
        r.recommendation,
      ]),
      7.5,
    );
  } else {
    // ==================== 1. VISAO GERAL ====================
    addSectionTitle('1', 'O que é e para que serve o AgroSmart CV');
    addParagraph(
      'O AgroSmart CV é uma plataforma web interativa de apoio à decisão agrícola concebida especificamente para a realidade de Cabo Verde. O seu objetivo é transformar observações reais da Terra obtidas por 6 missões essenciais da NASA em recomendações simples e práticas para agricultores, técnicos extensionistas e cooperativas.',
    );
    addParagraph(
      'Em Cabo Verde, a produção agrícola divide-se entre zonas altas e encostas de sequeiro (dependentes de chuvas curtas entre agosto e novembro) e vales ou hortas de regadio localizado (gota-a-gota). O website resolve a complexidade técnica dos dados espaciais organizando tudo em apenas duas áreas de trabalho fáceis de entender, com tradução instantânea entre Português e Inglês.',
    );

    // ==================== 2. ESTRUTURA DA INTERFACE ====================
    addSectionTitle('2', 'Estrutura Visual e Fluxo de Navegação do Website');
    addBullet(
      'Barra Superior (Header)',
      'Apresenta o logotipo AgroSmart CV sobre fundo branco limpo, três atalhos diretos (Início, O que Plantar, Clima e Alertas), o seletor de idioma PT/EN, o botão "Guia PDF" para descarregar esta documentação completa e o botão "Baixar Plano" para exportar a rotação de 4 ciclos em CSV.',
    );
    addBullet(
      'Secção Principal e Mapa das 9 Ilhas (Hero)',
      'Mostra um mapa SVG georreferenciado de todo o arquipélago dividido em Barlavento (Norte) e Sotavento (Sul), botões de seleção rápida para as 9 ilhas habitadas, fotografia real da zona agrícola escolhida e 3 cartões de síntese imediata: Chuva e Calor (30 dias), Estado da Terra e Declive, e Conselho de Hoje.',
    );
    addBullet(
      'Aba 1 - O que Plantar (Sequeiro & Regadio)',
      'Permite escolher o sistema hídrico (Só Sequeiro, Só Regadio ou Misto), ajustar o tipo de terra e o risco de enxurrada, definir a prioridade da roça e montar ou otimizar automaticamente uma sequência de 4 safras, comparando o resultado contra a monocultura tradicional.',
    );
    addBullet(
      'Aba 2 - Clima, Mapa e Alertas',
      'Reúne o mapa interativo das parcelas (P-01 a P-04) com 5 camadas de satélite, o gráfico diário dos últimos 30 dias, o painel com as 6 missões NASA escolhidas para Cabo Verde e a Central de Alertas com vigias automáticos e notificações no navegador.',
    );

    // ==================== 3. AS 9 ILHAS ====================
    addSectionTitle('3', 'Cobertura Completa: As 9 Ilhas Habitadas de Cabo Verde');
    addParagraph(
      'Cada ilha possui coordenadas geográficas reais, fotografia autêntica da sua paisagem agrícola e perfil inicial de solo (textura, matéria orgânica, pH, capacidade de retenção hídrica e vulnerabilidade à erosão):',
    );

    drawTable(
      ['Ilha', 'Grupo', 'Zona de Referência', 'Alt.', 'Solo Padrão & Risco'],
      [28, 22, 54, 14, 60],
      BENCHMARK_FARMS.map((f) => [
        f.region,
        f.archipelagoGroup,
        f.name,
        `${f.elevationM}m`,
        `${f.defaultSoil.texture} | MO ${f.defaultSoil.organicMatterPct}% | Erosão ${f.defaultSoil.erosionVulnerability}`,
      ]),
      7.8,
    );

    // ==================== 4. SEQUEIRO, REGADIO E 17 CULTURAS ====================
    addSectionTitle('4', 'Simulador de Rotação: Sequeiro, Regadio e 17 Culturas');
    addParagraph(
      'Na Aba 1, o agricultor segue 3 passos simples antes de visualizar os 4 ciclos sazonais (Ciclo 1 Águas, Ciclo 2 Pós-Águas, Ciclo 3 Época Seca e Ciclo 4 Águas Seguintes):',
    );
    addBullet(
      'Passo 1 - Sistema de Cultivo',
      '"Só Sequeiro (Chuva)" prioriza culturas rústicas resistentes à estiagem; "Só Regadio (Gota-a-gota)" foca em hortícolas de alto valor e vales irrigados; "Misto (Chuva + Regadio)" combina época das águas no sequeiro com hortícolas na seca.',
    );
    addBullet(
      'Passo 2 - Tipo de Terra e Risco de Enxurrada',
      'Ajusta os fatores hidráulicos entre terra barrenta (argilosa, fator 1.12), mista equilibrada (1.06), leve/solta (0.91) e arenosa (0.80), além da vulnerabilidade do terreno à erosão.',
    );
    addBullet(
      'Passo 3 - Prioridade Principal & Otimização Automática',
      'Ao clicar em "Sugerir Melhor Rotação Automática", o algoritmo testa combinações válidas dos 4 ciclos e escolhe a sequência que maximiza os pesos escolhidos pelo agricultor (Poupar Água, Recuperar Terra Fraca, Produzir Mais ou Aguentar Seca e Calor).',
    );

    addSubTitle('Catálogo Completo das 17 Culturas Integradas');
    drawTable(
      ['Cultura', 'Modo', 'Família', 'Ciclo', 'Água', 'Saldo N / Raiz'],
      [48, 22, 28, 16, 18, 46],
      CROP_CATALOG.map((c) => [
        c.name,
        c.irrigationMode === 'ambos' ? 'Ambos' : c.irrigationMode === 'regadio' ? 'Regadio' : 'Sequeiro',
        c.family,
        `${c.cycleDays}d`,
        `${c.waterDemandMm}mm`,
        `${c.nitrogenBalanceKgHa >= 0 ? '+' : ''}${c.nitrogenBalanceKgHa} kg/ha | ${c.rootDepthCm} cm`,
      ]),
      7.4,
    );

    addSubTitle('Como o Motor Agronómico Calcula o Ganho Real e a Projeção de 1 Ano');
    addBullet(
      'Quebra de Pragas e Diversidade Botânica',
      'Repetir a mesma espécie consecutivamente aplica penalização de -1.6 no índice de diversidade; repetir a mesma família botânica (ex: Tomate seguido de Batata Comum, ambos Solanaceae) aplica -0.85.',
    );
    addBullet(
      'Efeito de Cobertura Morta e Gota-a-Gota',
      'Culturas antecedentes de cobertura (Feijão-Bongolon, Batata-Doce, Milheto, Crotalária) reduzem em 13% (fator 0.87) a evaporação da cultura seguinte; o modo Regadio aplica ganho de eficiência hídrica localizada (fator 0.92).',
    );
    addBullet(
      'Integração Direta do Calor ECOSTRESS e Umidade SMAP',
      'Quando a temperatura da superfície do solo (ECOSTRESS LST) supera 31 °C, culturas sem cobertura sofrem penalização térmica; quando a umidade radicular (SMAP) é >= 42%, espécies de raiz profunda (>= 135 cm) recebem +6 pontos de resiliência à seca.',
    );
    addBullet(
      'Comparação Base e Curva de 12 Meses',
      'Os ganhos de água poupada (mm e %), adubo natural (kg/ha de N), proteção do solo (0-100) e a curva mensal (M1 a M12) comparam a rotação escolhida contra plantar apenas Milho (no sequeiro/misto) ou apenas Tomate (no regadio).',
    );

    // ==================== 5. MONITORAMENTO & 6 MISSOES NASA ====================
    addSectionTitle('5', 'Aba 2: Monitoramento e as 6 Missões NASA para Cabo Verde');
    addSubTitle('Mapa das Parcelas (P-01 a P-04) e Gráfico Diário de 30 Dias');
    addParagraph(
      'O talhonamento virtual divide a propriedade em 4 zonas típicas de Cabo Verde (P-01 Socalco Superior Norte, P-02 Regadio Gota-a-Gota, P-03 Fundo de Ribeira Sul e P-04 Encosta de Sequeiro Leste) com 5 camadas clicáveis: Saúde (NDVI), Água na Folha (NDWI), Solo SMAP, Calor (ECOSTRESS) e Relevo (SRTM).',
    );
    addParagraph(
      'O gráfico de 30 dias alterna entre "Chuva, Calor e Solo" (GPM, SMAP superficial e raiz, NASA POWER) e "Plantas & Evaporação" (NDVI Landsat/VIIRS e ET0).',
    );

    addSubTitle('Porquê Foram Escolhidas Apenas Estas 6 Missões da NASA');
    drawTable(
      ['Missão NASA', 'O que Mede', 'Porquê Foi Escolhida para Cabo Verde'],
      [38, 48, 92],
      [
        ['NASA POWER', 'Temp máx/mín, radiação, vento e ar', 'Única fonte NASA com API diária ao vivo para as 9 ilhas, suprindo falta de estações em cada vale.'],
        ['NASA SMAP', 'Umidade superficial e das raízes', 'Mostra se a terra ainda guarda água após as chuvas ou entre regas gota-a-gota antes da sementeira.'],
        ['NASA GPM & IMERG', 'Chuva diária e enxurradas', 'A chuva nas ilhas cai em poucos dias intensos; vigia a água útil e alerta acima de 40 mm/dia.'],
        ['Landsat & MODIS/VIIRS', 'Vigor (NDVI) e água foliar (NDWI)', 'Acompanha a cobertura verde entre as águas e a seca sem exigir visitas diárias ao terreno.'],
        ['NASA ECOSTRESS', 'Calor do solo (LST) e evaporação', 'Evita estresse térmico em hortícolas de regadio e indica quando cobrir o solo com palhada.'],
        ['NASA SRTM', 'Altitude e declive a 30 metros', 'As ilhas têm encostas íngremes; o declive orienta curvas de nível, socalcos e plantas protetoras.'],
      ],
      7.6,
    );

    addParagraph(
      'Foram removidos os conjuntos focados nos EUA e fontes redundantes para manter a plataforma simples, rápida e focada exclusivamente em Cabo Verde. O painel inclui também um botão direto para abrir imagens reais no NASA Worldview.',
    );

    // ==================== 6. ALERTAS ====================
    addSectionTitle('6', 'Central de Alertas e Vigias Automáticos');
    addParagraph(
      'O sistema avalia continuamente 4 regras configuráveis (ligadas ou desligadas individualmente) e pode enviar notificações nativas no navegador quando o utilizador autorizar:',
    );
    drawTable(
      ['Vigia Automático', 'Condição de Disparo', 'Gravidade', 'Recomendação Prática'],
      [46, 32, 20, 80],
      DEFAULT_ALERT_RULES.map((r) => [
        r.title,
        `${r.operator === 'lt' ? 'Abaixo de' : 'Acima de'} ${r.threshold} ${r.unit}`,
        r.severity === 'critico' ? 'Urgente' : r.severity === 'atencao' ? 'Atenção' : 'Informativo',
        r.recommendation,
      ]),
      7.5,
    );

    // ==================== 7. ARQUITETURA TECNICA ====================
    addSectionTitle('7', 'Arquitetura Técnica (Frontend + Express + Python FastAPI)');
    addBullet(
      'Frontend (React 19 + TypeScript + Vite + Tailwind CSS v4)',
      'Interface responsiva bilingue (PT/EN) com gráficos SVG vetoriais leves, mapa georreferenciado das 9 ilhas, motor agronómico local em tempo real e exportação CSV e PDF.',
    );
    addBullet(
      'Servidor Web e Proxy (server.ts - Node.js / Express na porta 3000)',
      'Serve a aplicação React e expõe os endpoints /api/health e /api/nasa/telemetry. Consulta diretamente a API oficial NASA POWER e o serviço de elevação SRTM, com fallback calibrado automático.',
    );
    addBullet(
      'Backend Python Opcional (fastapi_backend/main.py - FastAPI + httpx + Pydantic)',
      'Implementa os mesmos endpoints /api/health e /api/nasa/telemetry em Python assíncrono com os 6 feeds NASA para Cabo Verde.',
    );
  }

  // Add page numbers footer across all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      sanitizeWinAnsi(
        isEn
          ? 'AgroSmart CV - Technical Documentation & Cabo Verde Farming Guide'
          : 'AgroSmart CV - Documentação Técnica e Guia Agrícola de Cabo Verde',
      ),
      marginX,
      pageHeight - 8.5,
    );
    doc.text(
      isEn ? `Page ${p} of ${totalPages}` : `Página ${p} de ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 8.5,
      { align: 'right' },
    );
  }

  return doc;
}

export function downloadAgroSmartGuidePdf(options?: {
  selectedFarm?: FarmLocation;
  summary?: NasaTelemetrySummary;
  lang?: Language;
}): void {
  const doc = buildAgroSmartGuidePdf(options);
  const islandSuffix = options?.selectedFarm?.id ? `-${options.selectedFarm.id}` : '';
  const langSuffix = options?.lang === 'en' ? '-en' : '';
  doc.save(`AgroSmart_CV_Guide${islandSuffix}${langSuffix}.pdf`);
}
