export const mockDraws = [
  { draw_id: 1445, date: "2024-01-25", numbers: [3, 14, 18, 22, 27, 31, 34], powerball: 7 },
  { draw_id: 1444, date: "2024-01-18", numbers: [5, 12, 16, 21, 28, 30, 35], powerball: 14 },
  { draw_id: 1443, date: "2024-01-11", numbers: [2, 9, 15, 19, 24, 29, 33], powerball: 2 },
  { draw_id: 1442, date: "2024-01-04", numbers: [1, 7, 11, 17, 23, 26, 32], powerball: 9 },
  { draw_id: 1441, date: "2023-12-28", numbers: [4, 8, 13, 20, 25, 30, 34], powerball: 11 },
];

export const mockPatternFeatures = [
  { feature: "odd count", value: 4, type: "structure" },
  { feature: "even count", value: 3, type: "structure" },
  { feature: "sum", value: 149, type: "structure" },
  { feature: "range", value: 31, type: "structure" },
  { feature: "freq_last_25_n(14)", value: 6, type: "recency" },
  { feature: "days_since_seen_n(3)", value: 0, type: "recency" },
  { feature: "carryover count", value: 1, type: "sequence" },
];

export const mockValidationResults = [
  { strategy: "Random", avgMainMatches: 1.2, powerballHitRate: "5%", top10Overlap: "0%" },
  { strategy: "Frequency Only", avgMainMatches: 1.5, powerballHitRate: "6%", top10Overlap: "12%" },
  { strategy: "Recency Only", avgMainMatches: 1.4, powerballHitRate: "5.5%", top10Overlap: "8%" },
  { strategy: "Composite Model", avgMainMatches: 2.1, powerballHitRate: "9.2%", top10Overlap: "100%" },
];

export const mockGeneratedPicks = [
  { rank: 1, numbers: [2, 14, 19, 22, 28, 31, 35], powerball: 7, drawFit: 85, antiPop: 92, finalScore: 88.5 },
  { rank: 2, numbers: [3, 11, 18, 24, 27, 30, 34], powerball: 2, drawFit: 82, antiPop: 89, finalScore: 85.5 },
  { rank: 3, numbers: [5, 12, 16, 21, 25, 29, 33], powerball: 14, drawFit: 80, antiPop: 85, finalScore: 82.5 },
  { rank: 4, numbers: [1, 9, 15, 20, 26, 32, 35], powerball: 9, drawFit: 78, antiPop: 88, finalScore: 83.0 },
  { rank: 5, numbers: [4, 8, 13, 17, 23, 31, 34], powerball: 11, drawFit: 76, antiPop: 90, finalScore: 83.0 },
];
