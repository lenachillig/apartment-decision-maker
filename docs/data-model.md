# Data Model

Status: draft for team review

This document describes the building blocks of the ApartmentWise decision support system and which information belongs where. It does not contain code or formulas. The calculation rules are defined in the Task 4.0 specification (Weighting and Scoring Logic).

## 1. Purpose

The decision logic does not know what an apartment is. It only works with three things: alternatives, criteria and a preference profile. Everything that is specific to housing lives in the data and the configuration, not in the logic. This way the same system could be used for a different decision (for example choosing a laptop or a university) by swapping the data and the criteria.

## 2. Overview

```
Alternatives ----+
(apartments)     |
                 +--> Stage 1: knockout filter --> Stage 2: scoring --> ranking + explanation
Criteria --------+
(rule set)       |
                 |
Profile ---------+
(user preferences)
```

Stage 1 removes every apartment that fails a hard criterion. Stage 2 gives the remaining apartments a score from 0 to 100 based on the soft criteria and the user's weights.

## 3. Alternatives

An alternative is one option the user can choose. In our case that is one apartment listing.

Each alternative has a unique `id` and a set of raw attribute values. Values are stored in fixed units: euros, minutes, metres, square metres and ISO dates (`YYYY-MM-DD`).

Example (APT-003 from the test dataset):

| Field | Value |
|---|---|
| apartment_id | APT-003 |
| monthly_cost_eur | 650 |
| deposit_eur | 910 |
| available_from | 2027-03-01 |
| rental_type / max_rental_months | limited / 18 |
| written_contract | true |
| step_free_access | true |
| commute_min | 6 |
| supermarket_distance_m | 780 |
| room_size_m2 | 12.0 |
| flatmates / private_bathroom | 4 / false |
| privacy_score | 1 |
| furnishing | partly_furnished |

Fields that are not used as criteria (`listing_title`, `housing_type`, `district`, `floor`, `elevator`, `min_commitment_months`) are kept for display. `min_commitment_months` is also shown as a note in the result, for example "minimum commitment 12 months". `flatmates` and `private_bathroom` are only used to derive `privacy_score` (see section 6).

### Meaning of empty values

`null` usually means "unknown". There is one exception: for `max_rental_months`, `null` together with `rental_type = unlimited` means the contract has no end date. That is not missing data. Only if `rental_type` itself is `null` is the rental period unknown.

The test notes (`test_note`) are not part of an alternative. They describe what a test expects and will be moved to the test fixtures.

## 4. Criteria

The rule set lists every criterion and how it is evaluated. It does not contain user-specific limits such as the budget. Those come from the profile.

There are 5 hard criteria and 7 soft criteria.

The Task 4.0 specification only lists six soft criteria. E14 (privacy) was added later and is documented here, not in the specification. With seven soft criteria there are 21 pairwise comparisons, and the consistency check uses the random index RI = 1.32 instead of 1.24. The CR limit of 0.10 stays the same.

| ID | Type | Field | Rule |
|---|---|---|---|
| K01 | hard | monthly_cost_eur | at most the user's budget |
| K03 | hard | available_from | on or before the latest move-in date |
| K04 | hard | rental period | at least the required minimum duration |
| K09 | hard | written_contract | must be true |
| K14 | hard | step_free_access | must be true, only checked if the user needs step-free access |
| E01 | soft | monthly_cost_eur | lower is better |
| E02 | soft | deposit_eur | lower is better |
| E05 | soft | commute_min | lower is better |
| E09 | soft | supermarket_distance_m | lower is better |
| E12 | soft | room_size_m2 | higher is better |
| E14 | soft | privacy_score (1 to 5) | higher is better |
| E15 | soft | furnishing | depends on the user's preference |

All limits are inclusive. An apartment that costs exactly the budget passes K01.

`step_free_access` already covers accessibility as a whole (entrance, floor, elevator). Floor and elevator are not checked separately for K14.

K01 and E01 use the same field on purpose. K01 decides whether an apartment is affordable at all, E01 rewards cheaper apartments among those that are.

Hard criteria never get a weight. Soft criteria can never make up for a failed hard criterion.

### Result of Stage 1

Every alternative ends up in exactly one of three states:

1. Excluded: at least one active hard criterion fails. This applies even if other fields are missing, because no missing value could change the outcome. Missing fields are listed as a note.
2. Insufficient data: no hard criterion fails, but at least one active hard criterion cannot be checked because its value is missing. The missing fields are shown to the user.
3. Passed: all active hard criteria are known and satisfied. Only these alternatives go to Stage 2.

If a passed alternative is missing a value for an active soft criterion, it is not scored in the main ranking. It is listed separately as "incomplete soft data" until the value is known.

## 5. Preference profile

The profile contains everything the user decides. It has four parts.

**Limits for hard criteria:** maximum budget, latest move-in date, minimum rental period, and whether step-free access is required. The user sets all of them. There are no default values, and step-free access needs an explicit yes or no.

**Pairwise comparisons:** The user does not enter weights directly. Instead they answer one question per pair of active soft criteria, for example "Which is more important to you, rent or commute time?". With 7 soft criteria that is 21 questions. The answer scale has five options (much more important, more important, equal, less important, much less important). An advanced mode allows the full 1 to 9 scale.

The weights are calculated from these answers with the AHP method. They are never stored or entered by hand. The system also checks whether the answers are consistent. If they contradict each other too much, no final ranking is shown and the user is asked to review the comparison that deviates most. Answers are never changed automatically.

**Reference values:** For each numeric soft criterion the profile defines an ideal value (full points) and a worst acceptable value (zero points). Values in between get points proportionally. Values beyond the limits are capped. Example for rent: 400 € gives full points, 550 € gives zero. The user enters these values. There are no presets. The ideal value has to be better than the worst value. E14 is the only exception: it is a fixed scale from 1 to 5 and has no user-defined limits. These reference values stay fixed while a set of apartments is compared. They are not recalculated from the current list of apartments, so adding a new apartment never changes the score of another one.

**Furnishing preference:** prefer furnished, prefer unfurnished or neutral.

| Preference | furnished | partly furnished | unfurnished |
|---|---|---|---|
| prefer furnished | 1.0 | 0.5 | 0.0 |
| prefer unfurnished | 0.0 | 0.5 | 1.0 |
| neutral | not scored | not scored | not scored |

The furnishing preference is asked before the pairwise comparisons. If the user is neutral, E15 is switched off and does not appear in the comparisons at all, so there are 15 questions instead of 21. Nothing has to be removed afterwards.

### Complete profile required

The evaluation can only be started once the profile is complete:

- all hard limits are set and valid
- step-free access is answered with yes or no
- a furnishing preference is chosen
- ideal and worst values are set for every active numeric soft criterion
- all pairwise comparisons are answered

Until then the start button stays disabled and the missing inputs are listed. If the pairwise comparisons are too inconsistent, the ranking is withheld as described above.

## 6. Rules and responsibilities

| Building block | Changed by | How often |
|---|---|---|
| Alternatives | data owners | when the dataset changes |
| Criteria | project team | rarely, only by agreement |
| Profile | user | every session |

### Derived fields

Some criteria do not map directly onto one field in the dataset. These values are derived in a separate adapter step between the dataset and the decision logic, so the logic itself stays generic.

- Rental period (K04): unlimited if `rental_type` is `unlimited`, otherwise `max_rental_months`. Unknown only if `rental_type` is missing.
- Privacy (E14): already given as `privacy_score` in the dataset. In the test data it follows from the number of flatmates and whether there is a private bathroom (no flatmates gives 5, one flatmate 3, two or three flatmates 2, four or more 1, a private bathroom adds one level). `flatmates` and `private_bathroom` are not used as separate criteria, otherwise the same information would count twice.

Privacy is an ordered scale, not a measured quantity. It is converted linearly with a fixed table: 1 = 0.0, 2 = 0.25, 3 = 0.5, 4 = 0.75, 5 = 1.0. This follows the linear baseline of the specification.

### Switching criteria on and off

Soft criteria can be deactivated. This is needed for a neutral furnishing preference and for reproducing the reference results in the Task 4.0 specification, which only uses six soft criteria (without E14). A deactivated criterion is not asked about in the pairwise comparisons and has no weight.

### Result of Stage 2

For every scored alternative the system returns:

- the utility per criterion (0 to 1)
- the points each criterion contributes (weight × utility × 100)
- the total score from 0 to 100 (unrounded for ranking, two decimals for display)
- the rank (equal scores share a rank)
- an explanation: strengths, criteria with the highest contribution, weaknesses

## 7. Test profiles

The 50-listing dataset is tested with two profiles, A and B. They are test fixtures only and are never shown to users as defaults. The hard limits follow from the boundary cases in the test notes (APT-003, APT-007, APT-019, APT-023, APT-031, APT-035, APT-002).

| | Profile A | Profile B |
|---|---|---|
| Focus | cost and commute | space, privacy and furnishing |
| Budget (K01) | 650 € | 650 € |
| Latest move-in (K03) | 2027-04-01 | 2027-04-01 |
| Minimum rental period (K04) | 12 months | 12 months |
| Step-free access required (K14) | no | yes |
| Furnishing preference | prefer furnished | prefer furnished |

Reference values (ideal → worst), the same for both profiles:

| Criterion | Ideal | Worst |
|---|---|---|
| E01 rent | 400 € | 650 € (budget) |
| E02 deposit | 600 € | 1,950 € (3 × budget) |
| E05 commute | 15 min | 60 min |
| E09 supermarket | 200 m | 1,500 m |
| E12 room size | 35 m² | 12 m² |

These are the values from the specification, with rent and deposit adjusted to the higher budget.

Pairwise comparisons: Profile A extends profile 1 of the specification (Table 7), profile B extends profile 2 (Table 8). Each gets six new comparisons for E14. The values below are the importance of E14 compared to the other criterion.

| E14 compared to | E01 | E02 | E05 | E09 | E12 | E15 |
|---|---|---|---|---|---|---|
| Profile A | 1/3 | 1 | 1/3 | 2 | 1/2 | 2 |
| Profile B | 2 | 4 | 3 | 5 | 1/2 | 1 |

In profile A privacy is about as important as the deposit, in profile B about as important as furnishing. Resulting weights (rounded, criterion order E01, E02, E05, E09, E12, E14, E15):

| | E01 | E02 | E05 | E09 | E12 | E14 | E15 | CR |
|---|---|---|---|---|---|---|---|---|
| Profile A | 27.14 % | 9.44 % | 27.14 % | 6.10 % | 16.03 % | 9.44 % | 4.69 % | 0.0097 |
| Profile B | 12.05 % | 4.86 % | 7.65 % | 3.25 % | 32.99 % | 19.59 % | 19.59 % | 0.0118 |

Both profiles are consistent (CR below 0.10).

## 8. Out of scope

- Sublet permission: the dataset has no field for it and it is not a criterion. It is mentioned as a tip on the "Good to Know" page. The specification also leaves this to manual checking (section 2.3).
- `min_commitment_months` is not a criterion. It is only shown as a note (see section 3).
