#!/home/sankhyahrick/Python/bin/python
import os
import base64
import cv2
import numpy as np
import time
import json
import uuid
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
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

# ============= MATCHMAKING SYSTEM =============

class MatchmakingManager:
    def __init__(self):
        self.queues: dict[str, list] = {}
        self.matches: dict[str, dict] = {}
        self.online_users: set = set()
        self.exercise_counts: dict[str, int] = {}

    def join_queue(self, ws, user_id, exercise_id):
        self.online_users.add(user_id)
        queue = self.queues.setdefault(exercise_id, [])
        queue.append({"ws": ws, "user_id": user_id})
        self.exercise_counts[exercise_id] = len(queue)
        print(f"👤 {user_id} joined queue for {exercise_id} (count: {len(queue)})")

        if len(queue) >= 2:
            player1 = queue.pop(0)
            player2 = queue.pop(0)
            match_id = str(uuid.uuid4())[:8]
            self.matches[match_id] = {
                "player1": player1,
                "player2": player2,
                "exercise_id": exercise_id,
            }
            self.exercise_counts[exercise_id] = len(queue)
            print(f"🔗 Match #{match_id} created for exercise {exercise_id}")
            return match_id, player1, player2
        return None, None, None

    def leave_queue(self, user_id, exercise_id=None):
        self.online_users.discard(user_id)
        if exercise_id:
            queue = self.queues.get(exercise_id, [])
            self.queues[exercise_id] = [p for p in queue if p["user_id"] != user_id]
            self.exercise_counts[exercise_id] = len(self.queues[exercise_id])

    def cancel_match(self, match_id):
        match = self.matches.pop(match_id, None)
        if match:
            for p in [match["player1"], match["player2"]]:
                self.leave_queue(p["user_id"], match["exercise_id"])

    def get_counts(self):
        return {
            "total_online": len(self.online_users),
            "exercise_counts": dict(self.exercise_counts),
        }

matchmaker = MatchmakingManager()

@app.get("/api/online")
async def get_online_count():
    return JSONResponse(matchmaker.get_counts())

@app.websocket("/ws/presence")
async def presence_websocket(ws: WebSocket):
    await ws.accept()
    try:
        init = await ws.receive_text()
        data = json.loads(init)
        user_id = data.get("user_id", f"anon_{uuid.uuid4().hex[:8]}")
        matchmaker.online_users.add(user_id)
        await ws.send_text(json.dumps({"type": "online", "total": len(matchmaker.online_users)}))

        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        matchmaker.online_users.discard(user_id)
        print(f"\n🔌 User {user_id} disconnected from presence")

@app.websocket("/ws/match")
async def match_websocket(ws: WebSocket):
    await ws.accept()
    user_id = None
    exercise_id = None

    try:
        init = await ws.receive_text()
        data = json.loads(init)
        user_id = data.get("user_id", f"anon_{uuid.uuid4().hex[:8]}")
        exercise_id = data.get("exercise_id", "1")
        await ws.send_text(json.dumps({"type": "joined", "user_id": user_id}))

        match_id, p1, p2 = matchmaker.join_queue(ws, user_id, exercise_id)

        if match_id:
            for player, role in [(p1, "player1"), (p2, "player2")]:
                await player["ws"].send_text(json.dumps({
                    "type": "matched",
                    "match_id": match_id,
                    "role": role,
                    "opponent": p2["user_id"] if role == "player1" else p1["user_id"],
                }))

        while True:
            msg = await ws.receive_text()
            if match_id:
                match = matchmaker.matches.get(match_id)
                if match:
                    opponent = match["player2"] if ws == match["player1"]["ws"] else match["player1"]
                    try:
                        await opponent["ws"].send_text(msg)
                    except Exception as e:
                        print(f"Error forwarding match data: {e}")
    except WebSocketDisconnect:
        matchmaker.leave_queue(user_id, exercise_id)
        if match_id:
            matchmaker.cancel_match(match_id)
        print(f"\n🔌 User {user_id} disconnected from matchmaking")

# ============= STREAMING SYSTEM (/{username} path) =============

class StreamManager:
    def __init__(self):
        self.streams: dict[str, dict] = {}

    def add_sender(self, username, ws):
        if username not in self.streams:
            self.streams[username] = {"senders": [], "viewers": []}
        self.streams[username]["senders"].append(ws)
        print(f"📺 Sender registered: {username}")

    def add_viewer(self, username, ws):
        if username not in self.streams:
            self.streams[username] = {"senders": [], "viewers": []}
        self.streams[username]["viewers"].append(ws)
        print(f"👁️  Viewer registered for stream: {username}")

    def remove_connection(self, username, ws):
        if username not in self.streams:
            return
        self.streams[username]["senders"] = [w for w in self.streams[username]["senders"] if w is not ws]
        self.streams[username]["viewers"] = [w for w in self.streams[username]["viewers"] if w is not ws]
        if not self.streams[username]["senders"] and not self.streams[username]["viewers"]:
            del self.streams[username]

    def broadcast_to_viewers(self, username, msg):
        if username not in self.streams:
            return
        viewers = self.streams[username]["viewers"]
        for viewer_ws in viewers:
            try:
                if viewer_ws.application_state == "connected":
                    import asyncio
                    asyncio.create_task(viewer_ws.send_text(msg))
            except Exception as e:
                print(f"📡 Error broadcasting to viewer: {e}")

stream_manager = StreamManager()

@app.websocket("/ws/stream/{username}")
async def stream_websocket(ws: WebSocket, username: str):
    await ws.accept()
    role = None

    try:
        init = await ws.receive_text()
        data = json.loads(init)
        role = data.get("role", "sender")

        if role == "sender":
            stream_manager.add_sender(username, ws)
            await ws.send_text(json.dumps({"type": "stream_started", "username": username}))
        elif role == "viewer":
            stream_manager.add_viewer(username, ws)
            await ws.send_text(json.dumps({"type": "viewing", "username": username}))

        while True:
            msg = await ws.receive_text()
            if role == "sender":
                stream_manager.broadcast_to_viewers(username, msg)
            else:
                await ws.send_text(json.dumps({"type": "error", "msg": "Viewers cannot send stream data"}))
    except WebSocketDisconnect:
        stream_manager.remove_connection(username, ws)
        print(f"\n🔌 User {username} ({role}) disconnected from stream")
    except Exception as e:
        print(f"\nStream error: {e}")
        stream_manager.remove_connection(username, ws)

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
