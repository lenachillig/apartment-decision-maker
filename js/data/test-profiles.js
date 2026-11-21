/*
  Test preference profiles. These are fixtures for verification and demos only.
  They are never applied automatically and are not platform defaults.

  P1 / P2  Task 4 specification (final, 7 criteria), section 5: tables 6 and 7, anchors from table 4,
           user profile from section 2.3 (650 €, move-in by 15 Apr 2027, min. 6 months, step-free required).
  A / B    docs/data-model.md, section 7: same base comparisons, other E14 judgments and anchors.

  Matrices use the canonical criterion order E01, E02, E05, E09, E12, E15, E14.
  Their intermediate Saaty values (2, 4, 6, 8) need the advanced 1-9 input mode.
*/
(function (AW) {
  'use strict';

  const ORDER = ['E01', 'E02', 'E05', 'E09', 'E12', 'E15', 'E14'];

  const P1_MATRIX = [
    [1, 3, 1, 4, 2, 5, 3],
    [1 / 3, 1, 1 / 3, 2, 1 / 2, 2, 1],
    [1, 3, 1, 4, 2, 5, 3],
    [1 / 4, 1 / 2, 1 / 4, 1, 1 / 3, 2, 1],
    [1 / 2, 2, 1 / 2, 3, 1, 3, 2],
    [1 / 5, 1 / 2, 1 / 5, 1 / 2, 1 / 3, 1, 1],
    [1 / 3, 1, 1 / 3, 1, 1 / 2, 1, 1]
  ];

  const P2_MATRIX = [
    [1, 3, 2, 4, 1 / 3, 1 / 2, 1],
    [1 / 3, 1, 1 / 2, 2, 1 / 6, 1 / 4, 1 / 2],
    [1 / 2, 2, 1, 3, 1 / 4, 1 / 3, 1 / 2],
    [1 / 4, 1 / 2, 1 / 3, 1, 1 / 8, 1 / 5, 1 / 3],
    [3, 6, 4, 8, 1, 2, 2],
    [2, 4, 3, 5, 1 / 2, 1, 2],
    [1, 2, 2, 3, 1 / 2, 1 / 2, 1]
  ];

  // Data model, section 7: importance of E14 compared to the other criterion.
  // Stored as "X|E14" = importance of X compared to E14, i.e. the reciprocal.
  function withE14(baseMatrix, e14VsOthers) {
    const j = AW.ahp.matrixToJudgments(ORDER, baseMatrix);
    Object.keys(e14VsOthers).forEach(id => { j[id + '|E14'] = 1 / e14VsOthers[id]; });
    return j;
  }

  const TASK4_LIMITS = { budget: 650, moveInBy: '2027-04-15', minRentalMonths: 6, needStepFree: true, furnishing: 'furnished' };
  const TASK4_ANCHORS = {
    E01: { ideal: 300, worst: 650 },
    E02: { ideal: 0, worst: 3000 },
    E05: { ideal: 10, worst: 60 },
    E09: { ideal: 200, worst: 1500 },
    E12: { ideal: 35, worst: 10 }
  };

  const DM_ANCHORS = {
    E01: { ideal: 400, worst: 650 },
    E02: { ideal: 600, worst: 1950 },
    E05: { ideal: 15, worst: 60 },
    E09: { ideal: 200, worst: 1500 },
    E12: { ideal: 35, worst: 12 }
  };

  function build(limits, anchors, judgments) {
    return Object.assign({}, limits, { anchors: JSON.parse(JSON.stringify(anchors)), judgments, advanced: true });
  }

  AW.testProfiles = {
    P1: {
      name: 'Task 4 · Profile 1 (cost and commute)',
      source: 'Task 4 specification, table 6',
      make: () => build(TASK4_LIMITS, TASK4_ANCHORS, AW.ahp.matrixToJudgments(ORDER, P1_MATRIX))
    },
    P2: {
      name: 'Task 4 · Profile 2 (area, furnishing, privacy)',
      source: 'Task 4 specification, table 7',
      make: () => build(TASK4_LIMITS, TASK4_ANCHORS, AW.ahp.matrixToJudgments(ORDER, P2_MATRIX))
    },
    A: {
      name: 'Data model · Profile A (cost and commute)',
      source: 'docs/data-model.md, section 7',
      make: () => build(
        { budget: 650, moveInBy: '2027-04-01', minRentalMonths: 12, needStepFree: false, furnishing: 'furnished' },
        DM_ANCHORS,
        withE14(P1_MATRIX, { E01: 1 / 3, E02: 1, E05: 1 / 3, E09: 2, E12: 1 / 2, E15: 2 }))
    },
    B: {
      name: 'Data model · Profile B (space, privacy, furnishing)',
      source: 'docs/data-model.md, section 7',
      make: () => build(
        { budget: 650, moveInBy: '2027-04-01', minRentalMonths: 12, needStepFree: true, furnishing: 'furnished' },
        DM_ANCHORS,
        withE14(P2_MATRIX, { E01: 2, E02: 4, E05: 3, E09: 5, E12: 1 / 2, E15: 1 }))
    }
  };
})(window.AW = window.AW || {});
