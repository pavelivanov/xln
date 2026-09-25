# React frontend T15 — platform acceptance

Status: **DONE — iOS and Chrome extension accepted for migration scope**

## Owner-approved migration scope

On 2026-09-25 the owner narrowed T15 migration acceptance to **iOS** and the
**Chrome extension**. Android, signed/notarized desktop, and headset WebXR are
deferred to explicit post-migration release gates. This decision does not claim
that those platforms passed, remove their build paths, or waive their evidence
before a release that includes them.

## Exact input and focused checks

- Verified release: `sha256-77b6fcdb1c59cd481380acb4e9790969fd212b3131e4e43bb1221ce9e79347f9` — **493 files**.
- Native build, staging and deep-link regressions: **17/17 pass**, **66 assertions**.
- Platform tooling consumed the verified release through `scripts/native/build-platforms.ts`; it did not rebuild application bytes.

## Accepted migration targets

- [x] **iOS:** Xcode built the copied Capacitor shell for iPhone 17 Pro / iOS 26.3 (`** BUILD SUCCEEDED **`). The simulator accepted `xln://pay?amount=1` into Payments, accepted `xln://app#settings/display` into Display preferences, selected Light, survived background/resume, terminated/relaunched with Light preserved, and retained **30 storage files / 1 `xln-settings` record**. The simulator was shut down after the run. Evidence: [background/resume](../../output/playwright/react-t15-platforms/ios-react-final-background-resume.png), [relaunch persistence](../../output/playwright/react-t15-platforms/ios-maestro-light-relaunched-final).
- [x] **Extension:** final ZIP `xln-finance-chrome-0.1.32.zip` contains **99 files**, is **3,895,832 bytes**, and has SHA-256 `8257cd9cd5c4b54b0fce7640b80c7bca4c35c57dac242f452d880d6c01a4b8fb`. Its packaged candidate is SHA-256 `ae4d2ac9c0a33d474d3351373b4d2031cfabbe8b14c28e2e6a9b7b465c30ec32`. The packaged extension passed **3/3 viewports in 7.7 s**; its action opened the exact Wallet and Paper light persisted across reload and a new browser context.

## Deferred post-migration release gates

- [ ] **Android:** actual configured SDK/emulator/device build, install, launch,
      deep link, background/resume/reload, persisted storage, and final payload
      identity. This host currently has no Android SDK tools or configured AVD.
- [ ] **Signed/notarized desktop:** actual packaged launch, routes/deep links,
      CSP, storage, close/reopen, cleanup, signing identity, and notarization. This
      host currently has no `Electron.app`, signing identity, or notarization
      credentials.
- [ ] **Headset WebXR:** enter/exit, controller select/drag/double-tap/scale,
      close/session teardown, and restored desktop resources on supported hardware.
      No supported headset is connected to this host.

## Scope disposition

Revalidated on 2026-09-24: `ANDROID_HOME` and `ANDROID_SDK_ROOT` remain unset;
`adb`, `emulator`, and `sdkmanager` are absent; neither root nor native
`Electron.app` exists; macOS reports **0 valid code-signing identities**; and
the USB inventory reports no Quest, Oculus, Meta, Vive, or XR headset.

T15 is `DONE` for the owner-approved migration platform set. The three deferred
gates remain required before a later release claims those platforms.
