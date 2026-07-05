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
    NSLog("PROTO overlay installed (hidden)")
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
      self.mount(bundleURL: ProtoNativeLoader.sourceUrl())
      // Bare hosts (Desktop's streamed sim / the Appetize embed send ui=bare)
      // get no Viewer menu — the prototype IS the whole experience there.
      self.overlayWindow?.isHidden = ProtoNativeLoader.bareUI()
    }
  }

  @objc private func onReturnedHome() {
    DispatchQueue.main.async {
      // Return to OUR shell — the embedded bundle (nil override → delegate default).
      self.mount(bundleURL: nil)
      self.overlayWindow?.isHidden = true
    }
  }

  // Mount a bundle by building a FRESH React Native factory + host and re-running
  // startReactNative (exactly like cold launch). `recreateRootView` reuses the running
  // host on a second swap (so prototype→shell kept showing the prototype); a fresh
  // factory per mount guarantees the new bundle actually loads. `bundleURL` nil → our
  // embedded shell; a file URL → that prototype bundle.
  private func mount(bundleURL: URL?) {
    // Every mount initializes a fresh runtime — defer any loadApp until it's done.
    ProtoNativeLoader.beginTransition()
    // Tear down the previous host so its JS runtime is released (avoid stacking runtimes).
    if RCTIsNewArchEnabled() {
      reactNativeFactory?.rootViewFactory.setValue(nil, forKey: "reactHost")
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
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
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
