# Acoustic conditions v3.2

This release reports conditional absorption coefficients and factual model inputs. It does not assign recording-quality categories, identify a best recording window, predict call audibility or spectrogram detail, assume bird height/distance, or calculate refraction. No forecast is guaranteed accurate.

## Conditional absorption

`acoustics.js` implements ISO 9613-1 pure-tone atmospheric absorption at 2, 4, 6, 8 and 10 kHz using weather-model 2 m temperature, 2 m relative humidity, and surface pressure. Temperature is converted to kelvin; pressure ratio uses hPa/1013.25; relative humidity is percent. Oxygen/nitrogen relaxation and classical absorption terms produce dB/m, displayed as dB/100 m. This is a normalized coefficient for uniform air at the specified conditions, not an assumed travel distance or loss of an actual flight call.

Inputs outside the application's calculation envelope (-20 to 50 C, 10–100% RH, 500–1100 hPa), missing inputs, or unsupported units yield no coefficient. This envelope is an implementation guard, not a uniform accuracy guarantee. Nightly ranges are available-hour minima/maxima, not confidence intervals. One decimal is display rounding, not claimed forecast precision. Actual path conditions, source level, distance, terrain, reflections, microphone response and noise levels are unknown.

## Recording-interference inputs

Wind/gusts are reported directly at the weather model's 10 m reference height. No power-law extrapolation to the microphone is made. Microphone height (0.5–30 m, default 2 m) is saved as site metadata only, ready for future modeling. Old saved source geometry is ignored.

Precipitation is model water equivalent during the hour ending at the returned timestamp. The summary counts positive precipitation intervals; it does not classify rain phase or sound level. Values above zero are counted without an invented acoustic threshold. Missing intervals are explicit. Wind and air inputs correspond to the timestamp. Ranges/counts cover the returned nighttime timestamps; they do not imply that every minute of the astronomical night is covered.

Foliage and insect settings remain user-supplied context, not measured noise or predictive penalties. Optional mapped roads and airports provide proximity information only. No background-noise propagation or level is forecast.

## Data and exports

Surface weather: Open-Meteo best-match forecast / Historical Weather API. No vertical-profile request is made. Historical data are model estimates, not observations at the microphone. Astronomical twilight comes from sunrise-sunset.org. The existing separate 18:00–06:00 precipitation contract is unchanged; see rainfall-contract.md.

JSON contains `summary.absorption` and `hourly.absorption.coefficients` with units `dB/100m`, air inputs and coverage. CSV column names explicitly use `_db_per_100m`. TXT/UI describe these as coefficients. Previous quality scores, outlook bands, source scenarios, path-loss fields, bending and recommended windows are intentionally removed (breaking schema change).

## Validation and future work

Run `node --test tests/*.test.cjs`. Tests cover reference absorption values, unit validation, missing data, coverage, absence of unsupported active outputs, export parity, and the precipitation contract. Passing formula tests does not validate recording-quality forecasts.

The experimental v3.1 module and model notes are archived in `research/experimental-v3.1/`; the app does not import them. Resume only with explicit scope and appropriate source-height/path data, atmospheric profiles and validation against recordings. Flight altitude alone will not determine horizontal range, call orientation, source strength, local noise or received level.

Sources:
- ISO 9613-1: https://www.iso.org/standard/17426.html
- Equation reference: https://python-acoustics.github.io/python-acoustics/_modules/acoustics/standards/iso_9613_1_1993.html
- Surface inputs: https://open-meteo.com/en/docs
