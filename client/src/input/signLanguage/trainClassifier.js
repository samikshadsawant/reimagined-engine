// trainClassifier.js
// Input:  sign_training_data.json  (from SignDataCollector.jsx export)
// Output: sign_model/  (TensorFlow.js LayersModel directory)
// Run:    node trainClassifier.js
//
// Architecture: 63-input (21 landmarks × 3 coords) → 128 → 64 → 8-softmax
// Do NOT change the architecture without re-running this script

const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

const SIGN_LABELS = [
  'Hello', 'Thank You', 'Yes', 'No',
  'Help', 'Please', 'Sorry', 'Goodbye'
];

const NUM_CLASSES = SIGN_LABELS.length;
const NUM_FEATURES = 63; // 21 landmarks × 3 (x, y, z)

/**
 * Normalise landmarks relative to wrist point (landmark[0])
 * so output is translation-invariant.
 * @param {Array} landmarks - array of {x,y,z} objects (length 21)
 * @returns {Float32Array} flat array of length 63
 */
function normaliseLandmarks(landmarks) {
  const wrist = landmarks[0];
  const flat = new Float32Array(NUM_FEATURES);
  for (let i = 0; i < 21; i++) {
    flat[i * 3 + 0] = landmarks[i].x - wrist.x;
    flat[i * 3 + 1] = landmarks[i].y - wrist.y;
    flat[i * 3 + 2] = (landmarks[i].z || 0) - (wrist.z || 0);
  }
  return flat;
}

async function main() {
  const dataPath = path.join(__dirname, 'sign_training_data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('❌ sign_training_data.json not found.');
    console.error('   Run the SignDataCollector tool first and export the JSON.');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // Build xs and ys tensors
  const allX = [];
  const allY = [];

  for (let labelIdx = 0; labelIdx < SIGN_LABELS.length; labelIdx++) {
    const label = SIGN_LABELS[labelIdx];
    const samples = raw[label];
    if (!samples || samples.length === 0) {
      console.warn(`⚠️  No samples for "${label}" — skipping.`);
      continue;
    }
    for (const sample of samples) {
      // sample is either an array of {x,y,z} or already a flat array
      let landmarks = sample;
      if (!Array.isArray(sample[0])) {
        // Already flat — reshape to objects
        landmarks = [];
        for (let i = 0; i < 21; i++) {
          landmarks.push({ x: sample[i * 3], y: sample[i * 3 + 1], z: sample[i * 3 + 2] || 0 });
        }
      }
      allX.push(Array.from(normaliseLandmarks(landmarks)));
      allY.push(labelIdx);
    }
  }

  if (allX.length === 0) {
    console.error('❌ No usable training samples found.');
    process.exit(1);
  }

  // Shuffle
  const indices = Array.from({ length: allX.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const shuffledX = indices.map(i => allX[i]);
  const shuffledY = indices.map(i => allY[i]);

  // 80/20 split
  const splitIdx = Math.floor(shuffledX.length * 0.8);
  const xTrain = tf.tensor2d(shuffledX.slice(0, splitIdx));
  const yTrain = tf.oneHot(tf.tensor1d(shuffledY.slice(0, splitIdx), 'int32'), NUM_CLASSES);
  const xVal   = tf.tensor2d(shuffledX.slice(splitIdx));
  const yVal   = tf.oneHot(tf.tensor1d(shuffledY.slice(splitIdx), 'int32'), NUM_CLASSES);

  // Build model — 63 → 128 → 64 → 8-softmax
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 128, activation: 'relu', inputShape: [NUM_FEATURES] }));
  model.add(tf.layers.dropout({ rate: 0.3 }));
  model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: NUM_CLASSES, activation: 'softmax' }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  model.summary();

  console.log(`\n📊 Training on ${splitIdx} samples, validating on ${shuffledX.length - splitIdx}...\n`);

  const history = await model.fit(xTrain, yTrain, {
    epochs: 100,
    batchSize: 32,
    validationData: [xVal, yVal],
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0) {
          console.log(
            `Epoch ${epoch + 1}/100 — loss: ${logs.loss.toFixed(4)}  acc: ${logs.acc.toFixed(4)}  val_acc: ${logs.val_acc.toFixed(4)}`
          );
        }
      }
    }
  });

  const finalValAcc = history.history.val_acc.at(-1);
  console.log(`\n✅ Final val_accuracy: ${(finalValAcc * 100).toFixed(1)}%`);

  if (finalValAcc < 0.90) {
    console.warn('⚠️  val_accuracy is below 0.90 — collect more samples before deploying.');
  }

  // Output to client/public/sign_model so Vite serves it at /sign_model/model.json
  // (SignLanguageController loads from '/sign_model/model.json')
  const outDir = path.join(__dirname, '..', '..', '..', 'public', 'sign_model');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  await model.save(`file://${outDir}`);
  console.log(`\n💾 Model saved to: ${outDir}`);
  console.log('   Served at: http://localhost:5173/sign_model/model.json');
  console.log('   Files expected: model.json  group1-shard1of1.bin');
}

main().catch(err => {
  console.error('❌ Training failed:', err);
  process.exit(1);
});
