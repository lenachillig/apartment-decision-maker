/*
  Rule set: every criterion the decision engine knows about.
  User-specific limits (budget, reference values ...) are NOT stored here,
  they come from the preference profile. See docs/data-model.md, section 4.
*/
(function (AW) {
  'use strict';

  // Hard criteria (Stage 1). They never get a weight.
  const HARD = [
    { id: 'K01', label: 'Monthly cost', field: 'monthly_cost_eur', profileKey: 'budget' },
    { id: 'K03', label: 'Availability', field: 'available_from', profileKey: 'moveInBy' },
    { id: 'K04', label: 'Rental period', field: 'rental_period', profileKey: 'minRentalMonths' },
    { id: 'K09', label: 'Written contract', field: 'written_contract', profileKey: null },
    { id: 'K14', label: 'Step-free access', field: 'step_free_access', profileKey: 'needStepFree', optional: true }
  ];

  // Soft criteria (Stage 2), in the canonical order of the Task 4 specification.
  // kind: numeric = linear between ideal and worst, ordinal = fixed 1-5 scale, categorical = mapping table.
  const SOFT = [
    { id: 'E01', label: 'Monthly cost', short: 'Cost', field: 'monthly_cost_eur', kind: 'numeric', better: 'lower', unit: '€' },
    { id: 'E02', label: 'Deposit', short: 'Deposit', field: 'deposit_eur', kind: 'numeric', better: 'lower', unit: '€' },
    { id: 'E05', label: 'Commute time', short: 'Commute', field: 'commute_min', kind: 'numeric', better: 'lower', unit: 'min' },
    { id: 'E09', label: 'Supermarket distance', short: 'Supermarket', field: 'supermarket_distance_m', kind: 'numeric', better: 'lower', unit: 'm' },
    { id: 'E12', label: 'Room size', short: 'Room size', field: 'room_size_m2', kind: 'numeric', better: 'higher', unit: 'm²' },
    { id: 'E15', label: 'Furnishing', short: 'Furnishing', field: 'furnishing', kind: 'categorical' },
    { id: 'E14', label: 'Privacy', short: 'Privacy', field: 'privacy_score', kind: 'ordinal' }
  ];

  // E14: ordinal 1-5 mapped linearly (Task 4, table 5).
  const PRIVACY_UTILITY = { 1: 0, 2: 0.25, 3: 0.5, 4: 0.75, 5: 1 };

  // E15: utility per furnishing state and user preference (data model, section 5).
  const FURNISHING_UTILITY = {
    furnished: { furnished: 1, partly_furnished: 0.5, unfurnished: 0 },
    unfurnished: { furnished: 0, partly_furnished: 0.5, unfurnished: 1 }
  };

  const FURNISHING_LABELS = { furnished: 'furnished', partly_furnished: 'partly furnished', unfurnished: 'unfurnished' };

  // Saaty random index per matrix size (n = 7 -> 1.32, n = 6 -> 1.24).
  const RANDOM_INDEX = { 1: 0, 2: 0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49 };

  const SETTINGS = {
    crLimit: 0.10,          // AHP consistency gate (inclusive)
    highUtility: 0.75,      // explanation label "strength" (Task 4, section 5.4)
    lowUtility: 0.30,       // explanation label "weakness"
    tieTolerance: 1e-9,     // scores closer than this share a rank
    // "Nearly identical" threshold in points. Provisional value, needs team approval (Task 5, section 2).
    closeScorePoints: 0.5
  };

  // Five-choice questionnaire (Task 4, table 3) and the full Saaty 1-9 scale for advanced mode.
  const SIMPLE_SCALE = [5, 3, 1, 1 / 3, 1 / 5];
  const FULL_SCALE = [9, 8, 7, 6, 5, 4, 3, 2, 1, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 7, 1 / 8, 1 / 9];

  function soft(id) { return SOFT.find(c => c.id === id); }
  function hard(id) { return HARD.find(c => c.id === id); }

  AW.criteria = {
    HARD, SOFT, PRIVACY_UTILITY, FURNISHING_UTILITY, FURNISHING_LABELS, RANDOM_INDEX,
    SETTINGS, SIMPLE_SCALE, FULL_SCALE, soft, hard,
    softIds: SOFT.map(c => c.id),
    numericSoft: SOFT.filter(c => c.kind === 'numeric')
  };
})(window.AW = window.AW || {});
