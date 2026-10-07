# Recording-noise score v4.0

## Scope and evidence

Version 4 restores the September 21 visual score-card design and the 0–10 evening scale. It deliberately does not restore unsupported atmospheric preferences, best-hour recommendations, assumed microphone wind or spectrogram predictions. The more recent parser, missing-data handling and precipitation contract remain intact.

Wind can create microphone noise, and sufficiently strong wind noise can cause clipping that affects higher-frequency sounds ([Wildlife Acoustics SM5 documentation](https://answers.wildlifeacoustics.com/r/en-US/Song-Meter-SM5-User-Guide/Left-and-Right-Acoustic-High-Pass-Filter)). Rain and insect choruses can interfere with bird recordings ([primary research: Automatic Rain and Cicada Chorus Filtering of Bird Acoustic Data](https://arxiv.org/abs/1804.05502)). Moving leaves can add sound near the microphone. These mechanisms justify retaining noise factors; **the cited evidence does not validate this application's thresholds, weights or labels**.

This is a heuristic index of possible masking conditions, not a measured signal-to-noise ratio, audibility probability, predicted number of detections, or calibrated recording-quality model. Wind shelter, windscreen performance, microphone response, insect frequency overlap, bird distance and call strength are unknown. The same weather can produce different recordings at different sites. Low scores do not mean recordings are unusable.

## Exact rules

`recording-score.js` implements linear interpolation between the following knots, holding the final deduction above the last knot. All speeds refer to model wind at 10 m above ground, with no microphone-height extrapolation.

| Factor | Input → deduction (points) |
| --- | --- |
| Sustained wind (m/s) | 0→0, 1→0, 3→1, 5→2.5, 8→5, 12→7 |
| Gust (m/s) | 0→0, 3→0, 6→1, 10→2.5, 15→5, 20→7 |
| Precipitation (mm in preceding hour) | 0→0, 0.1→0.5, 0.5→2, 1→3.5, 2.5→5.5, 5→7 |
| Insect setting | low→0, moderate→1.5, heavy→3 |

The wind deduction is the **maximum** of sustained-wind and gust deductions, not their sum. Leaf rustle adds 0 / 0.25 / 0.6 / 1 point for open / light / moderate / heavy foliage, multiplied by wind activation. Activation uses the maximum of sustained wind and half the gust speed: zero at or below 1 m/s, increasing linearly to one at 5 m/s. This is a planning rule, not a vegetation sound-level model. Insects are user input, not a forecast of insect activity.

Each hourly score is `max(0, 10 − wind − precipitation − leaves − insects)`. Maximum deductions sum to more than 10 because more than one source can independently obscure calls. A dry but severely windy hour and a calm but heavily wet hour can each be Poor without needing unrelated atmospheric penalties.

The nightly score averages raw hourly scores, then rounds to the nearest 0.5. Displayed labels use only the rounded score: Excellent ≥9; Great ≥8; Good ≥7; Fair ≥6; Marginal ≥5; Poor ≥3; Bad below 3. Great replaces the former two-word Very Good. Bad replaces stronger, unsupported claims that recordings are unusable. Deduction tables report actual mean component deductions; they need not subtract exactly from 10 to yield the night score when hourly zero-flooring or display rounding applies.

The top issue is the largest mean deduction of at least 0.25 points. Up to two such sources explain possible masking. Below that display threshold the card says no major noise concern is indicated, not that the site is silent. This threshold is a UI convention, not an acoustic boundary.

## Missing data and timing

Missing, non-finite or negative wind, gust or precipitation prevents an hourly score. If any returned hour cannot be scored, or the returned timestamps have an interior gap, no nightly score is shown; available/total hours remain explicit. Scores cover returned nighttime timestamps, including a labeled remaining-night window when appropriate. They do not describe every minute of astronomical darkness.

Precipitation is water equivalent over the preceding hour; wind is timestamp-based. Total precipitation does not identify phase: snowfall and rainfall can produce different recording interference. Its score is a potential-noise proxy, not predicted tapping loudness. The separate completed-night 18:00–06:00 precipitation estimate is unchanged and is not silently substituted for hourly score inputs.

Historical values are modeled weather. Current user-selected foliage and insects apply to historical exports too; they are not reconstructed historical observations. Microphone height is metadata only. Optional roads and airports are factual map context, never scored.

## Removed factors and archived work

No standalone temperature, humidity, pressure, cloud or visibility metric remains in the score. No conditional dB coefficient is presented as a clarity score or path loss. No bird height/distance, sound bending, best window or identification-detail prediction is made.

The experimental v3.1 model and conditional v3.2 calculations remain separately archived, with no active script import. They can support future work once flight-altitude data and recording validation become available.

## Export contract

JSON nights contain `rating` with `score_10`, `descriptor`, coverage, mean deductions, top issue and plain explanation. Hourly rows contain raw and half-point scores plus deductions. TXT and CSV use the same scoring functions. Missing scores are null in JSON, blank in CSV and unavailable in the UI/TXT. Version 4 is a deliberate schema change from v3's coefficient exports.
