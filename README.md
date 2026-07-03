# NFC acoustic environment forecast

Score hourly weather data for sound clarity and propagation—the acoustic environment for nocturnal flight call recording.

The tool can be opened, used, and bookmarked from the GitHub Pages version: https://andreww-nfc.github.io/nfc-acoustic-environment-forecast/

This is a small, static browser tool for nocturnal flight call recordists who want to know whether a night is likely to produce clean audio, blurred spectrograms, wind noise, rain masking, weak high-frequency detail, or other acoustic issues that affect call detection and identification.

It does **not** forecast bird activity or migration. Use BirdCast or other migration tools for that. This tool only estimates the recording environment.

## What it does

The tool evaluates weather and local site conditions that can affect nocturnal flight call audio quality.

It can:

* Score upcoming nights for acoustic recording quality.
* Show recent observed conditions for comparison.
* Identify the best hour or hours within a night.
* Explain likely recording issues such as wind, precipitation, humidity, fog, foliage noise, or insect noise.
* Provide ID cautions when acoustic conditions may blur call structure.
* Export forecasts as TXT or JSON.
* Export historical acoustic scores as CSV or JSON.
* Include optional hourly rows in historical exports.
* Show optional human-made noise context from major roads and runway corridors.

The score is meant to help answer questions like:

* Is tonight worth recording?
* Which hours are likely to be cleanest?
* Will weak or distant calls be hard to identify?
* Are conditions likely to preserve high-frequency detail?
* How did last night compare with tonight?
* Which nights in a date range had the best acoustic environment?

## What it does not do

This tool does **not** predict:

* Bird movement.
* Migration intensity.
* Species composition.
* Flight altitude.
* Whether birds will call.
* Whether a recorder will detect a given species.

A high score means the acoustic environment is favorable for recording. It does not mean birds will be moving or vocalizing.

## How to use

Open `index.html` in a browser.

Enter:

1. **Latitude**
2. **Longitude**
3. **Timezone**

The timezone field can use `auto` or an IANA timezone value such as:

```text
America/New_York
```

You can also click the map or drag the marker to set latitude and longitude. Map selection requires an internet connection.

On page load, the tool makes a no-prompt IP geolocation request and uses the resulting city-level coordinates as the initial map location. Approximate coordinates are displayed with two decimal places and clearly labeled. If the lookup is unavailable, the built-in default remains in place. A location chosen or typed while the lookup is pending is never overwritten.

For an exact recorder site, adjust the map or coordinates manually, or select **Use my precise location**. Precise browser location is opt-in and only requests permission after the button is selected. Manual and precise coordinates are displayed with five decimal places.

Then set local noise conditions:

* **Foliage**

  * Minimal / open site
  * Light / sparse trees
  * Moderate / leafed-out trees nearby
  * Heavy / dense trees near mic

* **Insects**

  * Low / not noticeable
  * Moderate / audible insects
  * Heavy / dense insect chorus

Optionally enable **Check human-made noise context**. This adds road and aircraft context, but it is not included in the acoustic score.

Click **Generate forecast**.

## Running locally

Because this is a static app, there is no build step and no package install.

Clone the repo:

```bash
git clone https://github.com/AndrewW-NFC/nfc-acoustic-environment-forecast.git
cd nfc-acoustic-environment-forecast
```

Then open `index.html` directly in a browser.

For a local web server, run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

A local server is useful when testing browser behavior that may be restricted for local files.

## Outputs

The forecast output includes summary cards for upcoming nights, plus acoustic guidance for each night.

Depending on available data, output may include:

* Overall acoustic score.
* Score descriptor.
* Expected recording quality.
* Best hour.
* Main acoustic concerns.
* ID cautions.
* Night conditions.
* Factor-level score effects.
* Downloadable TXT and JSON exports.

The observed section gives recent acoustic context using past weather data.

The historical export tool can produce nightly acoustic scoring across an evening-date range. Browser exports are capped at 366 nights per file.

Historical exports can include:

* One summary row per night.
* Optional hourly rows.
* CSV or JSON output.

## Scoring model

Each hour starts from a 5.0 baseline, meaning usable but acoustically compromised.

Favorable conditions add points. Unfavorable conditions subtract points. The result is clamped between 0.0 and 10.0, then rounded to the nearest 0.5 for display.

| Displayed score | Descriptor |
| --------------: | ---------- |
|        9.0–10.0 | Excellent  |
|         8.0–8.5 | Very Good  |
|         7.0–7.5 | Good       |
|         6.0–6.5 | Fair       |
|         5.0–5.5 | Marginal   |
|         3.0–4.5 | Poor       |
|         1.5–2.5 | Very Poor  |
|         0.0–1.0 | Unusable   |

### Scored factors

| Factor        | Score effect range | Why it matters                                                                                                                                 |
| ------------- | -----------------: | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface Wind  |       +1.4 to −1.4 | Wind noise, microphone rumble, and movement of nearby material can mask distant calls.                                                         |
| Precipitation |       +1.0 to −1.0 | Rain and sleet add broadband masking.                                                                                                          |
| Humidity      |     +0.55 to −0.55 | Very dry air can weaken high-frequency detail. Very humid air can coincide with haze, fog, condensation, or a higher noise floor.              |
| Visibility    |     +0.45 to −0.45 | Haze and fog can indicate acoustic attenuation and reduced distance clarity.                                                                   |
| Cloud Cover   |     +0.30 to −0.30 | Cloud conditions are used as a proxy for sound confinement and overnight stability.                                                            |
| Pressure      |     +0.30 to −0.30 | Pressure near 1020–1029 hPa is treated as favorable. Low pressure or extremely high pressure can signal less favorable propagation conditions. |
| Temperature   |     +0.25 to −0.25 | Seasonal temperature fit affects stability and phase-transition risk.                                                                          |
| Foliage Noise |     +0.40 to −0.40 | Leafed-out vegetation near the recorder can add rustle and broadband masking.                                                                  |
| Insect Noise  |     +0.35 to −0.35 | Insect bands and pulses can overlap nocturnal flight-call frequencies and mask spectrogram structure.                                          |

## Data sources

The app uses browser-side requests to public data sources.

Weather data comes from Open-Meteo. Ten-meter wind is used directly, and near-ground wind is estimated from the same profile. Visibility uses API data when available; otherwise, it is estimated from precipitation and cloud cover.

Night windows use astronomical twilight from sunrise-sunset.org.

The historical export uses Open-Meteo historical weather data.

Map selection uses Leaflet.

Approximate startup location comes from the free Country API, using IP-derived city-level data. The service receives the visitor's IP address but states that it does not log requests. No precise browser geolocation permission is requested.

Human-made noise context is shown separately from the acoustic score. Road traffic context is estimated from nearby major OpenStreetMap roads. Aircraft context is estimated from nearby mapped or built-in major airports and runway alignment. The tool does not use live or scheduled flight data.

## Customization

The scoring model is configured inside `index.html`.

The main configuration block is `SEASONAL_CONFIG`. It includes defaults tuned for fall and spring migration in temperate North America.

You can adjust:

* Seasonal temperature minimum.
* Seasonal temperature maximum.
* Ideal seasonal temperature center.
* Expected average wind.
* Expected average humidity.
* Expected average cloud cover.
* Foliage-related wind weighting.

The current model version is shown in the app footer and stored in the `MODEL_VERSION` constant.

## Limitations

This is a practical field-planning tool, not a validated physical acoustics model.

Important limitations:

* It estimates the recording environment, not bird activity.
* Local noise settings depend on the user’s knowledge of the site.
* Human-made noise context is approximate.
* Road noise depends on traffic volume, pavement, terrain, barriers, and time of night.
* Aircraft noise depends on live flight activity, runway use, altitude, aircraft type, and routing.
* Visibility may be estimated when API visibility data is unavailable.
* Weather forecasts can change.
* Microphone placement, gain, recorder settings, nearby vegetation, buildings, terrain, insects, and water all affect real recordings.

Use the score as decision support, not as a guarantee.

## Repository structure

```text
.
├── index.html
└── LICENSE
```

## Deployment

This project can be hosted as a static site.

For GitHub Pages, enable Pages for the repository and serve from the branch and folder that contain `index.html`.

No build command is required.

## License

MIT License.

See `LICENSE` for details.
