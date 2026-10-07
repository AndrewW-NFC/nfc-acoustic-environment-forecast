# NFC acoustic environment forecast

Compare conditional atmospheric absorption coefficients and model-derived recording-interference inputs for tonight and the next two nights. The app does not rate recording quality, predict bird activity or audibility, assume bird altitude, or recommend a recording window.

## What appears

- Conditional air-absorption coefficients at 2–10 kHz, expressed as dB/100 m at modeled near-surface conditions. These are not losses along actual bird-to-microphone paths.
- Weather-model wind and gusts at 10 m, with missing data explicit.
- Counts of returned hourly intervals containing precipitation (water equivalent, not precipitation phase or acoustic intensity).
- User-selected foliage/insect context and optional nearby mapped roads/airports.
- Expandable hourly details and TXT/JSON reports; historical CSV/JSON exports.

The main cards explain sound lost in the air, wind noise, and possible wet-weather noise in plain language. Calculations and hourly measurements sit inside Details. A night is described as having less or more near-ground absorption only when its complete hourly ranges separate from every other displayed night at every modeled frequency; this is not a recording-quality ranking. All outputs distinguish model estimates, conditional calculations and user settings. Nightly ranges show available-hour variation, not uncertainty bounds. No forecast is guaranteed accurate. See [acoustic-model.md](acoustic-model.md) for assumptions and schema details.

## Use

Open `index.html`, or run `python3 -m http.server 8000` and visit http://localhost:8000. No build or package installation is required. Internet access is needed for weather, twilight and map services.

Set coordinates/timezone (`auto` is supported), microphone height, and local foliage/insect settings. Microphone height defaults to 2 m and is saved as site information only; the app does not infer wind at that height. No caller height or distance is requested or assumed.

Map selection, approximate IP-based startup location and optional device location are supported. The device-location button explicitly invokes the browser permission flow. Forecasts do not predict migration; see BirdCast for that separate purpose.

## Data and tests

Weather: Open-Meteo forecast and historical model estimates. Night windows: sunrise-sunset.org astronomical twilight. Maps: Leaflet/OpenStreetMap. Optional roads/airports: OpenStreetMap Overpass and built-in airport fallback. No live traffic or flight activity is used.

Run `node --test tests/*.test.cjs`.

Version 3.2 removes the prior score/outlook, assumed source paths, best-hour and bending fields from exports. Coefficients are explicitly labeled `db_per_100m`. Historical exports are capped at 366 evening dates.

Completed-night precipitation retains the separate 18:00–06:00 local estimate shared with NFC Tools. Missing hours prevent a complete total. See [rainfall-contract.md](rainfall-contract.md).

## Future propagation research

The previous experimental module and notes are preserved in [research/experimental-v3.1](research/experimental-v3.1/README.md), excluded from the active app. Future altitude-informed modeling requires additional geometry and validation against recordings.

## Hosting and license

Static hosting, including GitHub Pages; no build command. MIT license, see [LICENSE](LICENSE).
