# Expo Camera Test App with Vision Camera 📸

A clean, modern React Native application built with **`react-native-vision-camera` v4**, **Expo SDK 54**, and **TypeScript**, connected to a real-time **MediaPipe Pose** Python backend.

---

## 📱 Features

- **`react-native-vision-camera`**: Switched to high-performance native camera engine.
- **Premium Dark UI**: Built with sleek dark mode aesthetics, rounded cards, and crisp typography.
- **Home Screen**: Displays a single, elegant card labeled **"Test"**.
- **Front Camera Live Preview**: Tapping the card opens the camera screen using `react-native-vision-camera` with the **front camera (selfie view)** active by default.
- **Real-Time MediaPipe Pose Tracking**: Real-time 33-joint pose detection stream over WebSocket (`server.py`).
- **Ping-Pong Backpressure Stream**: Smooth ~15-30 FPS pose landmark rendering with zero memory leaks.

---

## 📁 Project Structure

```
.
├── App.tsx                    # Main app entry point managing screen state
├── server.py                  # Python FastAPI + WebSockets MediaPipe Pose Server
├── app.json                   # Expo configuration & camera permissions
├── babel.config.js            # Babel preset for Expo
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies & scripts
└── src/
    └── components/
        ├── HomeScreen.tsx     # Home Screen with "Test" card UI
        └── CameraScreen.tsx   # Live camera preview with react-native-vision-camera & pose overlay
```

---

## 🚀 How to Run

### 1. Start the Python Pose Server
In your terminal, run:

```bash
python3 server.py
```
*(Server will start on `ws://0.0.0.0:8000/ws`)*.

---

### 2. Run the App with Expo Development Build

`react-native-vision-camera` uses native C++ code (Nitro modules). Build and run the app:

#### For Android:
```bash
npx expo run:android
```

#### For iOS:
```bash
npx expo run:ios
```

#### For Expo Go / Metro Server:
```bash
npx expo start
```

---

## 🧪 App Flow

1. **Home Screen**: Open the app and tap the **"Test"** card.
2. **Vision Camera**: The front selfie camera opens using `react-native-vision-camera`.
3. **Live Pose Overlay**: View real-time 33 MediaPipe pose joint landmarks & skeleton lines!
