#!/home/sankhyahrick/Python/bin/python
import os
import base64
import cv2
import numpy as np
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

app = FastAPI(title="MediaPipe Real-Time Pose & Static Model Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_ngrok_header(request, call_next):
    response = await call_next(request)
    response.headers["ngrok-skip-browser-warning"] = "true"
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static") if os.path.exists(os.path.join(BASE_DIR, "static")) else os.path.abspath("static")

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Initialize MediaPipe PoseLandmarker
base_options = python.BaseOptions(model_asset_path=os.path.join(BASE_DIR, 'pose_landmarker_lite.task') if os.path.exists(os.path.join(BASE_DIR, 'pose_landmarker_lite.task')) else 'pose_landmarker_lite.task')
options = vision.PoseLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.IMAGE,
    num_poses=1,
    min_pose_detection_confidence=0.3,
    min_pose_presence_confidence=0.3,
    min_tracking_confidence=0.3,
)
landmarker = vision.PoseLandmarker.create_from_options(options)

POSE_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 7), (0, 4), (4, 5), (5, 6), (6, 8), (9, 10),
    (11, 12), (11, 13), (13, 15), (15, 17), (15, 19), (15, 21), (17, 19),
    (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),
    (11, 23), (12, 24), (23, 24), (23, 25), (24, 26), (25, 27), (26, 28),
    (27, 29), (28, 30), (29, 31), (30, 32), (27, 31), (28, 32)
]

from fastapi.responses import FileResponse

@app.get("/")
@app.get("//")
@app.get("/pose")
@app.get("//pose")
@app.get("/pose.html")
@app.get("//pose.html")
@app.get("/camera")
@app.get("//camera")
def get_pose_page():
    pose_file = os.path.join(STATIC_DIR, "pose.html")
    if os.path.exists(pose_file):
        return FileResponse(pose_file)
    return {"status": "ok", "message": "MediaPipe Pose Server Active"}

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

            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

            result = landmarker.detect(mp_image)

            fps_counter += 1
            now = time.time()
            elapsed = now - start_time
            current_fps = round(fps_counter / elapsed, 1) if elapsed > 0 else 0.0

            landmarks_list = []
            if result.pose_landmarks and len(result.pose_landmarks) > 0:
                for lm in result.pose_landmarks[0]:
                    landmarks_list.append({
                        "x": float(lm.x),
                        "y": float(lm.y),
                        "z": float(lm.z),
                        "visibility": float(lm.visibility) if hasattr(lm, 'visibility') and lm.visibility is not None else 1.0
                    })

                print(f"🧍 Frame #{fps_counter} | Pose DETECTED ({len(landmarks_list)} joints) | {current_fps} FPS", end="\r")
                await websocket.send_json({
                    "detected": True,
                    "landmarks": landmarks_list,
                    "fps": current_fps,
                    "connections": POSE_CONNECTIONS,
                })
            else:
                print(f"🔍 Frame #{fps_counter} | No person detected | {current_fps} FPS", end="\r")
                await websocket.send_json({
                    "detected": False,
                    "landmarks": [],
                    "fps": current_fps,
                    "connections": POSE_CONNECTIONS,
                })

    except WebSocketDisconnect:
        print("\nClient disconnected")
    except Exception as e:
        print(f"\nError processing frame: {e}")

if __name__ == "__main__":
    import uvicorn
    import subprocess
    import atexit

    TUNNEL_TOKEN = "eyJhIjoiZGIyYzI0NDJjY2Q1ODdmMDdhOThlYzE2MDgwMTQ5ZjUiLCJ0IjoiN2M1YmYwNTgtMTNhZS00OGI5LTgzMmEtZTc3OWMxZjMzNzMxIiwicyI6Ik5qWXlPRGMzWW1RdFpHVmlOaTAwTW1KbExUa3lZamN0Tm1NMFpqYzBNV1ptWWpWayJ9"

    tunnel_proc = None
    try:
        print("=" * 50)
        print("🚀 Starting Cloudflare Tunnel...")
        print("=" * 50)
        print("🔗 Public URL: https://app.codequestpro.in")
        print("🏠 Local server: http://localhost:8000")
        print("-" * 50)

        tunnel_proc = subprocess.Popen([
            "cloudflared",
            "tunnel",
            "run",
            "--token",
            TUNNEL_TOKEN
        ])

        def cleanup_tunnel():
            if tunnel_proc and tunnel_proc.poll() is None:
                print("\nStopping Cloudflare tunnel...")
                tunnel_proc.terminate()
                tunnel_proc.wait()

        atexit.register(cleanup_tunnel)
    except Exception as e:
        print(f"⚠️ Could not start Cloudflare tunnel: {e}")

    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    finally:
        if tunnel_proc and tunnel_proc.poll() is None:
            tunnel_proc.terminate()
