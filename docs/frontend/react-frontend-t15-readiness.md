# React frontend T15 — platform acceptance

Status: **DONE — iOS and Chrome extension accepted for migration scope**

## Owner-approved migration scope

On 2026-09-25 the owner narrowed T15 migration acceptance to **iOS** and the
**Chrome extension**. Android, signed/notarized desktop, and headset WebXR are
deferred to explicit post-migration release gates. This decision does not claim
that those platforms passed, remove their build paths, or waive their evidence
before a release that includes them.

## Exact input and focused checks

- Verified release: `sha256-018216b4f3761819a817cd37aee49b875acca15698ab45e112abebe90621172b` — **492 files**.
- Native build, staging and deep-link regressions: **17/17 pass**, **66 assertions**.
- Platform tooling consumed the verified release through `scripts/native/build-platforms.ts`; it did not rebuild application bytes.

## Accepted migration targets

- [x] **iOS:** Xcode built the copied Capacitor shell for iPhone 17 Pro / iOS 26.3. The simulator accepted `xln://pay?amount=1` into Payments, accepted `xln://app#settings/display` into Display preferences, selected Light, survived background/resume, terminated/relaunched with Light preserved, and retained **27 storage files**. The simulator was shut down after the run. Evidence: [payments](../../output/playwright/react-t15-platforms/ios-maestro-payments.png), [background/resume](../../output/playwright/react-t15-platforms/ios-background-resumed.png), [relaunch persistence](../../output/playwright/react-t15-platforms/ios-relaunched-light.png).
- [x] **Extension:** final ZIP `xln-finance-chrome-0.1.32.zip` contains **99 files**, is **3,895,298 bytes**, and has SHA-256 `3d6882c36296df07e555c49e2532da54331d5adffbee01673bd0836fc0e803b8`. The packaged extension passed **3/3 viewports in 20.6 s**; its action opened the exact Wallet and Paper light persisted across reload and a new browser context. Evidence: [mobile](../../output/playwright/packaged-candidate/test-results/extension-packaged-extensi-23d54-es-across-reload-and-reopen-mobile-390x844/extension-wallet-reopened.png), [laptop](../../output/playwright/packaged-candidate/test-results/extension-packaged-extensi-23d54-es-across-reload-and-reopen-laptop-1366x900/extension-wallet-reopened.png), [wide](../../output/playwright/packaged-candidate/test-results/extension-packaged-extensi-23d54-es-across-reload-and-reopen-wide-1920x1080/extension-wallet-reopened.png).

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
