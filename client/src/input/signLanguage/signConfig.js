// signConfig.js — Ground truth sign definitions
// Each sign is represented as a normalised landmark pattern (21 points × {x,y,z})
// Values here are PLACEHOLDER skeletons — replace with real landmark snapshots
// collected via the data-collection tool (SignDataCollector.jsx)

export const SIGN_LABELS = [
  'Hello', 'Thank You', 'Yes', 'No',
  'Help', 'Please', 'Sorry', 'Goodbye'
];

// Threshold: cosine similarity score above which a sign is accepted
export const CONFIDENCE_THRESHOLD = 0.82;

// How long (ms) a sign must be held before it is emitted
export const DWELL_TIME_MS = 600;
