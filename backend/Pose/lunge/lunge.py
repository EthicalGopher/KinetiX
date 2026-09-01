import os
import time
from collections import deque

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


# =============================================================================
# 1. Landmarker Setup
# =============================================================================

def create_landmarker(model_path="pose_landmarker_lite.task"):
    """Initialize MediaPipe Pose Landmarker for video mode."""
    base_options = python.BaseOptions(model_asset_path=model_path)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
    )
    return vision.PoseLandmarker.create_from_options(options)


# =============================================================================
# 2. Landmark Indices & Connections
# =============================================================================

NOSE = 0
LEFT_SHOULDER, RIGHT_SHOULDER = 11, 12
LEFT_ELBOW, RIGHT_ELBOW = 13, 14
LEFT_WRIST, RIGHT_WRIST = 15, 16
LEFT_HIP, RIGHT_HIP = 23, 24
LEFT_KNEE, RIGHT_KNEE = 25, 26
LEFT_ANKLE, RIGHT_ANKLE = 27, 28
LEFT_FOOT_INDEX, RIGHT_FOOT_INDEX = 31, 32

REQUIRED_LANDMARKS = [
    LEFT_SHOULDER, RIGHT_SHOULDER,
    LEFT_HIP, RIGHT_HIP,
    LEFT_KNEE, RIGHT_KNEE,
    LEFT_ANKLE, RIGHT_ANKLE,
]

# Standard 33-point pose skeleton connections (index pairs).
POSE_CONNECTIONS = [
    (conn.start, conn.end) for conn in vision.PoseLandmarksConnections.POSE_LANDMARKS
]


# =============================================================================
# 3. Video Source & Configuration
# =============================================================================

# Live webcam (0). To use a recorded video file, set e.g. VIDEO_SOURCE = "lunge_video.mp4"
VIDEO_SOURCE = 0

# State-detection angle thresholds (in degrees)
# Straight standing legs ~160-180 deg (UP), Front knee ~80-100 deg & Back knee ~80-110 deg (BOTTOM)
KNEE_UP_THRESHOLD = 160.0             # >= this => standing upright (UP)
FRONT_KNEE_BOTTOM_THRESHOLD = 100.0   # <= this => front knee at depth (BOTTOM)
BACK_KNEE_BOTTOM_THRESHOLD = 115.0    # <= this => back knee lowered (BOTTOM)

# Temporal smoothing & debouncing
SMOOTHING_WINDOW = 5                  # Frames for sliding-window moving-average filter
DEBOUNCE_FRAMES = 5                   # Consecutive frames a state must persist to confirm transition

# Form check thresholds
HIP_TILT_THRESHOLD = 12.0             # Pelvis tilting / twisting
TORSO_LEAN_THRESHOLD = 20.0           # Leaning forward over front leg
SHOULDER_TILT_THRESHOLD = 15.0        # Uneven shoulder line

# Visibility thresholds
VISIBILITY_THRESHOLD = 0.5            # Smoothed visibility required to trust pose & drive state machine
DRAW_VISIBILITY_THRESHOLD = 0.2       # Landmarks/connections below this are not drawn (noise filter)

# CSV logging configuration
# -----------------------------------------------------------------------------
# ML DATASET ARCHITECTURE NOTE:
# - INPUT FEATURES (for future ML models):
#     timestamp, lead_leg, front_knee_angle, back_knee_angle,
#     smoothed_front_knee, smoothed_back_knee, front_hip_angle,
#     back_hip_angle, torso_angle, hip_tilt_angle, shoulder_tilt_angle,
#     visibility (+ sliding temporal windows)
# - TARGET / GROUND TRUTH LABEL:
#     state (UP, DOWN, BOTTOM)
# - FORM QUALITY LABELS:
#     form_status (GOOD, FORM ISSUE), feedback
# - DERIVED SESSION OUTPUT:
#     rep_count, left_reps, right_reps
# -----------------------------------------------------------------------------
CSV_PATH = "lunge_dataset.csv"
FLUSH_EVERY = 30
CSV_COLUMNS = [
    "timestamp",
    "lead_leg",
    "front_knee_angle",
    "back_knee_angle",
    "smoothed_front_knee",
    "smoothed_back_knee",
    "front_hip_angle",
    "back_hip_angle",
    "torso_angle",
    "hip_tilt_angle",
    "shoulder_tilt_angle",
    "visibility",
    "state",
    "rep_count",
    "left_reps",
    "right_reps",
    "form_status",
    "feedback",
]


# =============================================================================
# 4. Geometry Helpers
# =============================================================================

def _xy(lm):
    """Convert landmark to (x, y) numpy array."""
    return np.array([lm.x, lm.y], dtype=np.float32)


def _midpoint(a, b):
    """Midpoint (x, y) of two landmarks."""
    return (_xy(a) + _xy(b)) / 2.0


def calculate_angle(a, b, c):
    """Angle at point b, formed by rays b->a and b->c, in degrees [0, 180]."""
    a, b, c = _xy(a), _xy(b), _xy(c)
    ba = a - b
    bc = c - b

    norm_ba = np.linalg.norm(ba)
    norm_bc = np.linalg.norm(bc)
    if norm_ba < 1e-7 or norm_bc < 1e-7:
        return 0.0

    radians = np.arctan2(bc[1], bc[0]) - np.arctan2(ba[1], ba[0])
    angle = np.abs(radians * 180.0 / np.pi)
    if angle > 180.0:
        angle = 360.0 - angle
    return float(angle)


def horizontal_angle_of_vector(vec):
    """Angle (degrees) of a 2D vector relative to horizontal [0, 180]."""
    horizontal_vec = np.array([1.0, 0.0], dtype=np.float32)
    denom = np.linalg.norm(vec) * np.linalg.norm(horizontal_vec)
    if denom < 1e-8:
        return 0.0
    cos_angle = np.dot(vec, horizontal_vec) / denom
    cos_angle = np.clip(cos_angle, -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_angle)))


def vertical_angle_of_vector(vec):
    """Angle (degrees) of a 2D vector relative to vertical (0 = upright)."""
    vertical_vec = np.array([0.0, -1.0], dtype=np.float32)
    denom = np.linalg.norm(vec) * np.linalg.norm(vertical_vec)
    if denom < 1e-8:
        return 0.0
    cos_angle = np.dot(vec, vertical_vec) / denom
    cos_angle = np.clip(cos_angle, -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_angle)))


def calculate_torso_angle(shoulder_l, shoulder_r, hip_l, hip_r):
    """
    Angle of the torso relative to vertical (0 = perfectly upright).
    Uses shoulder/hip midpoints to remain robust against torso rotation.
    """
    shoulder_mid = _midpoint(shoulder_l, shoulder_r)
    hip_mid = _midpoint(hip_l, hip_r)
    return vertical_angle_of_vector(shoulder_mid - hip_mid)


def determine_front_leg(pose):
    """
    Identifies which leg is currently the FRONT (lead) leg vs BACK leg.
    Uses ankle x displacement relative to mid-hip and body facing direction.
    """
    mid_hip = _midpoint(pose[LEFT_HIP], pose[RIGHT_HIP])
    nose_xy = _xy(pose[NOSE])

    # Determine facing direction (relative x of nose vs hips)
    facing_dir = 1.0 if (nose_xy[0] - mid_hip[0]) >= 0 else -1.0

    left_ankle_x = pose[LEFT_ANKLE].x
    right_ankle_x = pose[RIGHT_ANKLE].x

    left_lead_dist = (left_ankle_x - mid_hip[0]) * facing_dir
    right_lead_dist = (right_ankle_x - mid_hip[0]) * facing_dir

    if left_lead_dist >= right_lead_dist:
        return "LEFT"
    else:
        return "RIGHT"


# =============================================================================
# 5. Drawing Helpers (Pose Skeleton)
# =============================================================================

def draw_pose_skeleton(frame, pose):
    """
    Draws 33 pose landmarks and skeleton connections on the frame,
    color-coded by landmark visibility confidence.

    Green  = Confident (visibility >= VISIBILITY_THRESHOLD)
    Orange = Borderline (DRAW_VISIBILITY_THRESHOLD <= visibility < VISIBILITY_THRESHOLD)
    """
    h, w = frame.shape[:2]

    def point_px(lm):
        return int(lm.x * w), int(lm.y * h)

    def color_for(visibility):
        if visibility >= VISIBILITY_THRESHOLD:
            return (0, 255, 0)      # Green (BGR)
        return (0, 165, 255)        # Orange (BGR)

    # Draw connection lines first so landmark dots appear on top
    for start_idx, end_idx in POSE_CONNECTIONS:
        start_lm = pose[start_idx]
        end_lm = pose[end_idx]

        if start_lm.visibility < DRAW_VISIBILITY_THRESHOLD or \
                end_lm.visibility < DRAW_VISIBILITY_THRESHOLD:
            continue

        edge_color = color_for(min(start_lm.visibility, end_lm.visibility))
        cv2.line(frame, point_px(start_lm), point_px(end_lm), edge_color, 2)

    # Draw landmark dots
    for lm in pose:
        if lm.visibility < DRAW_VISIBILITY_THRESHOLD:
            continue
        cv2.circle(frame, point_px(lm), 4, color_for(lm.visibility), -1)


# =============================================================================
# 6. Temporal Smoothing Filter
# =============================================================================

class MovingAverage:
    """Sliding-window moving average filter to denoise per-frame measurements."""

    def __init__(self, window_size):
        self.values = deque(maxlen=window_size)

    def update(self, value):
        self.values.append(value)
        return sum(self.values) / len(self.values)

    @property
    def ready(self):
        return len(self.values) > 0


# =============================================================================
# 7. Direction-Aware State Classification & Debouncing
# =============================================================================

def classify_state(front_knee_angle, back_knee_angle, current_state):
    """
    Direction-aware state classifier for lunges.

    Enforces valid biological progression and prevents impossible direct jumps:
      - From UP: Can only transition to DOWN (UP -> DOWN -> BOTTOM)
      - From BOTTOM: Can only transition to DOWN (BOTTOM -> DOWN -> UP)
      - From DOWN: Can transition to BOTTOM (descending) or UP (ascending)
    """
    if current_state == "UP":
        if front_knee_angle < KNEE_UP_THRESHOLD:
            return "DOWN"
        return "UP"

    elif current_state == "BOTTOM":
        if front_knee_angle <= FRONT_KNEE_BOTTOM_THRESHOLD and back_knee_angle <= BACK_KNEE_BOTTOM_THRESHOLD:
            return "BOTTOM"
        return "DOWN"

    elif current_state == "DOWN":
        if front_knee_angle <= FRONT_KNEE_BOTTOM_THRESHOLD and back_knee_angle <= BACK_KNEE_BOTTOM_THRESHOLD:
            return "BOTTOM"
        elif front_knee_angle >= KNEE_UP_THRESHOLD and back_knee_angle >= KNEE_UP_THRESHOLD:
            return "UP"
        return "DOWN"

    return "UP"


class DebouncedState:
    """
    Filters out transient noise / single-frame spikes. A candidate state must
    persist for `debounce_frames` consecutive valid frames to be confirmed.
    """

    def __init__(self, debounce_frames, initial_state="UP"):
        self.debounce_frames = debounce_frames
        self.confirmed_state = initial_state
        self._candidate_state = None
        self._candidate_count = 0

    def update(self, raw_state):
        """Returns (confirmed_state, changed) tuple for the current frame."""
        if raw_state == self.confirmed_state:
            self._candidate_state = None
            self._candidate_count = 0
            return self.confirmed_state, False

        if raw_state == self._candidate_state:
            self._candidate_count += 1
        else:
            self._candidate_state = raw_state
            self._candidate_count = 1

        if self._candidate_count >= self.debounce_frames:
            self.confirmed_state = raw_state
            self._candidate_state = None
            self._candidate_count = 0
            return self.confirmed_state, True

        return self.confirmed_state, False

    def reset_candidate(self):
        """Clears pending candidate state when tracking is lost or invalid."""
        self._candidate_state = None
        self._candidate_count = 0


# =============================================================================
# 8. Rep Counting State Machine & Form Evaluator
# =============================================================================

class LungeRepCounter:
    """
    Tracks confirmed state transitions and increments rep counts per leg:
      UP -> DOWN -> BOTTOM -> DOWN -> UP

    A shallow lunge (UP -> DOWN -> UP) is registered as incomplete and not counted.
    Direct illegal transitions are rejected.
    """

    ALLOWED_TRANSITIONS = {
        "UP": {"DOWN"},
        "DOWN": {"BOTTOM", "UP"},
        "BOTTOM": {"DOWN"},
    }

    def __init__(self):
        self.state = "UP"
        self.rep_count = 0
        self.left_reps = 0
        self.right_reps = 0
        self.shallow_count = 0
        self._reached_bottom = False
        self._current_lead_leg = "LEFT"

    def set_lead_leg(self, lead_leg):
        if self.state in ("DOWN", "BOTTOM"):
            self._current_lead_leg = lead_leg

    def process_transition(self, new_state, lead_leg=None):
        if new_state == self.state:
            return

        valid_targets = self.ALLOWED_TRANSITIONS.get(self.state, set())
        if new_state not in valid_targets:
            print(f"[warning] Blocked invalid direct transition: {self.state} -> {new_state}")
            return

        print(f"[state] {self.state} -> {new_state} (Lead: {self._current_lead_leg})")

        if new_state == "BOTTOM":
            self._reached_bottom = True
            if lead_leg:
                self._current_lead_leg = lead_leg

        if new_state == "UP" and self.state == "DOWN":
            if self._reached_bottom:
                self.rep_count += 1
                if self._current_lead_leg == "LEFT":
                    self.left_reps += 1
                else:
                    self.right_reps += 1
                print(f"[rep] Rep #{self.rep_count} counted ({self._current_lead_leg} leg lead)")
            else:
                self.shallow_count += 1
                print("[rep] Shallow lunge - NOT counted (never reached BOTTOM)")
            self._reached_bottom = False

        self.state = new_state


def evaluate_lunge_form(
    torso_angle, hip_tilt, shoulder_tilt, front_knee, back_knee, current_state
):
    """
    Evaluates lunge biomechanics and form quality independently of rep counter.
    Returns (form_status, feedback_message) tuple.
    """
    feedback = "Good Form"
    is_good = True

    # 1. Torso upright check
    if torso_angle > TORSO_LEAN_THRESHOLD:
        is_good = False
        feedback = "Keep torso upright - don't lean forward"

    # 2. Pelvis / Hip level check
    elif hip_tilt > HIP_TILT_THRESHOLD:
        is_good = False
        feedback = "Pelvis tilting - keep hips square"

    # 3. Shoulder level check
    elif shoulder_tilt > SHOULDER_TILT_THRESHOLD:
        is_good = False
        feedback = "Shoulders uneven - keep level"

    # 4. Depth check at bottom
    elif current_state == "DOWN" and front_knee > 120.0:
        feedback = "Lower hips deeper into lunge"

    status = "GOOD" if is_good else "FORM ISSUE"
    return status, feedback


# =============================================================================
# 9. CSV Logging Helper
# =============================================================================

buffer = []


def flush_buffer(rows, path):
    """Flush buffered frame rows to CSV dataset."""
    if not rows:
        return

    df = pd.DataFrame(rows, columns=CSV_COLUMNS)
    write_header = not os.path.exists(path) or os.path.getsize(path) == 0

    df.to_csv(
        path,
        mode="a",
        header=write_header,
        index=False,
    )
    rows.clear()


# =============================================================================
# 10. HUD Rendering (Translucent Card Overlay)
# =============================================================================

# State color mappings (BGR format)
STATE_COLORS = {
    "UP": (0, 255, 0),       # Green
    "DOWN": (0, 215, 255),   # Amber / Yellow
    "BOTTOM": (255, 255, 0), # Cyan / Sky Blue
}


def draw_hud(
    frame, state, rep_count, left_reps, right_reps, lead_leg,
    smoothed_front_knee, smoothed_back_knee,
    form_status, feedback, smoothed_visibility, pose_detected
):
    """
    Renders a modern translucent dark card HUD in the top-left corner:
    ┌──────────────────────────────┐
    │ STATE: DOWN (LEFT LEAD)      │
    │ REPS:  3 (L: 2 | R: 1)       │
    │                              │
    │ FRONT KNEE: 92.4°            │
    │ BACK KNEE:  98.1°            │
    │ FORM: GOOD                   │
    │ VISIBILITY: 0.91             │
    └──────────────────────────────┘
    """
    overlay = frame.copy()
    cv2.rectangle(
        overlay,
        (15, 15),
        (380, 255),
        (20, 20, 20),
        -1,
    )
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

    # State text & dynamic color
    state_color = STATE_COLORS.get(state, (0, 255, 0))
    cv2.putText(
        frame,
        f"STATE: {state} ({lead_leg})",
        (28, 48),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        state_color,
        2,
        cv2.LINE_AA,
    )

    # Rep counters (Total, Left, Right)
    cv2.putText(
        frame,
        f"REPS:  {rep_count} (L:{left_reps} R:{right_reps})",
        (28, 80),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )

    # Knee angles
    f_knee_str = f"FRONT KNEE: {smoothed_front_knee:.1f}°" if smoothed_front_knee is not None else "FRONT KNEE: --"
    cv2.putText(
        frame,
        f_knee_str,
        (28, 118),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (240, 240, 240),
        2,
        cv2.LINE_AA,
    )

    b_knee_str = f"BACK KNEE:  {smoothed_back_knee:.1f}°" if smoothed_back_knee is not None else "BACK KNEE:  --"
    cv2.putText(
        frame,
        b_knee_str,
        (28, 146),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (240, 240, 240),
        2,
        cv2.LINE_AA,
    )

    # Form status & Feedback
    status_color = (0, 255, 0) if form_status == "GOOD" else (0, 165, 255)
    cv2.putText(
        frame,
        f"FORM: {form_status} - {feedback}",
        (28, 176),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.52,
        status_color,
        1,
        cv2.LINE_AA,
    )

    # Visibility score with color warning for low confidence
    if smoothed_visibility is not None:
        vis_str = f"VISIBILITY: {smoothed_visibility:.2f}"
        vis_color = (240, 240, 240) if smoothed_visibility >= VISIBILITY_THRESHOLD else (0, 165, 255)
    else:
        vis_str = "VISIBILITY: --"
        vis_color = (0, 165, 255)

    cv2.putText(
        frame,
        vis_str,
        (28, 208),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        vis_color,
        2,
        cv2.LINE_AA,
    )

    # Warning / Hint below the card
    if not pose_detected:
        cv2.putText(
            frame,
            "No person detected",
            (20, 282),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 255),
            2,
            cv2.LINE_AA,
        )

    cv2.putText(
        frame,
        "[q]=quit",
        (20, 309),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (180, 180, 180),
        1,
        cv2.LINE_AA,
    )


# =============================================================================
# 11. Main Execution Loop
# =============================================================================

def main():
    landmarker = create_landmarker()
    cap = cv2.VideoCapture(VIDEO_SOURCE)

    frame_idx = 0
    fps = cap.get(cv2.CAP_PROP_FPS) or 30

    front_knee_smoother = MovingAverage(SMOOTHING_WINDOW)
    back_knee_smoother = MovingAverage(SMOOTHING_WINDOW)
    visibility_smoother = MovingAverage(SMOOTHING_WINDOW)
    debounced_state = DebouncedState(DEBOUNCE_FRAMES, initial_state="UP")
    rep_counter = LungeRepCounter()

    session_start = time.time()

    print("Automatic lunge state detection running. Press [q] to quit.")
    print(f"[state] Starting state: {rep_counter.state}")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Convert BGR -> RGB for MediaPipe Tasks
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        timestamp_ms = int(frame_idx * 1000 / fps)

        result = landmarker.detect_for_video(mp_image, timestamp_ms)

        smoothed_front_knee = None
        smoothed_back_knee = None
        smoothed_visibility = None
        lead_leg = "NONE"
        form_status = "GOOD"
        feedback = "Good Form"
        pose_detected = False

        if result.pose_landmarks:
            pose = result.pose_landmarks[0]
            pose_detected = True

            # Draw skeleton connections & landmarks
            draw_pose_skeleton(frame, pose)

            raw_visibility = min(pose[i].visibility for i in REQUIRED_LANDMARKS)
            smoothed_visibility = visibility_smoother.update(raw_visibility)

            if smoothed_visibility >= VISIBILITY_THRESHOLD:
                # 1. Identify Lead (Front) leg vs Rear (Back) leg
                lead_leg = determine_front_leg(pose)
                rep_counter.set_lead_leg(lead_leg)

                left_knee_angle = calculate_angle(pose[LEFT_HIP], pose[LEFT_KNEE], pose[LEFT_ANKLE])
                right_knee_angle = calculate_angle(pose[RIGHT_HIP], pose[RIGHT_KNEE], pose[RIGHT_ANKLE])

                left_hip_angle = calculate_angle(pose[LEFT_SHOULDER], pose[LEFT_HIP], pose[LEFT_KNEE])
                right_hip_angle = calculate_angle(pose[RIGHT_SHOULDER], pose[RIGHT_HIP], pose[RIGHT_KNEE])

                if lead_leg == "LEFT":
                    front_knee_angle = left_knee_angle
                    back_knee_angle = right_knee_angle
                    front_hip_angle = left_hip_angle
                    back_hip_angle = right_hip_angle
                else:
                    front_knee_angle = right_knee_angle
                    back_knee_angle = left_knee_angle
                    front_hip_angle = right_hip_angle
                    back_hip_angle = left_hip_angle

                # 2. Torso and symmetry features
                torso_angle = calculate_torso_angle(
                    pose[LEFT_SHOULDER], pose[RIGHT_SHOULDER],
                    pose[LEFT_HIP], pose[RIGHT_HIP],
                )
                hip_tilt = horizontal_angle_of_vector(
                    _xy(pose[RIGHT_HIP]) - _xy(pose[LEFT_HIP])
                )
                shoulder_tilt = horizontal_angle_of_vector(
                    _xy(pose[RIGHT_SHOULDER]) - _xy(pose[LEFT_SHOULDER])
                )

                # 3. Sliding-window moving average smoothing
                smoothed_front_knee = front_knee_smoother.update(front_knee_angle)
                smoothed_back_knee = back_knee_smoother.update(back_knee_angle)

                # 4. Direction-aware state classification and debouncing
                raw_state = classify_state(smoothed_front_knee, smoothed_back_knee, debounced_state.confirmed_state)
                confirmed_state, changed = debounced_state.update(raw_state)

                if changed:
                    rep_counter.process_transition(confirmed_state, lead_leg)

                # 5. Form evaluation
                form_status, feedback = evaluate_lunge_form(
                    torso_angle, hip_tilt, shoulder_tilt,
                    smoothed_front_knee, smoothed_back_knee,
                    rep_counter.state,
                )

                row = {
                    "timestamp": timestamp_ms,
                    "lead_leg": lead_leg,
                    "front_knee_angle": round(front_knee_angle, 1),
                    "back_knee_angle": round(back_knee_angle, 1),
                    "smoothed_front_knee": round(smoothed_front_knee, 1),
                    "smoothed_back_knee": round(smoothed_back_knee, 1),
                    "front_hip_angle": round(front_hip_angle, 1),
                    "back_hip_angle": round(back_hip_angle, 1),
                    "torso_angle": round(torso_angle, 1),
                    "hip_tilt_angle": round(hip_tilt, 1),
                    "shoulder_tilt_angle": round(shoulder_tilt, 1),
                    "visibility": round(smoothed_visibility, 3),
                    "state": rep_counter.state,
                    "rep_count": rep_counter.rep_count,
                    "left_reps": rep_counter.left_reps,
                    "right_reps": rep_counter.right_reps,
                    "form_status": form_status,
                    "feedback": feedback,
                }
            else:
                # Low visibility frame: clear pending candidate transitions
                debounced_state.reset_candidate()
                form_status = "LOW CONFIDENCE"
                feedback = "Adjust camera view"
                row = {
                    "timestamp": timestamp_ms,
                    "lead_leg": None,
                    "front_knee_angle": None,
                    "back_knee_angle": None,
                    "smoothed_front_knee": None,
                    "smoothed_back_knee": None,
                    "front_hip_angle": None,
                    "back_hip_angle": None,
                    "torso_angle": None,
                    "hip_tilt_angle": None,
                    "shoulder_tilt_angle": None,
                    "visibility": round(smoothed_visibility, 3),
                    "state": rep_counter.state,
                    "rep_count": rep_counter.rep_count,
                    "left_reps": rep_counter.left_reps,
                    "right_reps": rep_counter.right_reps,
                    "form_status": form_status,
                    "feedback": feedback,
                }
        else:
            # No person detected in frame
            smoothed_visibility = visibility_smoother.update(0.0)
            debounced_state.reset_candidate()
            form_status = "NO PERSON"
            feedback = "Step into frame"
            row = {
                "timestamp": timestamp_ms,
                "lead_leg": None,
                "front_knee_angle": None,
                "back_knee_angle": None,
                "smoothed_front_knee": None,
                "smoothed_back_knee": None,
                "front_hip_angle": None,
                "back_hip_angle": None,
                "torso_angle": None,
                "hip_tilt_angle": None,
                "shoulder_tilt_angle": None,
                "visibility": round(smoothed_visibility, 3),
                "state": rep_counter.state,
                "rep_count": rep_counter.rep_count,
                "left_reps": rep_counter.left_reps,
                "right_reps": rep_counter.right_reps,
                "form_status": form_status,
                "feedback": feedback,
            }

        buffer.append(row)
        if len(buffer) >= FLUSH_EVERY:
            flush_buffer(buffer, CSV_PATH)

        # Render translucent card HUD overlay
        draw_hud(
            frame,
            state=rep_counter.state,
            rep_count=rep_counter.rep_count,
            left_reps=rep_counter.left_reps,
            right_reps=rep_counter.right_reps,
            lead_leg=lead_leg,
            smoothed_front_knee=smoothed_front_knee,
            smoothed_back_knee=smoothed_back_knee,
            form_status=form_status,
            feedback=feedback,
            smoothed_visibility=smoothed_visibility,
            pose_detected=pose_detected,
        )

        cv2.imshow("Lunge Rep Tracker", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break

        frame_idx += 1

    cap.release()
    cv2.destroyAllWindows()
    flush_buffer(buffer, CSV_PATH)
    landmarker.close()

    # Session Summary
    session_duration = time.time() - session_start
    print("\n----- Session Summary -----")
    print(f"Frames processed: {frame_idx}")
    print(f"Session duration: {session_duration:.1f} sec")
    print(f"Full reps counted: {rep_counter.rep_count}")
    print(f"  - Left leg lead reps: {rep_counter.left_reps}")
    print(f"  - Right leg lead reps: {rep_counter.right_reps}")
    print(f"Shallow lunges (not counted): {rep_counter.shallow_count}")
    print(f"Final state: {rep_counter.state}")
    print(f"Saved to: {CSV_PATH}")
    print("----------------------------")


if __name__ == "__main__":
    main()
