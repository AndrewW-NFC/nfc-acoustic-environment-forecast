# NFC acoustic environment forecast

A simple evening-by-evening planning tool for bird-call recording: a score out of 10, a one-word descriptor and the main source of possible noise. The September 21 score-card presentation is restored, with a narrower scoring model and the later missing-data corrections retained.

The score covers wind noise, precipitation noise, wind-driven leaf rustle and user-selected insect noise. Temperature, humidity, pressure, clouds, visibility and atmospheric absorption do not contribute. The index is a transparent planning heuristic, **not a validated prediction of recording clarity or detection probability**. It does not forecast migration or bird activity.

## Scoring

Each hour starts at 10 and loses points for possible masking noise. Wind and precipitation can each dominate a recording, so either can subtract up to 7 points; foliage subtracts up to 1 and insects up to 3. Scores stop at zero. Nightly scores average unrounded hourly scores and round once to the nearest half point. Numerical thresholds are design choices requiring future validation against recordings.

| Score | Label |
| --- | --- |
| 9–10 | Excellent |
| 8–8.5 | Great |
| 7–7.5 | Good |
| 6–6.5 | Fair |
| 5–5.5 | Marginal |
| 3–4.5 | Poor |
| 0–2.5 | Bad |

Calm foliage gets no penalty. Gusts and sustained wind share a single wind deduction. Any missing required weather value, or an interior hourly gap, prevents a nightly rating. Settings apply to all displayed nights, including historical nights. Microphone height is saved as site information only, without estimating wind at that height.

The main card shows the score, label, expectation and top acoustic issue. Night conditions, deductions and hourly inputs are expandable. TXT, JSON and historical CSV/JSON exports use the same scores. See [acoustic-model.md](acoustic-model.md) for exact scoring rules, evidence and limitations.

## Use

Open `index.html`, or run `python3 -m http.server 8000` and visit http://localhost:8000. No build or package installation is required. Internet access is needed for weather, twilight and map services.

Set your location, timezone and local foliage/insect conditions. Map selection, approximate IP-based startup location and optional device location are supported. The device-location button invokes the browser permission flow.

Weather: Open-Meteo forecast and historical model estimates. Night windows: sunrise-sunset.org astronomical twilight. Maps: Leaflet/OpenStreetMap. Optional nearby roads/airports are context only, never scored. Completed-night precipitation retains the separate 18:00–06:00 local estimate shared with NFC Tools; missing hours prevent a complete total. See [rainfall-contract.md](rainfall-contract.md).

Run `node --test tests/*.test.cjs`.

## Archived research

The altitude/refraction model remains in [research/experimental-v3.1](research/experimental-v3.1/README.md). Conditional absorption calculations are preserved in [research/conditional-v3.2](research/conditional-v3.2/README.md). Neither is loaded by the active app. Future propagation modeling needs source geometry and validation against recordings.

Static hosting, including GitHub Pages; no build command. MIT license, see [LICENSE](LICENSE).
