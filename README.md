# AgroSmart CV

**NASA Earth Observation Decision-Support Platform for Climate-Resilient Agriculture**

## Vision & Phased Roadmap
**Phase 1 — Cabo Verde (Current Focus):**  
AgroSmart CV was built first for **Cabo Verde**, covering all **9 inhabited islands** and **7 distinct agroecological zones in Santiago Island** (15 real farm locations). By focusing deeply on Cabo Verde's *sequeiro* (rainfed), *regadio gota-a-gota* (drip-irrigated), and *misto* farming realities step by step, the platform turns NASA satellite telemetry into practical decisions for local farmers and agronomists.

**Future Expansion — Step by Step:**  
Because our architecture uses live global NASA coordinates and a modular agronomic engine, our long-term goal is to expand gradually—region by region—to other semi-arid island nations, Sahelian communities, and climate-vulnerable agricultural zones worldwide.

## Key Features
- **4-Season Crop Rotation Simulator** across 17 Cabo Verdean crops with Drought Resilience Index, water savings, nitrogen balance, soil carbon, and erosion protection
- **Real-Time Climate, Map & Early Alerts** for drought, heat stress, and extreme rainfall
- **Bilingual Interface (Portuguese & English)** with downloadable **PDF** field guides and **CSV** plans
- **AI Agronomist** powered by server-side Gemini integration grounded in live farm telemetry

## NASA Data & Missions Integrated
- **NASA POWER Agroclimatology API** — Air & surface temperature, precipitation, solar radiation, relative humidity, and wind speed
- **NASA SMAP** — Topsoil and root-zone soil moisture
- **NASA GPM & IMERG** — Precipitation monitoring and extreme rain alerts
- **NASA Landsat (30m) & MODIS/VIIRS (250m)** — NDVI & NDWI vegetation and leaf-water indices
- **NASA ECOSTRESS** — Land surface temperature (LST) and reference evapotranspiration (ET₀)
- **NASA SRTM (30m)** — Terrain elevation and hillside slope erosion risk

## Tech Stack
- **Frontend:** TypeScript, React 19, Vite 8, Tailwind CSS v4, Lucide Icons, Motion, jsPDF
- **Backend:** Node.js, Express, Server-Sent Events (SSE), Google GenAI SDK
