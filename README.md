# Expo On-Device MediaPipe Pose App 📸

A clean, modern React Native application built with **Expo SDK 54**, **TypeScript**, and **On-Device WebGL MediaPipe AI** running **100% locally on the phone**.

---

## 📱 Features

- **100% On-Device Pose AI**: MediaPipe Pose model runs directly inside your phone's GPU via WebGL.
- **ZERO Backend / ZERO Network Traffic**: No Python server, no WebSockets, no frame sending across Wi-Fi.
- **Front Selfie Camera**: Uses `navigator.mediaDevices.getUserMedia` at high FPS.
- **Live 33-Joint Skeleton Rendering**: Draws joint dots & bone lines in real-time.
- **Expo Go Compatible**: Works out-of-the-box on iOS & Android!

---

## 📁 Project Structure

```
.
├── App.tsx                    # Main app entry point managing screen state
├── app.json                   # Expo configuration
├── babel.config.js            # Babel preset for Expo
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies & scripts
└── src/
    └── components/
        ├── HomeScreen.tsx     # Home Screen with "Test" card UI
        └── CameraScreen.tsx   # 100% On-Device MediaPipe Pose Camera & Skeleton Overlay
```

---

## 🚀 How to Run

### 1. Start the Expo Development Server

```bash
npx expo start
```

### 2. Open in Expo Go

1. Open **Expo Go** on your device.
2. Scan the QR code.
3. Tap **"Test"** ➔ Front camera opens ➔ Live 33 MediaPipe pose landmarks render on your phone 100% on-device!
# fitness
