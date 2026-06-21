// Prototo native runtime — slim Swift-facing loader.
// A differently-named shim so the bridging header never sees the real
// EXDevLauncherController interface (avoids both the EXUpdatesInterface PCH
// failure and the Debug "different definitions" conflict). The real header is
// imported only inside the .m.
@import Foundation;

@interface ProtoNativeLoader : NSObject
+ (void)loadApp:(NSString *)urlString;
+ (void)goHome;
@end
