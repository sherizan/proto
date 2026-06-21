// Prototo native runtime — minimal slice of the expo-dev-launcher loader API for Swift.
// Importing the full <EXDevLauncher/EXDevLauncherController.h> drags EXUpdatesInterface
// into the bridging PCH and fails to compile; this slice exposes only what we call.
// Symbols resolve at link time against the real EXDevLauncherController class
// (force-linked via -ObjC in the config plugin).
@import Foundation;

@interface EXDevLauncherController : NSObject
+ (instancetype)sharedInstance;
- (void)loadApp:(NSURL *)url onSuccess:(void (^ _Nullable)(void))onSuccess onError:(void (^ _Nullable)(NSError *error))onError;
- (void)loadLocalBundleOnSuccess:(void (^ _Nullable)(void))onSuccess onError:(void (^ _Nullable)(NSError *error))onError;
- (void)navigateToLauncher;
@end
