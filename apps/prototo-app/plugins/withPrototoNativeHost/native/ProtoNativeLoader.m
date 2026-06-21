#import "ProtoNativeLoader.h"
#import <React/RCTBridgeModule.h>
#import <React/RCTAssert.h>
#import <EXDevLauncher/EXDevLauncherController.h>

// JS bridge: exposes `PrototoRuntime.loadPrototype(url)` / `goHome()` to React Native,
// plus class methods for native callers (the overlay Home button).
@interface ProtoNativeLoader () <RCTBridgeModule>
@end

@implementation ProtoNativeLoader

RCT_EXPORT_MODULE(PrototoRuntime);

+ (BOOL)requiresMainQueueSetup { return NO; }

+ (void)installFatalHandler {
  // In a Release build, a prototype that fails to load (network blip, JS error in the
  // prototype, re-entrant load) calls RCTFatal, which aborts the whole app. Intercept it
  // and recover to our shell instead of crashing.
  RCTSetFatalHandler(^(NSError *error) {
    NSLog(@"PROTO RCTFatal intercepted, recovering to shell: %@", error.localizedDescription);
    dispatch_async(dispatch_get_main_queue(), ^{
      @try {
        [[EXDevLauncherController sharedInstance].updatesInterface reset];
      } @catch (NSException *e) {
        NSLog(@"PROTO fatal-recovery reset failed (%@)", e.name);
      }
      [[NSNotificationCenter defaultCenter] postNotificationName:@"ProtoReturnedHome" object:nil];
    });
  });
}

+ (void)setUpdatesInterface:(id)updatesInterface {
  EXDevLauncherController *controller = [EXDevLauncherController sharedInstance];
  controller.updatesInterface = updatesInterface;
  if ([updatesInterface respondsToSelector:@selector(setUpdatesExternalInterfaceDelegate:)]) {
    [updatesInterface setUpdatesExternalInterfaceDelegate:controller];
  }
  NSLog(@"PROTO updatesInterface wired=%@", updatesInterface ? @"yes" : @"nil");
}

+ (NSURL *)sourceUrl {
  return [[EXDevLauncherController sharedInstance] sourceUrl];
}

+ (NSDictionary *)launchOptions {
  return [[EXDevLauncherController sharedInstance] getLaunchOptions];
}

// Accept either a bare app URL (exp:// or https update) or the dev-client deep link
// `prototo://expo-development-client/?url=<inner>` and return the inner app URL.
+ (NSURL *)appURLFromString:(NSString *)urlString {
  NSString *prefix = @"prototo://expo-development-client/?url=";
  NSString *value = [urlString stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  if ([value hasPrefix:prefix]) {
    NSString *inner = [value substringFromIndex:prefix.length];
    inner = [inner stringByRemovingPercentEncoding] ?: inner;
    return [NSURL URLWithString:inner];
  }
  return [NSURL URLWithString:value];
}

static BOOL sProtoLoadInFlight = NO;

+ (void)loadApp:(NSString *)urlString {
  NSURL *url = [self appURLFromString:urlString];
  if (!url) {
    NSLog(@"PROTO loadApp BAD_URL=%@", urlString);
    return;
  }
  // Ignore overlapping loads — a second loadApp while one is fetching can leave the RN
  // instance in a half-loaded state and trigger a fatal bundle-loading error.
  if (sProtoLoadInFlight) {
    NSLog(@"PROTO loadApp IGNORED (load already in flight)");
    return;
  }
  sProtoLoadInFlight = YES;
  NSLog(@"PROTO loadApp START url=%@", url.absoluteString);
  dispatch_async(dispatch_get_main_queue(), ^{
    [[EXDevLauncherController sharedInstance] loadApp:url onSuccess:^{
      sProtoLoadInFlight = NO;
      NSLog(@"PROTO loadApp SUCCESS");
      [[NSNotificationCenter defaultCenter] postNotificationName:@"ProtoPrototypeLoaded" object:nil];
    } onError:^(NSError *error) {
      sProtoLoadInFlight = NO;
      NSLog(@"PROTO loadApp ERROR=%@", error.localizedDescription);
    }];
  });
}

+ (void)goHome {
  // expo-updates is the global bundle provider in our forked dev-launcher-in-Release
  // mode: after loadApp it serves the launched update's launchAssetURL to EVERY new RN
  // host, bypassing our delegate. `reset` clears the launched update (launcher = nil ->
  // launchAssetURL = nil) so the fresh host (AppDelegate onReturnedHome) falls back to
  // our embedded shell bundle.
  dispatch_async(dispatch_get_main_queue(), ^{
    EXDevLauncherController *controller = [EXDevLauncherController sharedInstance];
    @try {
      [controller.updatesInterface reset];
    } @catch (NSException *e) {
      NSLog(@"PROTO goHome: updates reset failed (%@)", e.name);
    }
    NSLog(@"PROTO goHome (updates reset)");
    [[NSNotificationCenter defaultCenter] postNotificationName:@"ProtoReturnedHome" object:nil];
  });
}

RCT_EXPORT_METHOD(loadPrototype:(NSString *)urlString) {
  [ProtoNativeLoader loadApp:urlString];
}

RCT_EXPORT_METHOD(goHome) {
  [ProtoNativeLoader goHome];
}

@end
