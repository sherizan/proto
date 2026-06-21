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

    // Native overlay window that floats above any loaded prototype bundle.
    installOverlay()

    return didFinish
  }

  // A small high-level window with a branded "Exit" control that floats above a running
  // prototype. Hidden on our shell; shown only while a prototype bundle is loaded.
  // Tapping it returns to our shell via the shim (loadLocalBundle).
  private func installOverlay() {
    let w: CGFloat = 96, h: CGFloat = 38
    let bounds = UIScreen.main.bounds
    // Sit above the home indicator / bottom safe area.
    let overlay = UIWindow(frame: CGRect(x: (bounds.width - w) / 2, y: bounds.height - h - 44, width: w, height: h))
    overlay.windowLevel = UIWindow.Level.alert + 1

    let vc = UIViewController()
    let btn = UIButton(type: .system)
    btn.frame = CGRect(x: 0, y: 0, width: w, height: h)
    btn.setTitle("✕ Exit", for: .normal)
    btn.setTitleColor(.white, for: .normal)
    btn.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
    btn.backgroundColor = UIColor(white: 0.0, alpha: 0.82)
    btn.layer.cornerRadius = h / 2
    btn.layer.shadowColor = UIColor.black.cgColor
    btn.layer.shadowOpacity = 0.25
    btn.layer.shadowRadius = 8
    btn.layer.shadowOffset = CGSize(width: 0, height: 2)
    btn.addTarget(self, action: #selector(overlayHomeTapped), for: .touchUpInside)
    vc.view.addSubview(btn)
    overlay.rootViewController = vc
    overlay.isHidden = true // shown only when a prototype is loaded
    overlayWindow = overlay

    let nc = NotificationCenter.default
    nc.addObserver(self, selector: #selector(onPrototypeLoaded), name: NSNotification.Name("ProtoPrototypeLoaded"), object: nil)
    nc.addObserver(self, selector: #selector(onReturnedHome), name: NSNotification.Name("ProtoReturnedHome"), object: nil)
    NSLog("PROTO overlay installed (hidden)")
  }

  @objc private func onPrototypeLoaded() {
    DispatchQueue.main.async {
      self.mount(bundleURL: ProtoNativeLoader.sourceUrl())
      self.overlayWindow?.isHidden = false
    }
  }

  @objc private func onReturnedHome() {
    DispatchQueue.main.async {
      // Return to OUR shell — mount the embedded bundle explicitly. (The controller's
      // sourceUrl getter still prefers the last EAS update's launchAssetURL, so we
      // can't rely on it here.)
      self.mount(bundleURL: Bundle.main.url(forResource: "main", withExtension: "jsbundle"))
      self.overlayWindow?.isHidden = true
    }
  }

  // Rebuild the RN root from a bundle and swap it into our window. This is the
  // Release-build replacement for the stock dev-launcher mount
  // (ExpoDevLauncherReactDelegateHandler.didStartWithSuccess), which no-ops when !APP_DEBUG.
  private func mount(bundleURL: URL?) {
    guard let factory = reactNativeFactory,
          let expoFactory = factory as? ExpoReactNativeFactoryProtocol,
          let source = bundleURL else {
      NSLog("PROTO mount SKIPPED (no factory or bundleURL)")
      return
    }
    if RCTIsNewArchEnabled() {
      factory.rootViewFactory.setValue(nil, forKey: "_reactHost")
    }
    let rootView = expoFactory.recreateRootView(
      withBundleURL: source,
      moduleName: "main",
      initialProps: nil,
      launchOptions: ProtoNativeLoader.launchOptions())
    window?.rootViewController?.view = rootView
    NSLog("PROTO mounted bundle=\(source.absoluteString)")
  }

  @objc private func overlayHomeTapped() {
    NSLog("PROTO overlay Exit tapped")
    ProtoNativeLoader.goHome()
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
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

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
