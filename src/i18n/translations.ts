import type {
  AlertRule,
  CropCategory,
  EarthObservationFeedId,
  Language,
} from '../types/agrosmart.ts';

export const CROP_TRANSLATIONS_EN: Record<
  string,
  { name: string; agronomicNote: string }
> = {
  'feijao-congo': {
    name: 'Pigeon Pea (Feijão-Congo)',
    agronomicNote:
      'Key Cabo Verde legume; deep taproot breaks dry soil, fixes nitrogen, and tolerates short rains.',
  },
  'feijao-caupi': {
    name: 'Cowpea (Feijão-Pedra)',
    agronomicNote:
      'Fast-cycle legume for rainfed plots or between irrigated vegetables; restores nitrogen in under 3 months.',
  },
  'feijao-bongolon': {
    name: 'Lablab Bean (Bongolon)',
    agronomicNote:
      'Traditional on Cabo Verde slopes; dense canopy shields soil from dry trade winds and locks in moisture.',
  },
  milho: {
    name: 'Rainfed Maize (Milho)',
    agronomicNote:
      'Staple island grain, but vulnerable when rains fail; rotate with legumes and sorghum to cut risk.',
  },
  sorgo: {
    name: 'Grain & Forage Sorghum',
    agronomicNote:
      'Strong maize substitute during dry or hot spells, delivering both grain and livestock fodder.',
  },
  'batata-doce': {
    name: 'Terrace Sweet Potato',
    agronomicNote:
      'Thrives in cool rainfed highlands and drip beds; trailing vines cover soil and stop terrace runoff.',
  },
  mandioca: {
    name: 'Hardy Cassava',
    agronomicNote:
      'Drought-resilient food reserve across the islands, keeping ground covered through the dry transition.',
  },
  milheto: {
    name: 'Pearl Millet (Milheto)',
    agronomicNote:
      'Withstands intense heat and dry winds while producing fast biomass mulch to protect topsoil.',
  },
  crotalaria: {
    name: 'Sunn Hemp (Green Manure)',
    agronomicNote:
      'Rebuilds tired soil and suppresses nematodes ahead of irrigated tomato, potato, or cabbage.',
  },
  girassol: {
    name: 'Drought-Tolerant Sunflower',
    agronomicNote:
      'Breaks maize and bean pest cycles while tapping deeper subsoil moisture reserves.',
  },
  tomate: {
    name: 'Tomato (Drip Irrigated)',
    agronomicNote:
      'High-value drip crop in Santiago and Santo Antão; rotate with onion and beans to prevent soil diseases.',
  },
  cebola: {
    name: 'Onion / Garlic (Irrigated)',
    agronomicNote:
      'Ideal follow-up after tomato or potato since its distinct family helps cleanse irrigated beds.',
  },
  repolho: {
    name: 'Cabbage / Kale (Irrigated)',
    agronomicNote:
      'Fast cool-valley irrigated brassica that captures residual nitrogen left behind by beans.',
  },
  'batata-comum': {
    name: 'Irish Potato (Irrigated / Highland)',
    agronomicNote:
      'Common in cool valleys (São Jorge, Fajã, Santo Antão); never plant right after tomato.',
  },
  cenoura: {
    name: 'Carrot / Beet (Irrigated)',
    agronomicNote:
      'Moderate-cycle root crop suited to drip lines that interrupts solanaceous and brassica pests.',
  },
  pimentao: {
    name: 'Bell / Chili Pepper (Irrigated)',
    agronomicNote:
      'Handles heat better than tomato under drip irrigation; pair with straw mulch along ridges.',
  },
  'banana-cana': {
    name: 'Banana / Sugarcane (Irrigated Valley)',
    agronomicNote:
      'Signature crop of humid valleys and ribeiras (Paul, Santiago, São Nicolau); high biomass anchors slopes.',
  },
};

export const FARM_BIOME_EN: Record<string, { biome: string; region: string }> = {
  'santiago-cv': { biome: 'Central Basin · Rainfed & Irrigated', region: 'Santiago' },
  'santiago-santa-cruz': { biome: 'Coastal Valley & Dam · Intensive Drip Irrigation', region: 'Santiago' },
  'santiago-assomada': { biome: 'Humid Highland Plateau · Rainfed & Potato Slopes', region: 'Santiago' },
  'santiago-tarrafal': { biome: 'Northern Valley · Drip-Irrigated Vegetables', region: 'Santiago' },
  'santiago-sao-miguel': { biome: 'Eastern Valley · Banana, Vegetables & Rainfed', region: 'Santiago' },
  'santiago-sao-domingos': { biome: 'Southern Highland Basin · Rainfed & Terraces', region: 'Santiago' },
  'santiago-ribeira-grande': { biome: 'Southern Dry Valley · Oasis & Localized Drip', region: 'Santiago' },
  'santo-antao-cv': { biome: 'Sub-Humid Mountain Terraces', region: 'Santo Antão' },
  'sao-vicente-cv': { biome: 'Windward Valley · Drip & Oasis', region: 'São Vicente' },
  'sao-nicolau-cv': { biome: 'Agricultural Valley · Rainfed & Irrigated', region: 'São Nicolau' },
  'sal-cv': { biome: 'Localized Drip · Arid Coastal Zone', region: 'Sal Island' },
  'boa-vista-cv': { biome: 'Oasis Palm Grove & Horticulture', region: 'Boa Vista' },
  'maio-cv': { biome: 'Arid Coastal Plain · Rainfed & Drip', region: 'Maio Island' },
  'fogo-cv': { biome: 'Highland Volcanic Slopes', region: 'Fogo Island' },
  'brava-cv': { biome: 'Mist-Fed Humid Highlands', region: 'Brava Island' },
};

export const PLOT_TRANSLATIONS_EN: Record<
  string,
  { name: string; currentCrop: string }
> = {
  'talhao-a': {
    name: 'Upper North Terrace',
    currentCrop: 'Maize + Pigeon Pea Intercrop',
  },
  'talhao-b': {
    name: 'Drip-Irrigated Plot',
    currentCrop: 'Sweet Potato + Straw Mulch',
  },
  'talhao-c': {
    name: 'South Valley Floor',
    currentCrop: 'Cowpea + Lablab Bean',
  },
  'talhao-d': {
    name: 'East Rainfed Slope',
    currentCrop: 'Sorghum + Contour Barrier',
  },
};

export const NASA_FEED_EN: Record<
  EarthObservationFeedId,
  {
    name: string;
    resolution: string;
    parameters: string;
    whyChosenForCv: string;
    detail: string;
  }
> = {
  'nasa-power': {
    name: 'NASA POWER',
    resolution: 'Daily · Cabo Verde',
    parameters: 'Max/min air temperature, solar radiation, wind, and humidity',
    whyChosenForCv:
      'Only NASA source with a direct daily API across all 9 islands, filling local weather-station gaps.',
    detail: 'Live NASA agroclimatic time series calibrated for this island.',
  },
  smap: {
    name: 'NASA SMAP',
    resolution: '2–3 days · Soil',
    parameters: 'Topsoil moisture (0–5 cm) and root-zone water reserve',
    whyChosenForCv:
      'Shows whether soil still holds water after rains or between drip cycles before planting.',
    detail: 'Detects early soil moisture deficits to guide rainfed and drip scheduling.',
  },
  'gpm-imerg': {
    name: 'NASA GPM & IMERG',
    resolution: 'Daily · Rainfall',
    parameters: 'Accumulated rainfall, rain reliability, and storm runoff',
    whyChosenForCv:
      'In Cabo Verde, rain falls in brief intense bursts; tracks useful rain and flash-runoff risk.',
    detail: 'Monitors rainfall distribution reliability with automatic alerts >= 40 mm/day.',
  },
  'landsat-modis-viirs': {
    name: 'NASA Landsat & MODIS/VIIRS',
    resolution: '30 m (Landsat) · 250 m (VIIRS)',
    parameters: 'Vegetation vigor (NDVI) and leaf water stress (NDWI)',
    whyChosenForCv:
      'Tracks green cover between wet and dry seasons without daily field visits.',
    detail: 'Maps plot vegetation vigor and highlights bare soil exposed to dry winds.',
  },
  ecostress: {
    name: 'NASA ECOSTRESS',
    resolution: '70 m · Heat & ET',
    parameters: 'Land surface temperature (LST) and evapotranspiration (ET0)',
    whyChosenForCv:
      'Crucial to prevent heat stress in drip-irrigated vegetables and decide when mulching is needed.',
    detail: 'Measures bare-soil heating and daily crop water loss across the islands.',
  },
  srtm: {
    name: 'NASA SRTM (Topography Radar)',
    resolution: '30 m · Terrain',
    parameters: 'True elevation and slope steepness of terraces and hillsides',
    whyChosenForCv:
      'The islands are steeply mountainous; slope dictates where terraces and soil-holding crops are required.',
    detail: 'Guides contour lines across Santo Antão, Santiago, Fogo, São Nicolau, and Brava.',
  },
};

export const ALERT_RULE_EN: Record<
  string,
  { title: string; recommendation: string; unit?: string }
> = {
  'rule-moisture-low': {
    title: 'Critical Topsoil Moisture Deficit',
    recommendation:
      'Keep dense straw cover (Lablab or Pearl Millet) and apply mulch on terraces to reduce wind evaporation.',
  },
  'rule-heat-wave': {
    title: 'High Canopy Thermal Stress',
    recommendation:
      'Switch rainfed maize to Sorghum or Pigeon Pea and shift sowing windows to capture early rain moisture.',
  },
  'rule-water-deficit': {
    title: 'Cumulative 30-Day Water Deficit',
    recommendation:
      'Prioritize drip irrigation and deep-rooted crops (>140 cm) resilient to Cabo Verde dry spells.',
  },
  'rule-extreme-rain': {
    title: 'Torrential Rain Erosion Risk',
    unit: 'days > 40mm',
    recommendation:
      'Reinforce stone retention walls, contour ridges, and vegetative strips on steeper slopes (P-04).',
  },
};

export function getCategoryLabel(cat: CropCategory, lang: Language): string {
  const pt: Record<CropCategory, string> = {
    leguminosa: 'Enriquece a terra (Leguminosa)',
    graminea: 'Grão / Forragem (Gramínea)',
    cobertura: 'Protege o solo (Cobertura)',
    oleaginosa: 'Quebra pragas (Oleaginosa)',
    horticola: 'Hortícola de Regadio',
    fruticultura: 'Vale Regado / Perene',
  };
  const en: Record<CropCategory, string> = {
    leguminosa: 'Soil Enricher (Legume)',
    graminea: 'Grain / Forage (Grass)',
    cobertura: 'Soil Shield (Cover Crop)',
    oleaginosa: 'Pest Breaker (Oilseed)',
    horticola: 'Irrigated Vegetable',
    fruticultura: 'Irrigated Valley / Perennial',
  };
  return lang === 'en' ? en[cat] : pt[cat];
}

export function getIrrigationBadge(
  mode: 'sequeiro' | 'regadio' | 'ambos',
  lang: Language,
): string {
  if (lang === 'en') {
    if (mode === 'sequeiro') return 'Rainfed (Rainfall)';
    if (mode === 'regadio') return 'Irrigated (Drip)';
    return 'Rainfed & Irrigated';
  }
  if (mode === 'sequeiro') return 'Sequeiro (Chuva)';
  if (mode === 'regadio') return 'Regadio (Gota-a-gota)';
  return 'Sequeiro e Regadio';
}

export function getLocalizedAlertRule(rule: AlertRule, lang: Language): AlertRule {
  if (lang === 'pt') return rule;
  const tr = ALERT_RULE_EN[rule.id];
  if (!tr) return rule;
  return {
    ...rule,
    title: tr.title,
    recommendation: tr.recommendation,
    unit: tr.unit ?? rule.unit,
  };
}
