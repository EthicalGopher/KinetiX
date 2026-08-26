import cv2
import time
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision import drawing_utils, drawing_styles

base_options = python.BaseOptions(model_asset_path='pose_landmarker_lite.task')
options = vision.PoseLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.VIDEO,
    num_poses=1
)
landmarker = vision.PoseLandmarker.create_from_options(options)

cap = cv2.VideoCapture(0)
frame_idx = 0
fps = cap.get(cv2.CAP_PROP_FPS) or 30

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
    timestamp_ms = int(frame_idx * 1000 / fps)

    result = landmarker.detect_for_video(mp_image, timestamp_ms)

    if result.pose_landmarks:
        for pose_landmarks in result.pose_landmarks:
            drawing_utils.draw_landmarks(
                frame,
                pose_landmarks,
                vision.PoseLandmarksConnections.POSE_LANDMARKS,
                landmark_drawing_spec=drawing_styles.get_default_pose_landmarks_style(),
                connection_drawing_spec=drawing_utils.DrawingSpec(
                    color=(0, 230, 118), thickness=2
                ),
            )

    cv2.imshow('MediaPipe Pose', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

    frame_idx += 1

cap.release()
cv2.destroyAllWindows()
landmarker.close()
