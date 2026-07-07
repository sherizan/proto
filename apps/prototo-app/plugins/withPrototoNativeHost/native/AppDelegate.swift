internal import Expo
internal import ExpoModulesCore
import EXUpdatesInterface
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var overlayWindow: UIWindow?
  var overlayButton: UIView?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    // Cold start is a runtime transition: a deep link arriving before the shell
    // runtime finishes registering modules must defer, not start a second
    // runtime (DC-07 race).
    ProtoNativeLoader.beginTransition()
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    let didFinish = super.application(application, didFinishLaunchingWithOptions: launchOptions)

    // PROTOSPIKE: confirm our root.
    if let root = window?.rootViewController {
      NSLog("PROTOSPIKE rootVC=\(type(of: root))")
    }

    // Wire the expo-updates dev-launcher interface so loadApp can fetch EAS Update
    // bundles in this Release build (the stock react-delegate that does this is a
    // no-op when !APP_DEBUG). Without this, loading an EAS-published prototype errors.
    if let updatesController = UpdatesControllerRegistry.sharedInstance.controller as? UpdatesDevLauncherInterface {
      ProtoNativeLoader.setUpdatesInterface(updatesController)
    } else {
      NSLog("PROTO updatesInterface: no updates controller available")
    }

    // Recover to our shell instead of crashing if a prototype fails to load.
    ProtoNativeLoader.installFatalHandler()

    // Native overlay window that floats above any loaded prototype bundle.
    installOverlay()

    return didFinish
  }

  // A small, draggable floating button that sits above a running prototype (like Expo's
  // dev button). It only intercepts touches on itself (the rest of the prototype stays
  // interactive); drag to move it, tap for a menu (Refresh / Exit). Hidden on our shell.
  private func installOverlay() {
    let size: CGFloat = 48
    let bounds = UIScreen.main.bounds
    let overlay = PassthroughWindow(frame: bounds)
    overlay.windowLevel = UIWindow.Level.alert + 1
    overlay.backgroundColor = .clear

    let vc = UIViewController()
    vc.view.backgroundColor = .clear
    overlay.rootViewController = vc

    let button = UIView(frame: CGRect(x: 0, y: 0, width: size, height: size))
    button.backgroundColor = UIColor(white: 0.0, alpha: 0.82)
    button.layer.cornerRadius = size / 2
    button.layer.shadowColor = UIColor.black.cgColor
    button.layer.shadowOpacity = 0.25
    button.layer.shadowRadius = 8
    button.layer.shadowOffset = CGSize(width: 0, height: 2)

    let label = UILabel(frame: button.bounds)
    label.text = "\u{22EF}" // ⋯
    label.textAlignment = .center
    label.textColor = .white
    label.font = .systemFont(ofSize: 24, weight: .bold)
    label.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    button.addSubview(label)

    let inset: CGFloat = 16
    button.center = CGPoint(x: bounds.width - inset - size / 2, y: bounds.height - 60 - size / 2)
    button.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(overlayTapped)))
    button.addGestureRecognizer(UIPanGestureRecognizer(target: self, action: #selector(overlayPanned(_:))))
    vc.view.addSubview(button)

    overlay.passthroughView = button
    overlay.isHidden = true // shown only when a prototype is loaded
    overlayWindow = overlay
    overlayButton = button

    let nc = NotificationCenter.default
    nc.addObserver(self, selector: #selector(onPrototypeLoaded), name: NSNotification.Name("ProtoPrototypeLoaded"), object: nil)
    nc.addObserver(self, selector: #selector(onReturnedHome), name: NSNotification.Name("ProtoReturnedHome"), object: nil)
    nc.addObserver(self, selector: #selector(onRuntimeReady), name: NSNotification.Name("ProtoRuntimeReady"), object: nil)
    NSLog("PROTO overlay installed (hidden)")
  }

  // External-link routing while a PROTOTYPE runtime is mounted. The shell's
  // expo-router isn't running then — forwarding a prototo://p/<token> or
  // universal link into the prototype's own router shows expo-router's
  // "Unmatched Route" over the running prototype (field bug, builds 25-28:
  // iOS re-emits an opened universal link seconds after the share mounts).
  private var prototypeMounted = false
  private var pendingExternalURL: URL?

  // The /p/<token> from any delivery form: https://prototo.app/p/X,
  // prototo:///p/X (empty host), prototo://p/X (host swallows the segment).
  private func shareToken(from url: URL) -> String? {
    let path = (url.host == "p" ? "/p" + url.path : url.path)
    let pattern = "^/p/([0-9ABCDEFGHJKMNPQRSTVWXYZ]{12})/?$"
    guard let re = try? NSRegularExpression(pattern: pattern),
          let m = re.firstMatch(in: path, range: NSRange(path.startIndex..., in: path)),
          let r = Range(m.range(at: 1), in: path) else { return nil }
    if url.scheme == "https" && url.host != "prototo.app" { return nil }
    return String(path[r])
  }

  // True when this URL was fully handled here (swallowed or parked) and must
  // not reach RCTLinkingManager / the subscribers.
  private func handleExternalURLWhilePrototypeMounted(_ url: URL) -> Bool {
    guard prototypeMounted else { return false }
    if let token = shareToken(from: url), token == ProtoNativeLoader.currentShareToken() {
      NSLog("PROTO external URL is the mounted share — swallowed")
      return true
    }
    NSLog("PROTO external URL while prototype mounted — parking + returning to shell")
    pendingExternalURL = url
    ProtoNativeLoader.goHome()
    return true
  }

  @objc private func onRuntimeReady() {
    DispatchQueue.main.async {
      guard !self.prototypeMounted, let url = self.pendingExternalURL else { return }
      self.pendingExternalURL = nil
      NSLog("PROTO flushing parked external URL to the shell: \(url.absoluteString)")
      RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
    }
  }

  @objc private func overlayPanned(_ g: UIPanGestureRecognizer) {
    guard let btn = overlayButton, let host = btn.superview else { return }
    let t = g.translation(in: host)
    btn.center = CGPoint(x: btn.center.x + t.x, y: btn.center.y + t.y)
    g.setTranslation(.zero, in: host)
    if g.state == .ended || g.state == .cancelled {
      let size = btn.bounds.width
      let inset: CGFloat = 16
      let left = inset + size / 2
      let right = host.bounds.width - inset - size / 2
      let snappedX = btn.center.x < host.bounds.width / 2 ? left : right
      let minY = host.safeAreaInsets.top + size / 2 + 8
      let maxY = host.bounds.height - host.safeAreaInsets.bottom - size / 2 - 8
      let clampedY = min(max(btn.center.y, minY), maxY)
      UIView.animate(withDuration: 0.2) { btn.center = CGPoint(x: snappedX, y: clampedY) }
    }
  }

  @objc private func overlayTapped() {
    let win = overlayWindow as? PassthroughWindow
    win?.menuOpen = true
    let close = { win?.menuOpen = false }

    let sheet = UIAlertController(title: nil, message: nil, preferredStyle: .actionSheet)
    sheet.addAction(UIAlertAction(title: "Refresh", style: .default) { _ in
      close()
      ProtoNativeLoader.reload()
    })
    sheet.addAction(UIAlertAction(title: "Exit to home", style: .destructive) { _ in
      close()
      ProtoNativeLoader.goHome()
    })
    sheet.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in close() })
    if let btn = overlayButton, let pop = sheet.popoverPresentationController {
      pop.sourceView = btn
      pop.sourceRect = btn.bounds
    }
    overlayWindow?.rootViewController?.present(sheet, animated: true)
  }

  @objc private func onPrototypeLoaded() {
    DispatchQueue.main.async {
      self.prototypeMounted = true
      self.mount(bundleURL: ProtoNativeLoader.sourceUrl())
      // Bare hosts (Desktop's streamed sim / the Appetize embed send ui=bare)
      // get no Viewer menu — the prototype IS the whole experience there.
      self.overlayWindow?.isHidden = ProtoNativeLoader.bareUI()
    }
  }

  @objc private func onReturnedHome() {
    DispatchQueue.main.async {
      self.prototypeMounted = false
      // Return to OUR shell — the embedded bundle (nil override → delegate default).
      self.mount(bundleURL: nil)
      self.overlayWindow?.isHidden = true
    }
  }

  // Outgoing hosts parked here for a grace period before release. Tearing the old
  // runtime down synchronously freed JSI memory that in-flight expo-module work
  // (e.g. an expo/fetch NativeResponse settling on its own queue) still referenced —
  // its JavaScriptPromise destructors then segfaulted (DC-14, TestFlight build 28
  // "crashed when exiting prototype back to Home"). Holding the host ~8s lets that
  // work destruct against a living runtime; the DC-07 expo-modules-core patch
  // already guards the two-runtimes registration race.
  private var retiredHosts: [(RCTReactNativeFactory, ExpoReactNativeFactoryDelegate)] = []

  // Mount a bundle by building a FRESH React Native factory + host and re-running
  // startReactNative (exactly like cold launch). `recreateRootView` reuses the running
  // host on a second swap (so prototype→shell kept showing the prototype); a fresh
  // factory per mount guarantees the new bundle actually loads. `bundleURL` nil → our
  // embedded shell; a file URL → that prototype bundle.
  private func mount(bundleURL: URL?) {
    // Every mount initializes a fresh runtime — defer any loadApp until it's done.
    ProtoNativeLoader.beginTransition()
    // Retire (don't free) the previous host: release after a grace delay so late
    // JSI destructions from its in-flight module work stay safe (DC-14).
    if let oldFactory = reactNativeFactory, let oldDelegate = reactNativeDelegate {
      retiredHosts.append((oldFactory, oldDelegate))
      DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
        guard let self, let idx = self.retiredHosts.firstIndex(where: { $0.0 === oldFactory }) else { return }
        if RCTIsNewArchEnabled() {
          oldFactory.rootViewFactory.setValue(nil, forKey: "reactHost")
        }
        self.retiredHosts.remove(at: idx)
        NSLog("PROTO retired host released")
      }
    }

    let delegate = ReactNativeDelegate()
    delegate.overrideBundleURL = bundleURL
    delegate.dependencyProvider = RCTAppDependencyProvider()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    reactNativeDelegate = delegate
    reactNativeFactory = factory

    factory.startReactNative(withModuleName: "main", in: window, launchOptions: nil)
    NSLog("PROTO mounted (fresh factory) bundle=\(bundleURL?.absoluteString ?? "embedded shell")")
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    // Funnel dev-client deep links through our guarded loader. Left to super,
    // expo-dev-launcher's app-delegate subscriber calls loadApp directly with
    // no re-entrancy or cold-start guard — the DC-07 concurrent-runtime race.
    if url.host == "expo-development-client" {
      ProtoNativeLoader.loadApp(url.absoluteString)
      return true
    }
    // A mounted prototype's router must never see our URLs (Unmatched Route).
    if handleExternalURLWhilePrototypeMounted(url) { return true }
    // No short-circuit: in this launcher-free build, dev-launcher's subscriber
    // (inside super) thinks no app is running (we mount the shell ourselves),
    // parks external URLs in its pending registry, and returns true — which
    // used to starve RCTLinkingManager, so expo-router never saw warm deep
    // links ("warm deep links stuck", BACKLOG 2026-07-06). Deliver to JS
    // unconditionally; no subscriber forwards to RCTLinkingManager itself, so
    // this cannot double-deliver.
    let handledBySubscribers = super.application(app, open: url, options: options)
    let handledByJS = RCTLinkingManager.application(app, open: url, options: options)
    return handledBySubscribers || handledByJS
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    // Same guard as openURL: universal links arriving while a prototype is
    // mounted are swallowed (same share) or parked + shell remounted.
    if userActivity.activityType == NSUserActivityTypeBrowsingWeb,
       let url = userActivity.webpageURL,
       handleExternalURLWhilePrototypeMounted(url) {
      return true
    }
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

// A full-screen overlay window that passes touches through to the prototype below,
// except on its floating button. While a menu is presented from this window, hit-testing
// is normal so the menu is interactive.
final class PassthroughWindow: UIWindow {
  weak var passthroughView: UIView?
  var menuOpen = false

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    if menuOpen { return super.hitTest(point, with: event) }
    guard !isHidden, let target = passthroughView, !target.isHidden else { return nil }
    let local = convert(point, to: target)
    return target.bounds.contains(local) ? super.hitTest(point, with: event) : nil
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // When set, the factory loads this bundle instead of the default (used to mount a
  // loaded prototype's bundle on a fresh host).
  var overrideBundleURL: URL?

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    overrideBundleURL ?? bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
    if let overrideBundleURL {
      return overrideBundleURL
    }
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
