# Acoustic propagation model v3.1

This release replaces the additive weather score with separate physical estimates and local masking context. JSON/CSV schemas intentionally change: no overall_score, factor effects or quality descriptors. Existing consumers must migrate to frequency_summary and hourly.propagation.

## Inputs and geometry

Microphone height is user-set, 0.5–30 m above ground (default 2 m). Source height and horizontal separation are fixed at 300 m each as an internal comparison reference. They are not user inputs or predictions of bird position. All heights share a flat ground datum. Microphone height persists in browser localStorage. The reference geometry is recorded in exports. Previously saved caller settings are ignored.

Straight path length is hypot(horizontal distance, caller height − microphone height). Atmospheric absorption is evaluated at 2, 4, 6, 8 and 10 kHz. These frequencies are comparison samples, not species-specific predictions. Free-field geometric spreading relative to 1 m is 20 log10(path length); JSON keeps it separate from absorption. Source level and microphone response are unknown, so received level and detection range are not predicted.

## Absorption

`acoustics.js` implements the ISO 9613-1 pure-tone absorption equations. Temperature is converted to kelvin; pressure ratio uses hPa/1013.25; relative humidity is supplied in percent and converted to water-vapour molar concentration in percent. Oxygen and nitrogen relaxation terms plus the classical term produce dB/m.

For a usable profile, 64 midpoint samples integrate the coefficient along the straight path, assuming horizontal homogeneity and linear interpolation between levels. The code accepts -20 to 50 C, RH 10–100%, and 500–1100 hPa; outside that conservative envelope it does not extrapolate the coefficient. This envelope does not establish a universal error bound or certify the implementation.

When the profile cannot span the path with valid air data, surface temperature/humidity/pressure are held constant along it and the result is labeled `surface_uniform`. Missing surface inputs then yield `unavailable`, never zero loss. Historical data currently uses this fallback; historical vertical profiles are not fetched.

The lowest-absorption hour is the minimum 6 kHz loss for the selected scenario, only when every available night hour has a valid estimate using the same method. It is not an overall best hour and is not a masking or activity forecast. Night ranges can contain mixed methods; hourly rows identify each method.

## Profile source and bending diagnostic

Forecast profiles use Open-Meteo's GFS endpoint, model `gfs_global`, explicitly requested m/s winds and pressure levels 1000–500 hPa at 25 hPa spacing. Geopotential heights are converted to approximate above-ground heights using the response elevation. Levels at/below ground or with pressure >= surface pressure are discarded. Request failure is independent of surface-data retrieval and produces a labeled fallback. The additional profile request has a 20-second timeout.

The experimental directional diagnostic uses c_eff = sqrt(1.4 × 287.05 × T_kelvin) + wind component along horizontal sound travel. Meteorological wind directions describe where wind comes FROM; a source north of the recorder sends sound south. For eight source bearings, report the net c_eff gradient between max(10 m, microphone height) and caller height, in m/s per 100 m. Positive indicates downward and negative upward bending tendency; an absolute net gradient below 0.1 m/s/100 m is labeled weak (display threshold only).

This is an endpoint gradient diagnostic, NOT ray tracing, a path solution, transmission loss, or a ranking of source directions. It approximates near-horizontal propagation and must not be interpreted as a direct prediction for steep/overhead calls. Layer reversals can cancel in a net gradient. Near-surface wind is held at the 10 m value; surface thermodynamics are anchored at 2 m. Coarse levels can miss shallow inversions. Maximum sampled level gap is reported. No turbulence, terrain, focusing, shadow zones, reflection or ground-effect model is included.

## Local interference and nearby sources

Wind at the microphone uses U(z)=U(10 m)(z/10)^0.2, including for gusts. This fixed exposure assumption is not reliable inside a canopy, around buildings or on rooftops. Missing wind remains missing. Precipitation impacts may cause masking; water-equivalent amounts do not establish precipitation phase or acoustic intensity. Foliage and insects remain explicit user settings, not measured noise.

Optional mapped roads/airports remain proximity context only. The old humidity/pressure/cloud propagation bonuses and acoustic-risk labels have been removed. Modeling transmission from known background sources remains future work; traffic and flight activity are unknown.

No cloud cover, visibility, seasonal temperature preference or pressure preference is scored. Temperature, humidity and pressure remain physical inputs to absorption; wind and temperature profiles support the bending diagnostic.

## Verification and sources

Run `node --test tests/*.test.cjs`. Tests cover reference absorption coefficients, uniform-layer integration, height/path effects, missing inputs, out-of-envelope inputs, profile elevation and coverage, inversion/shear signs and precipitation regression behavior.

- ISO method: https://www.iso.org/standard/17426.html
- Open-source equation reference: https://python-acoustics.github.io/python-acoustics/_modules/acoustics/standards/iso_9613_1_1993.html
- GFS inputs and height conventions: https://open-meteo.com/en/docs/gfs-api
- Atmospheric propagation context: https://www.fhwa.dot.gov/Environment/noise/noise_barriers/design_construction/design/design03.cfm

This implementation has not been field-validated against NFC recordings. Do not interpret coefficient checks as validation of the full forecast chain.

## At-a-glance outlook (v3.1)

The headline is an explicitly experimental planning classification, not a replacement calibrated score or a detection probability. It uses a fixed reference profile/path, with 6 kHz absorption normalized to dB per 100 m so no estimated bird distance is needed from the user. Experimental bending does not affect this classification.

Hourly bands use the most limiting of:
- Absorption: <=5 dB/100 m favorable, >5 to 10 mixed, >10 difficult.
- Estimated microphone-height wind: >=3 m/s or gust >=7 m/s mixed; >=6 m/s or gust >=10 m/s difficult.
- Precipitation water equivalent: >=0.25 mm/h mixed; >=1 mm/h difficult.
- User-selected insects: moderate=mixed, heavy=difficult.
- Moderate/dense foliage selected: wind >=3 m/s mixed, >=6 m/s difficult.

These are transparent product heuristics, not empirical NFC validation thresholds. The category is Difficult when at least half the available hours are difficult; otherwise Favorable when at least two thirds are favorable; otherwise Mixed. Missing required data or mixed profile/fallback methods returns Uncertain. The main limitation is the factor with the greatest cumulative band severity. Most promising hours are the longest consecutive run in the night's lowest severity band; ties choose the earlier run. If every hour is difficult, no clear break is offered. Hourly timestamps represent starts; window end is one hour after the last start. Overall coverage outside returned night hours is not inferred.
