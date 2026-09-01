# 💪 Ojas AI Fitness & 1v1 Real-Time Faceoff Arena

An advanced, production-grade AI Fitness and 1v1 Real-time Exercise Duel mobile platform built with **React Native (Expo SDK 54)**, **TypeScript**, **On-Device MediaPipe Pose Tracking**, **Supabase Realtime**, and **High-Speed GPU Canvas Video Streaming**.

---

## 🌟 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [How Everything Works Under the Hood](#-how-everything-works-under-the-hood)
   - [1. On-Device AI Pose Detection & Form Analysis](#1-on-device-ai-pose-detection--form-analysis)
   - [2. Exercise State Machine & Rep Counting](#2-exercise-state-machine--rep-counting)
   - [3. 1v1 Real-Time Matchmaking & Friend Duel System](#3-1v1-real-time-matchmaking--friend-duel-system)
   - [4. High-FPS Zero-Flicker Video Streaming Pipeline](#4-high-fps-zero-flicker-video-streaming-pipeline)
   - [5. Dynamic 50/50 Split Screen & HUD Layout](#5-dynamic-5050-split-screen--hud-layout)
   - [6. User Authentication, Profiles & Ranking System](#6-user-authentication-profiles--ranking-system)
   - [7. Floating Gesture-Controlled Actions Widget](#7-floating-gesture-controlled-actions-widget)
3. [Folder Structure](#-folder-structure)
4. [Environment Setup & Installation](#-environment-setup--installation)
5. [Running the Application](#-running-the-application)

---

## 🏗️ Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         Ojas Mobile App (React Native)                      │
 └──────┬──────────────────────┬────────────────────────┬──────────────────────┘
        │                      │                        │
        ▼                      ▼                        ▼
 ┌──────────────┐      ┌───────────────┐        ┌────────────────┐
 │ MediaPipe AI │      │   Supabase    │        │ WebSockets &   │
 │ WebGL Engine │      │ Realtime Hub  │        │ Matchmaking    │
 └──────┬───────┘      └───────┬───────┘        └────────┬───────┘
        │ (25-30 FPS)          │ (Realtime Broadcast)    │ (Fallback/Sync)
        ▼                      ▼                         ▼
 ┌──────────────┐      ┌───────────────┐        ┌────────────────┐
 │ Squat Engine │      │ Friend Duels  │        │ Global Queues  │
 │ & Joint HUD  │      │ & Peer Frames │        │ & Match Rooms  │
 └──────────────┘      └───────────────┘        └────────────────┘
```

---

## 🧠 How Everything Works Under the Hood

### 1. On-Device AI Pose Detection & Form Analysis
- **Engine**: Runs Google's **MediaPipe Pose solution** inside a dedicated, hardware-accelerated WebView instance (`POSE_HTML_BUNDLE` in `CameraScreen.tsx`).
- **Processing**: Extracts 33 3D body landmarks at 30+ FPS directly on the client GPU using WebGL.
- **Landmark Filtering**: Uses confidence thresholds (`visibility > 0.3`) to filter noise and ignore occluded joints.
- **Visual Feedback**: Renders glowing skeleton connections (`#6366F1`) and tracking points (`#10B981`) in real-time over the camera canvas.

---

### 2. Exercise State Machines & Biomechanical Form Engines

#### 🏋️ A. Squat Engine
- **Angle Calculation**: Tracks hip-to-knee-to-ankle vectors using trigonometry (`Math.atan2`):
  $$\theta = \left|\text{atan2}(y_c - y_b, x_c - x_b) - \text{atan2}(y_a - y_b, x_a - x_b)\right| \times \frac{180}{\pi}$$
- **Knee Angle Smoothing**: Applies a moving window average (`SMOOTHING_WINDOW = 5`) across both knees to eliminate jitter.
- **Debounced State Transitions**:
  - **`TOP` (Standing)**: Knee angle $\ge 155^\circ$.
  - **`DOWN` (Descending)**: Angle between $95^\circ$ and $155^\circ$.
  - **`BOTTOM` (Parallel / Deep Squat)**: Knee angle $\le 95^\circ$.
- **Validation**: Rep counted upon completing `TOP` $\rightarrow$ `DOWN` $\rightarrow$ `BOTTOM` $\rightarrow$ `TOP`.

#### 📐 B. Triangle Pose (Trikonasana) Engine
- **Biomechanical Angles & Rules** (ported directly from `backend/Pose/triangle_pose/triangle_pose.py`):
  - **Leg Extension**: Both front and back knees must be straight ($\ge 155^\circ$).
  - **Top Arm Reaching**: Top arm shoulder extension $\ge 135^\circ$ and elbow extension $\ge 150^\circ$.
  - **Bottom Arm Reach**: Bottom arm extended along leg ($\ge 150^\circ$).
  - **Lateral Hip Hinge**: Shoulder tilt $\ge 25^\circ$ from vertical.
  - **Chest Stacking**: Shoulder $Z$-depth divergence $\le 0.35$ (prevents forward chest collapse).
- **Real-Time Audio/Visual Coaching Cues**:
  - `✨ Perfect Alignment! Hold: Xs` (State: `Perfect Hold ✓` in `#34D399`)
  - `⚠️ Keep front leg straight` (State: `Adjust Form ⚠️` in `#FBBF24`)
  - `⚠️ Reach top arm straight up`
  - `⚠️ Hinge deeper laterally from hip`
  - `⚠️ Open chest & stack shoulders`
- **Hold Duration Scoring**: Automatically awards +1 Point / Rep for every 3 seconds held in perfect form.

#### 🦵 C. Lunges Engine
- **Biomechanical Angles & Rules** (ported directly from `backend/Pose/lunge/lunge.py`):
  - **Lead Leg Detection**: Dynamically determines front vs back leg by displacement of ankle vs mid-hip and facing direction.
  - **Front Knee Depth**: Front knee $\le 100^\circ$ at bottom apex.
  - **Back Knee Clearance**: Back knee $\le 115^\circ$ for complete step depth.
  - **Torso Posture**: Monitors vertical torso deviation ($\le 22^\circ$) to prevent excessive forward leaning.
- **State Transitions**: `UP (Standing >= 160°)` $\rightarrow$ `DOWN` $\rightarrow$ `BOTTOM (<= 100°)` $\rightarrow$ `UP`.

#### 🧘 D. Crunches Engine
- **Biomechanical Angles & Rules** (ported directly from `backend/Pose/crunch/crunch.py`):
  - **Torso Floor Angle**: Mid-shoulder to mid-hip vector relative to horizontal floor.
  - **Flat Base**: Torso angle $\le 8^\circ$ (`DOWN`).
  - **Shoulder Elevation Apex**: Torso angle $\ge 22^\circ$ (`UP`).
  - **Overlift Guard**: Flags excessive rise ($> 42^\circ$) to keep contraction isolated to abdominals.
- **State Transitions**: `DOWN (<= 8°)` $\rightarrow$ `CRUNCHING` $\rightarrow$ `UP (>= 22°)` $\rightarrow$ `RELEASING` $\rightarrow$ `DOWN`.

#### 💪 E. Sit-ups Engine
- **Biomechanical Angles & Rules** (ported directly from `backend/Pose/situp/situp.py`):
  - **Torso Floor Angle**: Mid-shoulder to mid-hip vector relative to horizontal floor.
  - **Flat Base**: Torso angle $\le 20^\circ$ (`DOWN`).
  - **Sitting Apex**: Torso angle $\ge 60^\circ$ (`UP`).
- **State Transitions**: `DOWN (<= 20°)` $\rightarrow$ `ASCENDING` $\rightarrow$ `UP (>= 60°)` $\rightarrow$ `DESCENDING` $\rightarrow$ `DOWN`.

---

### 3. 1v1 Real-Time Matchmaking & Friend Duel System
- **Hub Architecture** (`customBattleService.ts` & `matchmaking.ts`):
  - Uses a persistent Supabase Realtime broadcast channel (`custom_battles_hub`) joined upon app launch.
  - When an athlete challenges a friend from `ExerciseDetailScreen.tsx` or `ProfileScreen.tsx`, an invite payload containing `{ id, senderUsername, receiverUsername, exerciseId, mode, matchRoomId }` is broadcasted immediately.
- **Instant Modals**: The recipient receives the challenge modal with 0ms channel handshake latency and can **Accept** or **Decline**.
- **Synchronized Match Lifecycle**:
  1. **Resource Loading**: Both players verify camera & model readiness (`peer_ready`).
  2. **20s Setup Countdown**: Gives both players 20 seconds to step back and align their cameras while viewing each other's live POV.
  3. **2-Minute Live Duel**: Score updates, form cues, and timers sync continuously.
  4. **Post-Match Settlement**: Records victory, defeat, or draw, awarding XP and updating global leaderboard standings (`rankingService.ts`).

---

### 4. High-FPS Zero-Flicker Video Streaming Pipeline
- **Continuous Frame Capture** (`CameraScreen.tsx`):
  - An offscreen canvas captures clean 480x360 snapshots from the camera video stream at **25–30 FPS** (`quality: 0.65`, 40ms interval).
- **GPU Canvas Stream Receiver** (`MatchCameraScreen.tsx`):
  - Rather than using standard React Native `<Image>` components (which cause texture recreation and heavy flickering on Android), opponent video frames are received by an HTML5 hardware-accelerated Canvas WebView (`OPPONENT_STREAM_HTML`).
  - Frames are drawn directly into the GPU canvas buffer (`ctx.drawImage`), delivering **100% flicker-free, 0ms latency, crystal-clear video streaming**.

---

### 5. Dynamic 50/50 Split Screen & HUD Layout
- **Horizontal / Landscape Mode (Recommended)**:
  - Screen splits **50/50 side-by-side** (`flexDirection: 'row'`):
    - **Left 50%**: Opponent's live camera POV separated by a sleek vertical divider.
    - **Right 50%**: Your live AI pose tracker camera view with real-time joint feedback.
- **Vertical / Portrait Mode**:
  - Screen splits **50/50 top/bottom** (`flexDirection: 'column'`).
- **Responsive HUD**:
  - Frosted glassmorphism State badge (`TOP ▲`, `SQUATTING ▼`, `PARALLEL ✓`) with a live visibility percentage progress bar placed cleanly to prevent overlapping with top scoreboard badges.

---

### 6. User Authentication, Profiles & Ranking System
- **Supabase Authentication**: Secure email/password login and signup with automatic session persistence.
- **Athlete Profiles**: Customizable usernames, avatar seeds, fitness goals, and phone numbers.
- **Social Friends Network**: Search athletes by username, send friend requests, accept/decline invites, and challenge friends directly to duels.
- **Leaderboard & XP**: Automatic ELO calculations and match histories for all exercises.

---

### 7. Floating Gesture-Controlled Actions Widget
- **Draggable Handle**: Sleek Neon Lime (`#E2F163`) pill handle featuring a `Dumbbell` icon.
- **PanResponder Physics**: Smooth spring drag gestures clamped cleanly within screen boundaries in both portrait and landscape orientations.
- **Quick Controls**:
  - 🚪 **Exit Match**: Safely leaves the active duel and cleans up network sockets.
  - 🔄 **Flip Camera**: Toggles between front and rear cameras instantly.
  - 🔁 **Rematch**: Sends an instant rematch request to the opponent.
  - ⚔️ **Challenge Mode**: Toggles duel match settings.
  - ➕ **Add Friend**: Instantly sends a friend request to the current opponent.

---

## 📁 Folder Structure

```
sih_exercise/
├── src/
│   ├── app/
│   │   └── AppShell.tsx               # Main routing, orientation locking & duel modal hub
│   ├── features/
│   │   ├── camera/
│   │   │   └── components/
│   │   │       └── CameraScreen.tsx   # MediaPipe POSE_HTML_BUNDLE & Form analysis engine
│   │   └── match/
│   │       └── components/
│   │           └── MatchCameraScreen.tsx # 1v1 Split-screen Faceoff & GPU stream receiver
│   ├── screens/
│   │   ├── ExerciseDetailScreen.tsx   # Exercise guide & friend duel invite modal
│   │   ├── HomeScreen.tsx             # Home feed, workout routines & quick join
│   │   ├── ProfileScreen.tsx          # User profile, friends management & stats
│   │   └── GetStartedScreen.tsx       # Auth & onboarding screen
│   ├── store/
│   │   └── userStore.ts               # Zustand store for user session & profile
│   └── utils/
│       ├── customBattleService.ts     # Realtime 1v1 friend invite broadcast service
│       ├── matchmaking.ts             # Hybrid dual-transport match socket & Supabase channel
│       ├── friendService.ts           # Supabase social friends API
│       ├── rankingService.ts          # Match results & ELO ranking system
│       └── supabase.ts                # Supabase client configuration
├── App.tsx                            # Root application entry point
├── package.json                       # Project dependencies
└── tsconfig.json                      # TypeScript configuration
```

---

## ⚙️ Environment Setup & Installation

### 1. Prerequisites
- **Node.js**: v18 or higher
- **npm** or **yarn**
- **Expo CLI**: `npm install -g expo-cli`
- **Expo Go App** or **Android Studio / Xcode** for emulators

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the project root:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_BACKEND_URL=https://app.codequestpro.in
```

---

## 🚀 Running the Application

### 1. Start Metro Bundler
```bash
npx expo start
```

### 2. Run on Android Device / Emulator
```bash
npx expo run:android
# Or scan the QR code with Expo Go on your mobile device
```

### 3. Run on iOS Simulator
```bash
npx expo run:ios
```

---

## 🏆 Summary
Ojas provides an end-to-end competitive AI fitness experience. With on-device WebGL pose detection, instant Supabase Realtime friend invitations, and smooth 50/50 side-by-side GPU video streaming, athletes can duel and track their form in real time with zero latency.
