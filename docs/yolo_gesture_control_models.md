# YOLO Models for Hand & Eye Gesture Control

## Overview

This document contains all relevant pretrained YOLO model download links and stack recommendations for building a hand gesture + eye/gaze control system using computer vision.

---

## 🖐️ Hand Gesture / Pose Models

### Option 1 — YOLOv8 Pose (Recommended)

YOLOv8 Pose detects body/hand keypoints and is the cleanest drop-in for gesture pipelines.

**Install:**
```bash
pip install ultralytics
```

**Auto-download via Python (downloads on first run):**
```python
from ultralytics import YOLO
model = YOLO("yolov8n-pose.pt")  # auto-downloads ~6MB
```

**Direct `.pt` Download Links (Ultralytics GitHub Releases):**

| Model | Size | Speed | Accuracy | Direct Download |
|---|---|---|---|---|
| YOLOv8n-pose | ~6 MB | Fastest | Good | https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n-pose.pt |
| YOLOv8s-pose | ~23 MB | Fast | Better | https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8s-pose.pt |
| YOLOv8m-pose | ~65 MB | Moderate | Best | https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8m-pose.pt |

> **Tip:** For real-time gesture control, start with `yolov8n-pose.pt` — it runs comfortably at 30+ FPS on CPU.

---

### Option 2 — Dedicated Hand Keypoint Model (21 Keypoints)

Trained specifically on hand keypoints — covers wrist, knuckles, and all 5 finger joints (21 points per hand). Ideal for fine-grained gesture recognition and AR/VR controls.

- **GitHub:** https://github.com/RionDsilvaCS/yolo-hand-pose
- **Weights:** Available in the repository's Releases tab
- **Framework:** YOLOv8n-pose (Ultralytics)
- **Keypoints:** 21 per hand (wrist + 4 joints per finger)

---

### Option 3 — YOLOv3 Hand Detection (Legacy, Lightweight)

Pre-trained YOLOv3 model for hand bounding box detection. Trained on CMU Hand DB + Egohands dataset.

- **GitHub:** https://github.com/cansik/yolo-hand-detection
- **Use case:** When you only need bounding boxes, not keypoints

---

## 👁️ Eye & Face Landmark Models

YOLO alone is limited for eye tracking. Use the following:

### YOLOv8-Face (Face + Eye Bounding Box Detection)

Pre-trained from scratch on the WIDERFace dataset. Good for detecting face regions including eyes.

| Model | Direct Download |
|---|---|
| YOLOv8n-face (nano) | https://github.com/lindevs/yolov8-face/releases/download/v1.1.0/yolov8n-face.pt |
| YOLOv8s-face (small) | https://github.com/lindevs/yolov8-face/releases/download/v1.1.0/yolov8s-face.pt |

- **GitHub:** https://github.com/lindevs/yolov8-face

---

### MediaPipe FaceMesh (Best for Gaze / Iris Tracking)

For precise **eye landmark and iris tracking**, MediaPipe FaceMesh outperforms YOLO — it gives 468 facial landmarks including detailed eye/iris points.

```bash
pip install mediapipe
```

```python
import mediapipe as mp

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(refine_landmarks=True)  # enables iris landmarks
```

> `refine_landmarks=True` adds 10 extra iris keypoints per eye for gaze estimation.

---

## 🔧 Recommended Full Stack for Gesture Control

```
Input (Webcam)
    │
    ├──► YOLOv8n-pose.pt         → Hand keypoint detection (21 points)
    │        └── OpenCV           → Draw skeleton, extract joint angles
    │
    ├──► MediaPipe FaceMesh       → Eye/iris landmark tracking (468 pts)
    │        └── Iris keypoints   → Gaze direction estimation
    │
    └──► Gesture Classifier       → Map keypoints → gesture labels
             └── pyautogui / pynput → Trigger OS-level mouse/keyboard actions
```

---

## 📦 Full Dependency Install

```bash
pip install ultralytics opencv-python mediapipe pyautogui numpy
```

---

## 🚀 Quickstart — Hand Gesture Inference

```python
import cv2
from ultralytics import YOLO

model = YOLO("yolov8n-pose.pt")
cap = cv2.VideoCapture(0)

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame)
    annotated = results[0].plot()

    cv2.imshow("Hand Gesture Control", annotated)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
```

---

## 🚀 Quickstart — Eye / Iris Tracking

```python
import cv2
import mediapipe as mp

mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils

cap = cv2.VideoCapture(0)

with mp_face_mesh.FaceMesh(refine_landmarks=True) as face_mesh:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb)

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                mp_drawing.draw_landmarks(
                    frame, face_landmarks,
                    mp_face_mesh.FACEMESH_IRISES
                )

        cv2.imshow("Eye Tracking", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

cap.release()
cv2.destroyAllWindows()
```

---

## 📌 Key Landmark Indices (MediaPipe)

| Feature | Landmark Indices |
|---|---|
| Left Eye (outline) | 33, 7, 163, 144, 145, 153, 154, 155, 133 |
| Right Eye (outline) | 362, 382, 381, 380, 374, 373, 390, 249, 263 |
| Left Iris (center) | 468 |
| Right Iris (center) | 473 |

---

## 🔗 All Links Summary

| Resource | URL |
|---|---|
| Ultralytics YOLOv8 (HuggingFace) | https://huggingface.co/Ultralytics/YOLOv8 |
| YOLOv8 Pose Docs | https://docs.ultralytics.com/tasks/pose/ |
| Hand Keypoints Dataset (Ultralytics) | https://docs.ultralytics.com/datasets/pose/hand-keypoints/ |
| YOLOv8-Face GitHub | https://github.com/lindevs/yolov8-face |
| YOLOv3 Hand Detection | https://github.com/cansik/yolo-hand-detection |
| YOLOv8 Hand Pose (21 kpts) | https://github.com/RionDsilvaCS/yolo-hand-pose |
| MediaPipe Docs | https://developers.google.com/mediapipe |
