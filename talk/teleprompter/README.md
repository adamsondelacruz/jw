# JW Talk Teleprompter

Offline-first React and Tauri 2 teleprompter for tablet delivery. The Android app bundles the talk library and uses Android's native speech recognizer for anticipatory word highlighting.

## Install on a Samsung tablet

The current ARM64 sideload APK is:

`artifacts/JW-Talk-Teleprompter-0.1.0-arm64.apk`

Transfer that file to the tablet, open it in **My Files**, and allow installation from that source when Android asks. On first use, open a talk, select **Voice**, and grant microphone access.

Alternatively, enable Developer options and USB debugging, connect the tablet, then run:

```bash
/home/adam/Android/Sdk/platform-tools/adb install -r artifacts/JW-Talk-Teleprompter-0.1.0-arm64.apk
```

The included APK is an optimized release signed with this development machine's Android certificate. Keep that certificate to install future updates over this version. Google Play distribution requires a private production signing key and an AAB.

## Web development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

## Tauri desktop development

```bash
npm run tauri:dev
```

## Android development

Set the Android toolchain for the current shell:

```bash
export ANDROID_HOME=/home/adam/Android/Sdk
export NDK_HOME=/home/adam/Android/Sdk/ndk/27.2.12479018
export JAVA_HOME=/usr/lib/jvm/java-21-amazon-corretto
```

Then use:

```bash
npm run android:dev
npm run android:build
npm run android:build:installable
```

`android:build` produces an optimized unsigned release APK for proper release signing. `android:build:installable` produces a larger debug-signed APK for direct testing.

## Verification

```bash
npm test
npm run test:e2e
npm run build
cd src-tauri && cargo check
```

Voice recognition depends on the speech service installed on the Android device. Talk documents and application assets remain local and available without a network connection.
