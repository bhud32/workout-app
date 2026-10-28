# Brandon's 12-week lift log

Offline workout log for a 12-week velocity-based program. Vanilla JS, no build step — open `index.html` or install it as a PWA. Data stays on the device, with optional sync.

## What it does

Each session logs sets, load, reps, and bar speed. When a workout opens, every loaded exercise with history gets a suggested weight: the same load again when a recent session used this rep scheme (set count within one), or an Epley conversion when it did not (`e1RM = load × (1 + reps / 30)`, inverted at the new reps, rounded to the nearest 5 lb, and discounted 1.5% per rep above 8). Newer sessions outweigh older ones, a closer rep count outweighs a newer but dissimilar one, a lone outlier is capped, deload weeks are ignored, and bodyweight exercises stay blank. The reason sits on one line under the usual "Last (date):" summary.

## Tests

```
node tests/suggest-load.test.js
```
