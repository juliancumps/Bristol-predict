# Bristol Predict BETA 4.0🐟


Real-time salmon harvest data visualization and historical analysis for the Bristol Bay sockeye salmon fishery.

## Overview

Bristol Predict is a comprehensive web application designed for commercial fishermen and data enthusiasts to explore Bristol Bay's sockeye salmon fishery data. The platform provides interactive maps, real-time catch visualization, historical trend analysis, and comparative benchmarking tools to help users understand the complex dynamics of the fishery.

## Features

### Core Tools

Interactive Map - Click on districts to explore historical and current catch data from Naknek-Kvichak, Egegik, Ugashik, Nushagak, and Togiak regions

Multi-District Charts - Line and bar charts displaying daily catch trends across all districts for selected dates or date ranges

Pie Chart Distribution - Visual breakdown of catch by district to identify which zones are performing on any given date

Historical Trends - Visualize sockeye per delivery metrics across seasons and years to understand long-term patterns and seasonal variations

Catch Efficiency Analyzer - Enter your delivery data and benchmark your catch performance against district averages

Weather Dashboard - Live NOAA weather data, tidal predictions, wind and wave maps from Windy.com, and temperature forecasts

More Salmon Harvest Data - State-wide and region-specific data visualization with interactive Tableau dashboards for comprehensive analysis

### Data Access

Complete Historical Context - Access to three seasons of backfilled data (2023-2025) with long-term pattern analysis

Real-time Data Integration - Automatically pulls the latest data from Alaska Department of Fish and Game (ADF&G) daily

Benchmark Your Performance - Compare your catch data against district averages to understand your position in the fishery

## V4: data updates, new tools, phone layout

New tools (in "More Tools"):
- Openings & Announcements - district status board read from the ADF&G announcement PDFs, with boat counts, a replay control, and the full announcement feed. Direct link: `/?view=openings`
- Escapement & Forecast - river escapement against the ADF&G goal ranges, and the run against the preseason forecast. Direct link: `/?view=escapement`

How the data stays current (no cost):
- `.github/workflows/update-data.yml` runs on GitHub Actions. In June-August it runs every 30 minutes. It reads the ADF&G run summary and announcement list, saves new data in `backend/data`, and commits it. The backend host then redeploys with the new data.
- To run it by hand: GitHub > Actions > "Update fishery data" > Run workflow (choose `update`, `backfill`, `backfill-rivers` or `reparse`).

Backend commands (in `backend/`):
```
npm run update            # new run-summary days + new announcements
npm run backfill          # read every day of every season again (about 8 minutes)
npm run backfill:rivers   # only days that have no river data
npm test                  # parser tests (no network)
```

Notes:
- The scraper uses plain HTTP (axios + cheerio). Puppeteer is no longer used.
- `POST /api/refresh` needs the `x-admin-token` header. Set `ADMIN_TOKEN` in the backend host variables; with no token set, the endpoint is off.
- Reference data (escapement goals, forecasts) is in `backend/data/reference/*.json`. Add each new forecast there once a year.
- To go back to the version before V4: `git checkout v3-before-v4 -- .`

## Tech Stack

Frontend
- React with Vite for fast development and optimized production builds
- Leaflet for interactive mapping functionality
- Recharts for data visualization and charting
- Tailwind CSS for responsive UI styling
- Lucide React for consistent icon system

Backend
- Node.js with Express for API server
- SQLite for data persistence
- Axios for HTTP requests
- CORS enabled for secure cross-origin requests

Data Visualization
- Tableau Public for advanced dashboard analytics
- GeoJSON for geographic data layers

Deployment & Infrastructure
- Vite build tooling for optimized production bundles
- Responsive design for desktop and mobile devices

## Installation

1. Clone the repository
   ```
   git clone <repository-url>
   cd bristol-predict
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file in the root directory (if needed for API keys or configuration)

4. Start the development server
   ```
   npm run dev
   ```

The application will be available at `http://localhost:5173`

## Project Structure

```
bristol-predict/
├── src/
│   ├── components/
│   │   ├── BristolBayMap.jsx        - Main interactive map for Bristol Bay
│   │   ├── SoutheastMap.jsx         - Southeast Alaska region visualization
│   │   ├── CatchEfficiencyScreen.jsx - Catch benchmarking tool
│   │   ├── RunTimingTracker.jsx     - Run timing visualization
│   │   ├── EnvironmentalDashboard.jsx - Weather and environmental data
│   │   ├── ToolsHub.jsx             - Navigation hub for all tools
│   │   ├── SplashScreen.jsx         - Initial landing screen
│   │   └── HtmlOverlay.jsx          - HTML content overlay
│   ├── styles/
│   │   ├── BristolBayMap.css
│   │   ├── SoutheastMap.css
│   │   └── [other component styles]
│   ├── App.jsx                      - Main application component
│   └── App.css
├── public/
│   ├── geojson/                     - Geographic data files
│   └── images/
├── backend/                         - Node.js/Express server
├── index.html
├── vite.config.js
└── tailwind.config.js
```

## Data Sources

Alaska Department of Fish and Game (ADF&G) - Official fishery management data and daily catch reports

Port Moller Test Fishery - Indicator data for seasonal patterns

NOAA - Weather and marine condition data

Windy.com - Wind and wave forecasting

## Usage

1. Launch the application and navigate through the splash screen to access the tools hub

2. Select from available visualization tools:
   - Bristol Bay Map - Explore district-level data
   - Southeast Alaska Map - View state-wide and regional data
   - Catch Efficiency Analyzer - Input your catch data for comparison
   - Run Timing Tracker - Monitor species timing patterns
   - Environmental Dashboard - Check weather and environmental conditions

3. Interactive map features:
   - Click on districts to zoom and view detailed data
   - Use zoom controls to adjust map view
   - Hover over regions for quick data previews

4. Data filtering and analysis:
   - Select date ranges to view historical data
   - Use comparative tools to benchmark your performance
   - Export or share findings as needed

## Development

To make changes to the project:

1. Install dependencies: `npm install`

2. Start development server: `npm run dev`

3. Edit components in `src/components/` and styles in `src/styles/`

4. Changes will hot-reload in the browser

5. Build for production: `npm run build`

## Design System

The application follows a cohesive design system inspired by Bristol Bay's ocean environment:

Color Palette:
- Midnight Blue (#0a1428) - Primary background
- Deep Ocean (#0f2a48) - Secondary backgrounds
- Accent Blue Bright (#3b9ff3) - Interactive elements and highlights
- Sunset Gold (#f4a460) - Warm accents
- Sunset Coral (#ff6b6b) - Alerts and emphasis

Typography:
- Crimson Text (serif) - Headers and titles
- Inter (sans-serif) - Body text and UI elements

The interface features subtle animated gradients and a professional aesthetic designed for both functionality and visual appeal.

## Roadmap

Completed
- Phase 1: Basic map visualization
- Phase 2: Data scraping and integration
- Phase 3: Time-series visualization
- Phase 4: Multi-tool dashboard system

In Progress
- Enhanced data filtering and aggregation
- Advanced analytics features

Planned
- Machine learning predictions
- Production deployment and optimization
- Mobile app development

## License

Bristol Predict is built with care for the Bristol Bay fishing community. See LICENSE file for details.

## Support

For questions, issues, or feature requests, please reach out through the appropriate channels or submit an issue in the project repository.

## Credits

Built with React, Vite, Leaflet, Recharts, Node.js, Express, and SQLite. Designed and developed with a deep respect for Bristol Bay and its fishing heritage.