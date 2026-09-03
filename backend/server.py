import os
import base64
import cv2
import numpy as np
import time
import json
import uuid
import asyncio
from dotenv import load_dotenv

# Load environment variables from root directory .env
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env"))
load_dotenv(os.path.join(BASE_DIR, ".env"))
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

# ============= MATCHMAKING & CONNECTION SYSTEM =============

class ConnectionManager:
    def __init__(self):
        # user_id -> WebSocket
        self.active_connections: dict[str, WebSocket] = {}

    def register(self, user_id: str, ws: WebSocket):
        self.active_connections[user_id] = ws

    def unregister(self, user_id: str):
        self.active_connections.pop(user_id, None)

    def get(self, user_id: str) -> WebSocket | None:
        return self.active_connections.get(user_id)


class MatchmakingManager:
    def __init__(self, connection_mgr: ConnectionManager):
        self.connection_mgr = connection_mgr
        # exercise_id -> list of user_ids waiting in queue (1v1)
        self.queues: dict[str, list[str]] = {}
        # Set of all user IDs currently in any matchmaking queue
        self.queued_users: set[str] = set()
        # match_id -> Authoritative Match State (supports 1v1 and FFA multi-player)
        self.matches: dict[str, dict] = {}
        # player_id (user_id) -> match_id mapping for active games
        self.player_matches: dict[str, str] = {}
        # FFA Lobbies: exercise_id -> dict of lobby state
        # { "match_id": str, "players": list[str], "scores": dict[str, int], "start_time": float, "task": Task | None }
        self.ffa_lobbies: dict[str, dict] = {}
        # unique_username -> count of active presence sockets (deduplicates multi-tabs/reconnects)
        self.online_users: dict[str, int] = {}
        # exercise_id -> count of players currently waiting
        self.exercise_counts: dict[str, int] = {}
        # Connected presence websockets for broadcasting live count updates
        self.presence_sockets: set[WebSocket] = set()

    def normalize_username(self, user_id: str) -> str:
        """Extracts clean unique username to deduplicate multiple connections from same user."""
        if not user_id:
            return "anonymous"
        clean = str(user_id).strip().lower()
        if clean.startswith("anon_") or clean.startswith("player_"):
            return clean
        return clean

    async def add_presence(self, user_id: str, ws: WebSocket | None = None):
        uname = self.normalize_username(user_id)
        self.online_users[uname] = self.online_users.get(uname, 0) + 1
        if ws:
            self.presence_sockets.add(ws)
        print(f"🟢 User '{uname}' connected to presence (active sessions: {self.online_users[uname]}, total unique online: {len(self.online_users)})")
        await self.broadcast_online_count()

    async def remove_presence(self, user_id: str, ws: WebSocket | None = None):
        uname = self.normalize_username(user_id)
        if uname in self.online_users:
            self.online_users[uname] -= 1
            if self.online_users[uname] <= 0:
                del self.online_users[uname]
        if ws:
            self.presence_sockets.discard(ws)
        print(f"🔴 User '{uname}' disconnected from presence (total unique online: {len(self.online_users)})")
        await self.broadcast_online_count()

    async def broadcast_online_count(self):
        """Broadcasts authoritative unique online user count to all active presence listeners."""
        counts = self.get_counts()
        payload = json.dumps({"type": "online", "total": counts["total_online"], "exercise_counts": counts["exercise_counts"]})
        dead_sockets = []
        for s in list(self.presence_sockets):
            try:
                await s.send_text(payload)
            except Exception:
                dead_sockets.append(s)
        for d in dead_sockets:
            self.presence_sockets.discard(d)

    def get_counts(self):
        # Unique online presence union (presence users + active game connection users deduplicated by username)
        active_match_users = {self.normalize_username(u) for u in self.connection_mgr.active_connections.keys()}
        unique_online = set(self.online_users.keys()).union(active_match_users)
        return {
            "total_online": max(1, len(unique_online)),
            "exercise_counts": dict(self.exercise_counts),
        }

    async def join_ffa_lobby(self, user_id: str, exercise_id: str):
        """Adds player to a Free-for-All (FFA) lobby up to 10 players with a 30s countdown timer."""
        # Normalize exercise key to ensure exact match across any format ('1_ffa', '1', 'squats_ffa')
        clean_raw = str(exercise_id or "1").strip().lower()
        if not clean_raw.endswith("_ffa"):
            clean_ex_key = f"{clean_raw}_ffa"
        else:
            clean_ex_key = clean_raw

        self.leave_queue(user_id)

        # 1. First check: Is there an existing active lobby in waiting state for this exercise?
        lobby = self.ffa_lobbies.get(clean_ex_key)
        if not lobby or lobby.get("status") != "waiting":
            # Search across any waiting lobbies for matching exercise prefix (e.g. '1' or 'squats')
            base_id = clean_ex_key.replace("_ffa", "")
            for key, existing in list(self.ffa_lobbies.items()):
                if existing.get("status") == "waiting" and (key == clean_ex_key or key.replace("_ffa", "") == base_id):
                    lobby = existing
                    clean_ex_key = key
                    break

        if lobby and lobby.get("status") == "waiting":
            # Join existing active lobby!
            if user_id not in lobby["players"]:
                lobby["players"].append(user_id)
                lobby["scores"][user_id] = 0
                print(f"👥 '{user_id}' joined existing FFA Lobby #{lobby['match_id']} for '{clean_ex_key}' ({len(lobby['players'])}/10 players, {lobby.get('countdown', 30)}s remaining)")

            # If 10 players reached, start immediately
            if len(lobby["players"]) >= 10:
                if lobby.get("task"):
                    lobby["task"].cancel()
                await self.start_ffa_match(clean_ex_key, lobby["match_id"])
                return
        else:
            # No existing waiting lobby found -> Create new lobby and start 30s countdown timer
            match_id = str(uuid.uuid4())
            lobby = {
                "match_id": match_id,
                "exercise_id": clean_ex_key,
                "mode": "ffa",
                "players": [user_id],
                "scores": {user_id: 0},
                "status": "waiting",
                "countdown": 30,
                "created_at": time.time(),
            }
            self.ffa_lobbies[clean_ex_key] = lobby
            print(f"👑 Created new FFA Lobby #{match_id} for '{clean_ex_key}' initiated by '{user_id}' (30s timer started)")

            # Start 30s countdown background task
            async def ffa_countdown_task(ex_id: str, m_id: str):
                for remaining in range(30, 0, -1):
                    await asyncio.sleep(1)
                    curr_lobby = self.ffa_lobbies.get(ex_id)
                    if not curr_lobby or curr_lobby.get("match_id") != m_id or curr_lobby.get("status") != "waiting":
                        return
                    curr_lobby["countdown"] = remaining - 1
                    # Broadcast lobby status to all joined players
                    await self.broadcast_ffa_lobby_update(ex_id)

                # Start the FFA match after 30 seconds
                await self.start_ffa_match(ex_id, m_id)

            lobby["task"] = asyncio.create_task(ffa_countdown_task(clean_ex_key, match_id))

        # Broadcast update to everyone in this FFA lobby immediately
        await self.broadcast_ffa_lobby_update(clean_ex_key)

    async def broadcast_ffa_lobby_update(self, exercise_id: str):
        clean_ex_key = str(exercise_id).strip()
        lobby = self.ffa_lobbies.get(clean_ex_key)
        if not lobby:
            return
        payload = json.dumps({
            "type": "ffa_lobby_update",
            "match_id": lobby["match_id"],
            "exercise_id": clean_ex_key,
            "players": lobby["players"],
            "player_count": len(lobby["players"]),
            "countdown": lobby.get("countdown", 30),
            "status": lobby.get("status", "waiting"),
        })
        for pid in list(lobby["players"]):
            p_ws = self.connection_mgr.get(pid)
            if p_ws:
                try:
                    await p_ws.send_text(payload)
                except Exception:
                    pass

    async def start_ffa_match(self, exercise_id: str, match_id: str):
        lobby = self.ffa_lobbies.get(exercise_id)
        if not lobby or lobby.get("match_id") != match_id:
            return

        lobby["status"] = "in_progress"
        players = list(lobby["players"])

        # Store in matches dictionary
        self.matches[match_id] = {
            "match_id": match_id,
            "exercise_id": exercise_id,
            "mode": "ffa",
            "players": players,
            "scores": {p: 0 for p in players},
            "status": "in_progress",
            "created_at": time.time(),
        }

        # Map each player to this match_id
        for p in players:
            self.player_matches[p] = match_id

        # Notify all players that FFA game has started
        start_payload = json.dumps({
            "type": "ffa_matched",
            "match_id": match_id,
            "exercise_id": exercise_id,
            "mode": "ffa",
            "players": players,
            "player_count": len(players),
        })

        for p in players:
            p_ws = self.connection_mgr.get(p)
            if p_ws:
                try:
                    await p_ws.send_text(start_payload)
                except Exception:
                    pass

        # Clear FFA waiting lobby for next queue
        if self.ffa_lobbies.get(exercise_id, {}).get("match_id") == match_id:
            del self.ffa_lobbies[exercise_id]

        print(f"🚀 FFA Match #{match_id} started for exercise '{exercise_id}' with {len(players)} players: {players}")

    def join_queue(self, user_id: str, exercise_id: str):
        """Adds a player to a standard 1v1 queue. If 2 players are present, creates a new unique match."""
        # Ensure user isn't duplicated in queues
        self.leave_queue(user_id)

        queue = self.queues.setdefault(exercise_id, [])
        queue.append(user_id)
        self.queued_users.add(user_id)
        self.exercise_counts[exercise_id] = len(queue)
        print(f"👤 {user_id} joined queue for exercise '{exercise_id}' (queue length: {len(queue)})")

        if len(queue) >= 2:
            p1_id = queue.pop(0)
            p2_id = queue.pop(0)
            self.queued_users.discard(p1_id)
            self.queued_users.discard(p2_id)
            self.exercise_counts[exercise_id] = len(queue)

            # Generate separate, collision-free UUID match_id
            match_id = str(uuid.uuid4())

            # Authoritative match state
            self.matches[match_id] = {
                "match_id": match_id,
                "exercise_id": exercise_id,
                "mode": "1v1",
                "player1_id": p1_id,
                "player2_id": p2_id,
                "player1_score": 0,
                "player2_score": 0,
                "player1_ready": False,
                "player2_ready": False,
                "status": "in_progress",
                "created_at": time.time(),
                "last_update_p1": time.time(),
                "last_update_p2": time.time(),
            }

            # Map both players to this match_id
            self.player_matches[p1_id] = match_id
            self.player_matches[p2_id] = match_id

            print(f"🔗 Authoritative Match #{match_id} started for '{exercise_id}' between {p1_id} and {p2_id}")
            return match_id, p1_id, p2_id

        return None, None, None

    def get_match_id(self, user_id: str) -> str | None:
        """Retrieves match_id for a player dynamically, resolving Player 1 and Player 2 alike."""
        return self.player_matches.get(user_id)

    def get_match(self, match_id: str) -> dict | None:
        return self.matches.get(match_id)

    def leave_queue(self, user_id: str, exercise_id: str | None = None):
        """Removes user from matchmaking queue only (does not touch active matches)."""
        self.queued_users.discard(user_id)
        if exercise_id:
            clean_ex = str(exercise_id).strip()
            q = self.queues.get(clean_ex, [])
            self.queues[clean_ex] = [u for u in q if u != user_id]
            self.exercise_counts[clean_ex] = len(self.queues[clean_ex])
            # Also remove from waiting FFA lobby if applicable
            ffa = self.ffa_lobbies.get(clean_ex)
            if ffa and user_id in ffa.get("players", []):
                ffa["players"] = [p for p in ffa["players"] if p != user_id]
                ffa.get("scores", {}).pop(user_id, None)
                if not ffa["players"]:
                    if ffa.get("task"):
                        ffa["task"].cancel()
                    self.ffa_lobbies.pop(clean_ex, None)
        else:
            for ex_id, q in list(self.queues.items()):
                self.queues[ex_id] = [u for u in q if u != user_id]
                self.exercise_counts[ex_id] = len(self.queues[ex_id])
            for ex_id, ffa in list(self.ffa_lobbies.items()):
                if user_id in ffa.get("players", []):
                    ffa["players"] = [p for p in ffa["players"] if p != user_id]
                    ffa.get("scores", {}).pop(user_id, None)
                    if not ffa["players"]:
                        if ffa.get("task"):
                            ffa["task"].cancel()
                        self.ffa_lobbies.pop(ex_id, None)

    async def remove_match(self, match_id: str, reason: str = "ended", leaving_user_id: str | None = None):
        """Dedicated cleanup for active matches (both 1v1 and FFA)."""
        match = self.matches.pop(match_id, None)
        if not match:
            return

        is_ffa = match.get("mode") == "ffa"

        if is_ffa:
            players = match.get("players", [])
            for p in players:
                self.player_matches.pop(p, None)
                if p != leaving_user_id:
                    p_ws = self.connection_mgr.get(p)
                    if p_ws:
                        try:
                            await p_ws.send_text(json.dumps({
                                "type": "player_left_ffa",
                                "match_id": match_id,
                                "sender": leaving_user_id or "system",
                                "players": [x for x in players if x != leaving_user_id],
                            }))
                        except Exception:
                            pass
        else:
            p1_id = match.get("player1_id")
            p2_id = match.get("player2_id")

            if p1_id:
                self.player_matches.pop(p1_id, None)
            if p2_id:
                self.player_matches.pop(p2_id, None)

            opponent_id = p2_id if leaving_user_id == p1_id else p1_id
            if opponent_id:
                opponent_ws = self.connection_mgr.get(opponent_id)
                if opponent_ws:
                    try:
                        await opponent_ws.send_text(json.dumps({
                            "type": "opponent_left",
                            "reason": reason,
                            "match_id": match_id,
                            "sender": leaving_user_id or "system",
                        }))
                    except Exception as err:
                        print(f"⚠️ Failed to notify opponent {opponent_id} of match exit: {err}")

        print(f"🗑️ Match #{match_id} cleaned up (reason: {reason})")

    async def handle_leave(self, user_id: str, exercise_id: str | None = None):
        """Lifecycle handler for player exit."""
        match_id = self.player_matches.get(user_id)
        if match_id:
            await self.remove_match(match_id, reason="player_left", leaving_user_id=user_id)
        else:
            self.leave_queue(user_id, exercise_id)

conn_manager = ConnectionManager()
matchmaker = MatchmakingManager(conn_manager)

@app.get("/api/online")
async def get_online_count():
    return JSONResponse(matchmaker.get_counts())

@app.websocket("/ws/presence")
async def presence_websocket(ws: WebSocket):
    await ws.accept()
    user_id = f"anon_{uuid.uuid4().hex[:8]}"
    try:
        init = await ws.receive_text()
        try:
            data = json.loads(init)
            user_id = data.get("user_id", user_id)
        except Exception:
            pass

        await matchmaker.add_presence(user_id, ws)

        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await matchmaker.remove_presence(user_id, ws)
        print(f"\n🔌 User {user_id} disconnected from presence")

ALLOWED_MESSAGE_TYPES = {
    "score",
    "peer_ready",
    "frame",
    "rematch_request",
    "rematch_accepted",
    "rematch_declined",
    "game_end",
    "leave",
    "match_leave",
    "ping",
}

@app.websocket("/ws/match")
async def match_websocket(ws: WebSocket):
    await ws.accept()
    user_id = f"anon_{uuid.uuid4().hex[:8]}"
    exercise_id = "1"

    try:
        init = await ws.receive_text()
        try:
            data = json.loads(init)
            user_id = data.get("user_id", user_id)
            exercise_id = str(data.get("exercise_id", "1"))
        except Exception:
            pass

        conn_manager.register(user_id, ws)
        await ws.send_text(json.dumps({"type": "joined", "user_id": user_id}))

        is_ffa_request = exercise_id.endswith("_ffa") or exercise_id.startswith("ffa_")

        if is_ffa_request:
            await matchmaker.join_ffa_lobby(user_id, exercise_id)
        else:
            match_id, p1_id, p2_id = matchmaker.join_queue(user_id, exercise_id)

            if match_id:
                p1_ws = conn_manager.get(p1_id)
                p2_ws = conn_manager.get(p2_id)
                if p1_ws:
                    await p1_ws.send_text(json.dumps({
                        "type": "matched",
                        "match_id": match_id,
                        "exercise_id": exercise_id,
                        "mode": "1v1",
                        "role": "player1",
                        "opponent": p2_id,
                    }))
                if p2_ws:
                    await p2_ws.send_text(json.dumps({
                        "type": "matched",
                        "match_id": match_id,
                        "exercise_id": exercise_id,
                        "mode": "1v1",
                        "role": "player2",
                        "opponent": p1_id,
                    }))

        # Message Handling Loop
        while True:
            raw_msg = await ws.receive_text()
            try:
                msg = json.loads(raw_msg)
            except Exception as e:
                print(f"⚠️ Invalid JSON from {user_id}: {raw_msg} ({e})")
                continue

            msg_type = msg.get("type")
            if msg_type not in ALLOWED_MESSAGE_TYPES:
                print(f"⚠️ Unauthorized message type '{msg_type}' from {user_id}")
                continue

            if msg_type in ("leave", "match_leave"):
                await matchmaker.handle_leave(user_id, exercise_id)
                break

            if msg_type == "ping":
                await ws.send_text(json.dumps({"type": "pong", "time": time.time()}))
                continue

            # Resolve match dynamically via authoritative server-side player_matches mapping
            active_match_id = matchmaker.get_match_id(user_id)
            if not active_match_id:
                # Player not in an active match yet
                continue

            match = matchmaker.get_match(active_match_id)
            if not match:
                continue

            is_ffa = (match.get("mode") == "ffa")

            if is_ffa:
                players = match.get("players", [])
                if user_id not in players:
                    print(f"⚠️ Security: User {user_id} attempted action on unassigned FFA match #{active_match_id}")
                    continue

                if msg_type == "score":
                    raw_score = int(msg.get("score", 0))
                    score_val = max(0, min(1000, raw_score))
                    match["scores"][user_id] = score_val

                    # Generate sorted live leaderboard: highest score / reps first
                    leaderboard = [
                        {"username": pid, "score": sc}
                        for pid, sc in match["scores"].items()
                    ]
                    leaderboard.sort(key=lambda x: x["score"], reverse=True)

                    # Broadcast live FFA leaderboard to all participants in this room
                    board_payload = json.dumps({
                        "type": "ffa_leaderboard",
                        "match_id": active_match_id,
                        "leaderboard": leaderboard,
                        "sender": user_id,
                        "score": score_val,
                    })

                    for pid in players:
                        p_ws = conn_manager.get(pid)
                        if p_ws:
                            try:
                                await p_ws.send_text(board_payload)
                            except Exception:
                                pass

                elif msg_type == "peer_ready":
                    ready_players = match.setdefault("ready_players", set())
                    ready_players.add(user_id)
                    all_ready = len(ready_players) >= len(players)

                    ready_payload = json.dumps({
                        "type": "ffa_ready_update",
                        "match_id": active_match_id,
                        "sender": user_id,
                        "ready_count": len(ready_players),
                        "total_players": len(players),
                        "all_ready": all_ready,
                    })
                    for pid in players:
                        p_ws = conn_manager.get(pid)
                        if p_ws:
                            try:
                                await p_ws.send_text(ready_payload)
                            except Exception:
                                pass

                elif msg_type == "game_end":
                    match["status"] = "completed"
                    leaderboard = [
                        {"username": pid, "score": sc}
                        for pid, sc in match["scores"].items()
                    ]
                    leaderboard.sort(key=lambda x: x["score"], reverse=True)

                    end_payload = json.dumps({
                        "type": "ffa_game_end",
                        "match_id": active_match_id,
                        "leaderboard": leaderboard,
                        "sender": user_id,
                    })

                    for pid in players:
                        p_ws = conn_manager.get(pid)
                        if p_ws:
                            try:
                                await p_ws.send_text(end_payload)
                            except Exception:
                                pass

                    async def delayed_ffa_cleanup(m_id: str):
                        await asyncio.sleep(60)
                        m = matchmaker.get_match(m_id)
                        if m and m.get("status") == "completed":
                            await matchmaker.remove_match(m_id, reason="ffa_completed")

                    asyncio.create_task(delayed_ffa_cleanup(active_match_id))

            else:
                # Standard 1v1 Match Logic
                p1_id = match["player1_id"]
                p2_id = match["player2_id"]
                if user_id != p1_id and user_id != p2_id:
                    print(f"⚠️ Security: User {user_id} attempted action on unassigned match #{active_match_id}")
                    continue

                is_p1 = (user_id == p1_id)
                opponent_id = p2_id if is_p1 else p1_id
                opponent_ws = conn_manager.get(opponent_id)

                if not opponent_ws:
                    continue

                if msg_type == "score":
                    raw_score = int(msg.get("score", 0))
                    score_val = max(0, min(1000, raw_score))

                    now = time.time()
                    if is_p1:
                        match["player1_score"] = score_val
                        match["last_update_p1"] = now
                    else:
                        match["player2_score"] = score_val
                        match["last_update_p2"] = now

                    await opponent_ws.send_text(json.dumps({
                        "type": "score",
                        "score": score_val,
                        "match_id": active_match_id,
                        "sender": user_id,
                    }))

                elif msg_type == "peer_ready":
                    if is_p1:
                        match["player1_ready"] = True
                    else:
                        match["player2_ready"] = True

                    await opponent_ws.send_text(json.dumps({
                        "type": "peer_ready",
                        "match_id": active_match_id,
                        "sender": user_id,
                    }))

                elif msg_type == "frame":
                    frame_data = msg.get("data")
                    if frame_data and isinstance(frame_data, str):
                        await opponent_ws.send_text(json.dumps({
                            "type": "frame",
                            "match_id": active_match_id,
                            "data": frame_data,
                        }))

                elif msg_type == "game_end":
                    match["status"] = "completed"
                    final_p1_score = match.get("player1_score", 0)
                    final_p2_score = match.get("player2_score", 0)

                    await opponent_ws.send_text(json.dumps({
                        "type": "game_end",
                        "match_id": active_match_id,
                        "player1_score": final_p1_score,
                        "player2_score": final_p2_score,
                        "sender": user_id,
                    }))

                    async def delayed_match_cleanup(m_id: str):
                        await asyncio.sleep(60)
                        m = matchmaker.get_match(m_id)
                        if m and m.get("status") == "completed":
                            await matchmaker.remove_match(m_id, reason="match_completed")

                    asyncio.create_task(delayed_match_cleanup(active_match_id))

                elif msg_type in ("rematch_request", "rematch_accepted", "rematch_declined"):
                    if msg_type == "rematch_accepted":
                        match["player1_score"] = 0
                        match["player2_score"] = 0
                        match["player1_ready"] = False
                        match["player2_ready"] = False
                        match["status"] = "in_progress"

                    await opponent_ws.send_text(json.dumps({
                        "type": msg_type,
                        "match_id": active_match_id,
                        "sender": user_id,
                    }))

    except WebSocketDisconnect:
        conn_manager.unregister(user_id)
        await matchmaker.handle_leave(user_id, exercise_id)
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

    TUNNEL_TOKEN = os.getenv("CLOUDFLARE_TUNNEL_TOKEN", "")

    tunnel_proc = None
    if TUNNEL_TOKEN:
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
    else:
        print("ℹ️ No CLOUDFLARE_TUNNEL_TOKEN set. Running locally on port 8000.")

    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    finally:
        if tunnel_proc and tunnel_proc.poll() is None:
            tunnel_proc.terminate()
