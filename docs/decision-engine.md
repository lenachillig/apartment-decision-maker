# Decision Engine

Status: implemented, verified against the Task 4 reference values

This document describes how the prototype implements the two-stage decision process. The rules themselves are defined in `docs/data-model.md`, the Task 4 specification (Weighting and Scoring Logic, final version with seven criteria) and the Task 5 edge cases.

## 1. Files

| File | Responsibility |
|---|---|
| `js/engine/criteria.js` | Rule set: 5 hard and 7 soft criteria, mapping tables, RI table, thresholds |
| `js/engine/ahp.js` | AHP: reciprocal matrix, RGMM weights, λmax, CI, CR, review hint |
| `js/engine/engine.js` | Adapter, profile check, Stage 1, Stage 2, ranking, explanations |
| `js/engine/format.js` | Number, euro and date formatting for explanation texts |
| `js/data/test-dataset.js` | The 50-listing synthetic dataset (seed 42) |
| `js/data/test-profiles.js` | Test profiles P1, P2 (Task 4) and A, B (data model) |
| `tests/engine.test.html` | Browser test runner with the reference checks |

The engine has no DOM access. The user interface only calls `AW.engine.checkProfile(profile)` and `AW.engine.evaluate(listings, profile)`.

## 2. Pipeline

```
listing (dataset format)
  -> adapt()           validated values, derived rental period, issues per field
  -> checkHard()       K01 K03 K04 K09 K14: pass / fail / unknown / inactive
  -> status            excluded > insufficient > incomplete > ranked
  -> utility()         fixed reference values, linear, capped to [0, 1]
  -> SAW               points = weight x utility x 100, score = sum
  -> assignRanks()     shared ranks for ties, close-score flags
  -> explain()         strengths, top contributions, weaknesses
```

### Stage 1

- An observed failure always wins over unknown fields. APT-015 (cost missing, K14 failed) is excluded.
- Every failed criterion is reported with the actual value and the limit, for example "Monthly housing cost is 651 €, which is 1 € above your 650 € budget."
- K14 is only checked when the user needs step-free access.
- `rental_type = unlimited` with `max_rental_months = null` is not missing data.
- Invalid values (negative area, impossible dates, privacy outside 1–5) are treated like missing values and never guessed.

### AHP

- Judgments are stored as `"A|B" -> a` with A before B in the order E01, E02, E05, E09, E12, E15, E14.
- Weights: row geometric mean, normalised to 1.
- λmax is estimated from the RGMM weights, CI = (λmax − n) / (n − 1), CR = CI / RI with RI(7) = 1.32 and RI(6) = 1.24.
- CR above 0.10: the answers are kept, the ranking is withheld and the comparison with the largest log-ratio residual `|ln(a_jk · w_k / w_j)|` is suggested for review. Nothing is changed automatically.
- A neutral furnishing preference switches E15 off, so there are 15 comparisons instead of 21.

### Stage 2

- Utility for numeric criteria: `clamp((x − worst) / (ideal − worst), 0, 1)`. This works for both directions.
- E14 privacy: 1 → 0, 2 → 0.25, 3 → 0.5, 4 → 0.75, 5 → 1.
- E15 furnishing: 1 / 0.5 / 0 depending on the preference.
- Passed listings with a missing active soft value are "incomplete soft data" and are not scored. Weights are never re-normalised per listing.

### Ranking and edge cases (Task 5)

| Situation | Behaviour |
|---|---|
| Identical scores (difference ≤ 1e-9) | Same rank, the next rank is skipped (1, 1, 3) |
| Nearly identical scores (< 0.5 points) | Calculated order kept, both listings flagged, user invited to compare |
| Distinct scores that round to the same 2-decimal value | Shown with more decimals |
| No eligible apartment | Empty ranking with a hint to review limits; limits are never relaxed |
| Multiple knockout failures | All failures listed |
| Missing / invalid data | Listed in the Incomplete tab with the affected fields |

The 0.5-point threshold for "nearly identical" is a provisional value (`SETTINGS.closeScorePoints` in `criteria.js`) and still needs team approval.

Explanation thresholds follow Task 4, section 5.4: utility ≥ 0.75 is a strength, utility ≤ 0.30 a weakness. The two largest point contributions are named separately, because a high criterion score is not necessarily a large contribution.

## 3. Reference verification

Open `tests/engine.test.html` in a browser. All checks run against the 50-listing dataset.

| Check | Expected (Task 4) | Result |
|---|---|---|
| Partition with the Task 4 test profile | 30 excluded, 2 insufficient, 4 incomplete, 14 ranked | ✓ |
| Profile 1 weights (RGMM) | 27.30 / 9.50 / 27.30 / 6.77 / 16.12 / 5.21 / 7.79 % | ✓ |
| Profile 1 λmax, CR | 7.106065, 0.013392 | ✓ |
| Profile 2 λmax, CR | 7.108169, 0.013658 | ✓ |
| Worked example APT-029 / APT-016 / APT-001 | 68.766730 / 63.827248 / 61.678261 | ✓ |
| Profile 1 top five | APT-029, APT-016, APT-001, APT-044, APT-045 | ✓ |
| Profile 2 top five | APT-016, APT-019, APT-029, APT-001, APT-044 | ✓ |
| Data model profiles A and B | weights and CR from section 7 | ✓ |
| TC-01 … TC-14 | see Task 4, table 15 | ✓ |

Note: the Task 4 test profile (move-in by 15 Apr 2027, minimum 6 months, step-free required) differs from profiles A and B in the data model (1 Apr 2027, 12 months). Both are included as fixtures. In the app they can be loaded under Preferences → "For testing: load a reference profile". They are never applied automatically.

## 4. Open points

- Confirm the "nearly identical" threshold (currently 0.5 points).
- Confirm the explanation thresholds (0.75 / 0.30).
- The reference values in the Task 4 profile (E02 0–3,000 €, E12 35–10 m²) differ from the data model profiles (600–1,950 €, 35–12 m²). Both are documented; the team should pick one for the final demo.
