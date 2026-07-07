// Prototo native runtime — slim Swift-facing loader.
// A differently-named shim so the bridging header never sees the real
// EXDevLauncherController interface (avoids both the EXUpdatesInterface PCH
// failure and the Debug "different definitions" conflict). The real header is
// imported only inside the .m.
@import Foundation;
#import <React/RCTEventEmitter.h>

// RCTEventEmitter so prototype-load progress/failure reach JS ("protoLoadProgress",
// "protoLoadFailed") — the share screen renders a real progress bar and an error
// state instead of an indefinite spinner.
@interface ProtoNativeLoader : RCTEventEmitter
// Intercept RCTFatal so a failed prototype load recovers to our shell instead of
// aborting the app. Call once at launch.
+ (void)installFatalHandler;
// Wire the expo-updates dev-launcher interface into EXDevLauncherController so
// loadApp can fetch EAS Update bundles in a Release build (the stock react-delegate
// that normally does this no-ops when !APP_DEBUG). Pass the Swift updates controller.
+ (void)setUpdatesInterface:(id)updatesInterface;
+ (void)loadApp:(NSString *)urlString;
+ (void)goHome;
// Mark a runtime transition (cold start / mount) as started: loadApp calls
// arriving before runtimeReady are deferred, not run — two runtimes registering
// native modules concurrently race in shared singletons (DC-07 crash). Cleared
// by runtimeReady (the shell's JS ping) or a short safety-valve timeout.
+ (void)beginTransition;
+ (void)runtimeReady;
// Re-mount the currently-loaded prototype on a fresh JS host (Refresh).
+ (void)reload;
// True when the current load asked for bare UI (deep link carried `ui=bare` —
// Prototo Desktop's sim + the Appetize embed use the app as a pure runtime).
// The floating Viewer menu stays hidden. Re-derived on every loadApp;
// Viewer-originated loads never send the param, so they always get the menu.
+ (BOOL)bareUI;
// The bundle URL of the currently-loaded app (set by loadApp/loadLocalBundle).
+ (nullable NSURL *)sourceUrl;
// The share token of the currently/last loaded self-hosted share (from its
// /api/manifest/<token> URL), or nil (EAS-group shares, Metro, none loaded).
+ (nullable NSString *)currentShareToken;
// Launch options the loaded bundle should receive.
+ (nullable NSDictionary *)launchOptions;
@end
