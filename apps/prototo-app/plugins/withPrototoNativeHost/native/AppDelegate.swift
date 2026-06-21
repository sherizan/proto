internal import Expo
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

    // Native overlay window that floats above any loaded prototype bundle.
    installOverlay()

    return didFinish
  }

  // PROTOSPIKE crux 3: small high-level window with a Home control that persists over
  // whatever bundle is running. Tapping it returns to our shell via the shim (loadLocalBundle).
  private func installOverlay() {
    let w: CGFloat = 120, h: CGFloat = 40
    let bounds = UIScreen.main.bounds
    let overlay = UIWindow(frame: CGRect(x: (bounds.width - w) / 2, y: bounds.height - h - 28, width: w, height: h))
    overlay.windowLevel = UIWindow.Level.alert + 1
    let vc = UIViewController()
    let btn = UIButton(type: .system)
    btn.frame = CGRect(x: 0, y: 0, width: w, height: h)
    btn.setTitle("⌂ Prototo", for: .normal)
    btn.setTitleColor(.white, for: .normal)
    btn.backgroundColor = UIColor.black.withAlphaComponent(0.85)
    btn.layer.cornerRadius = h / 2
    btn.addTarget(self, action: #selector(overlayHomeTapped), for: .touchUpInside)
    vc.view.addSubview(btn)
    overlay.rootViewController = vc
    overlay.isHidden = false
    overlayWindow = overlay
    NSLog("PROTOSPIKE crux3 overlay installed")
  }

  @objc private func overlayHomeTapped() {
    NSLog("PROTOSPIKE crux3 Home tapped")
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
