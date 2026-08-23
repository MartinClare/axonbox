# AxonCase Android app

Native Android package for AxonCase. It is a Kotlin WebView shell that opens the live site at `/m` (field home). Camera, gallery upload, microphone, location, cookies, and file downloads are wired so capture and inbox work like the mobile web app.

This folder is standalone. Open **`android-app`** in Android Studio — not the Next.js repo root.

## Build an APK

1. Install [Android Studio](https://developer.android.com/studio) (JDK 17).
2. **File → Open** and choose this `android-app` folder.
3. Let Gradle sync. If the wrapper JAR is missing, Android Studio will offer to generate it, or run `gradle wrapper` in this folder.
4. Connect a phone (USB debugging) or start an emulator.
5. **Run ▶** or **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
6. The debug APK lands in `app/build/outputs/apk/debug/app-debug.apk`.

Release / Play signing: **Build → Generate Signed App Bundle or APK**.

## Point at another server

Edit `app/build.gradle.kts`:

```kotlin
buildConfigField("String", "AXON_BASE_URL", "\"https://axonbox-production.up.railway.app\"")
buildConfigField("String", "AXON_START_PATH", "\"/m\"")
```

For a local Next.js server from the Android emulator, use `http://10.0.2.2:3000` and set `android:usesCleartextTraffic="true"` in the debug manifest.

## What this is (and is not)

- **Is:** a native Android app you can install as `.apk`, with AxonCase branding and site permissions.
- **Is not:** a rewrite of the Next.js UI. Screens still come from the web app.
