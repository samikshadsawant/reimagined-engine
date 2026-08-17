# client/public/models/

All ML model weight files served locally by Vite as static assets.
No cloud CDN required after first setup.

---

## Model Integration Status

| Model | Files | Consumer | Status |
|-------|-------|----------|--------|
| TinyFaceDetector | `tiny_face_detector_model-*` | `FaceRecognition.jsx` | ✅ |
| Face Landmark 68 | `face_landmark_68_model-*` | `FaceRecognition.jsx` | ✅ |
| Face Recognition | `face_recognition_model-*` | `FaceRecognition.jsx` | ✅ |
| Face Expression | `face_expression_model-*` | `FaceRecognition.jsx` | ✅ |
| Gesture Recognizer | `gesture_recognizer.task` | `useGestureRecognizer.js` | ✅ |
| YOLOv8s (ONNX) | `yolo/yolov8s.onnx` | `useYoloDetector.js` | Optional, not bundled |
| YOLOv8s (PyTorch) | `yolov8s.pt` | Python YOLO server | ✅ |
| Sign Language | `sign_model/model.json` | `SignLanguageController.jsx` | ⚠️ needs training |

---

## 1. face-api.js Models

Used by `FaceRecognition.jsx` (Phase 2.4 — Alzheimer's face recognition)
All four nets are loaded in parallel on mount via `faceapi.nets.<net>.loadFromUri('/models')`.

### TinyFaceDetector — face detection (fast, low memory)
- `tiny_face_detector_model-weights_manifest.json`
- `tiny_face_detector_model-shard1`

### Face Landmark 68 Net — 68-point facial landmarks
- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model-shard1`

### Face Recognition Net — 128-d descriptor (2 shards)
- `face_recognition_model-weights_manifest.json`
- `face_recognition_model-shard1`
- `face_recognition_model-shard2`

### Face Expression Net — emotion classification
- `face_expression_model-weights_manifest.json`
- `face_expression_model-shard1`

Detects: `happy · sad · angry · fearful · disgusted · surprised · neutral`
Shown as a sub-label on the face overlay and appended to the TTS announcement.

> **Status:** ✅ All 4 nets present and wired

---

## 2. MediaPipe Gesture Recognizer

Used by `useGestureRecognizer.js` → `GestureController.jsx` (primary recognizer)

### Model file
- `gesture_recognizer.task` (8.0 MB) ✅

Runs in `VIDEO` mode via `@mediapipe/tasks-vision@0.10.35`.
Confidence threshold: **0.70**. Falls back to hand-landmark classifier if score < 0.70.

### Gesture → SpiritOS action map
| MediaPipe | SpiritOS | Action |
|-----------|---------|--------|
| `Thumb_Up` | `THUMB_UP` | Open File Explorer |
| `Open_Palm` | `open_palm` | Open Notes |
| `Victory` | `PEACE_SIGN` | Open Calculator |
| `Pointing_Up` | `point` | Move cursor |
| `Closed_Fist` | `fist` | Right-click |
| `ILoveYou` | `THREE_FINGERS` | Open Files |

---

## 3. YOLOv8s — Object Detection

### ONNX model (browser, onnxruntime-web)
- `yolo/yolov8s.onnx` (large file, ignored by git)
- Consumer: `useYoloDetector.js` → `GestureController.jsx`
- Runs every **500ms** on the shared camera stream
- Backend priority: WebGL (GPU) → WASM (CPU fallback)
- Input: 640×640 NCHW float32 tensor
- Output: COCO 80-class labels shown as badges on the gesture camera preview
- If this file is missing, gesture control still works via MediaPipe and YOLO object detection is disabled cleanly.

### PyTorch model (Python server)
- `yolov8s.pt` (21.5 MB) ✅
- Consumer: Python YOLO detection server (`test.py`)
- Run: `python test.py` (separate terminal)

---

## 4. Sign Language Classifier

- Consumer: `SignLanguageController.jsx`
- Loads from: `/sign_model/model.json` (served from `client/public/sign_model/`)

> ⚠️ **Needs training** — the model weights do not exist yet.
> The training pipeline is ready. Follow these steps to generate them:
>
> **Step 1 — Collect training data** (≥ 50 samples per sign):
> ```
> # Open the browser and navigate to:
> http://localhost:5173/#/dev/sign-collector
> ```
>
> **Step 2 — Export** the JSON from the collector UI
>
> **Step 3 — Train the model:**
> ```powershell
> cd client/src/input/signLanguage
> npm install @tensorflow/tfjs-node   # only needed once
> node trainClassifier.js
> ```
>
> **Step 4** — Vite will automatically serve `client/public/sign_model/model.json`
>
> Signs: Hello · Thank You · Yes · No · Help · Please · Sorry · Goodbye

---

## ⚠️ Do NOT run `npm audit fix --force`

Running `--force` will downgrade `face-api.js` from `0.22.2` to `0.20.0`
which breaks the `TinyFaceDetector` and `faceExpressionNet` APIs.
The audit warnings are in a transitive dep (`tfjs-image-recognition-base`)
and are **not exploitable in a local deployment**.
