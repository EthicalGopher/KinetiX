import base64
import cv2
import numpy as np
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

app = FastAPI(title="MediaPipe Real-Time Pose Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MediaPipe PoseLandmarker for real-time inference
base_options = python.BaseOptions(model_asset_path='pose_landmarker_lite.task')
options = vision.PoseLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.IMAGE,
    num_poses=1
)
landmarker = vision.PoseLandmarker.create_from_options(options)

POSE_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 7), (0, 4), (4, 5), (5, 6), (6, 8), (9, 10),
    (11, 12), (11, 13), (13, 15), (15, 17), (15, 19), (15, 21), (17, 19),
    (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),
    (11, 23), (12, 24), (23, 24), (23, 25), (24, 26), (25, 27), (26, 28),
    (27, 29), (28, 30), (29, 31), (30, 32), (27, 31), (28, 32)
]

@app.get("/")
def read_root():
    return {"status": "ok", "message": "MediaPipe Pose Server is running"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("⚡ Real-time client connected to pose WebSocket server")
    
    fps_counter = 0
    start_time = time.time()
    
    try:
        while True:
            data = await websocket.receive_text()
            if "," in data:
                data = data.split(",", 1)[1]
                
            img_bytes = base64.b64decode(data)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if frame is None:
                await websocket.send_json({"detected": False, "error": "Invalid frame"})
                continue

            # Resize to 320x240 for ultra-fast MediaPipe pose inference (~3ms)
            h, w, _ = frame.shape
            if w > 320:
                frame = cv2.resize(frame, (320, int(h * 320 / w)))

            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

            result = landmarker.detect(mp_image)

            fps_counter += 1
            now = time.time()
            current_fps = round(fps_counter / (now - start_time), 1) if (now - start_time) > 0 else 0

            landmarks_list = []
            if result.pose_landmarks and len(result.pose_landmarks) > 0:
                for lm in result.pose_landmarks[0]:
                    landmarks_list.append({
                        "x": float(lm.x),
                        "y": float(lm.y),
                        "z": float(lm.z),
                        "visibility": float(lm.visibility) if lm.visibility is not None else 1.0
                    })

                await websocket.send_json({
                    "detected": True,
                    "landmarks": landmarks_list,
                    "fps": current_fps,
                    "connections": POSE_CONNECTIONS,
                })
            else:
                await websocket.send_json({
                    "detected": False,
                    "landmarks": [],
                    "fps": current_fps,
                    "connections": POSE_CONNECTIONS,
                })

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error processing frame: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
