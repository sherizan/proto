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

// Bare-UI mode: hosts that use this app purely as a runtime (Prototo Desktop's
// streamed sim, the website's Appetize embed) append `ui=bare` to the deep link
// — the floating Viewer menu (Refresh / Exit to home) stays hidden. Set on
// EVERY load (default NO), so Viewer dashboard/share opens always get the menu.
static BOOL sBareUI = NO;

+ (BOOL)bareUI {
  @synchronized (self) {
    return sBareUI;
  }
}

// Accept either a bare app URL (exp:// or https update) or the dev-client deep link
// `prototo://expo-development-client/?url=<inner>[&ui=bare]` and return the inner
// app URL. Parsed with NSURLComponents (the old prefix-strip swallowed any extra
// query params into the inner URL).
+ (NSURL *)appURLFromString:(NSString *)urlString {
  NSString *value = [urlString stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  BOOL bare = NO;
  NSURL *result = nil;

  if ([value hasPrefix:@"prototo://expo-development-client"]) {
    NSURLComponents *components = [NSURLComponents componentsWithString:value];
    NSString *inner = nil;
    for (NSURLQueryItem *item in components.queryItems) {
      if ([item.name isEqualToString:@"url"]) inner = item.value; // already decoded
      if ([item.name isEqualToString:@"ui"] && [item.value isEqualToString:@"bare"]) bare = YES;
    }
    if (inner.length > 0) result = [NSURL URLWithString:inner];
  } else {
    result = [NSURL URLWithString:value];
  }

  @synchronized (self) {
    sBareUI = bare;
  }
  return result;
}

// Serializes runtime creation. A loadApp while another runtime is initializing
// (cold start, a mount, or an in-flight load) starts a second JS runtime whose
// module registration races the first inside shared singletons like
// EXPermissionsService — SIGSEGV/SIGABRT (DC-07). Such loads park in a
// last-wins pending slot and drain when the transition ends.
static BOOL sProtoLoadInFlight = NO;
static BOOL sTransitioning = YES; // cold start counts as a transition
static NSString *sPendingURL = nil;
static NSUInteger sTransitionGeneration = 0;

+ (void)beginTransition {
  NSUInteger generation;
  @synchronized (self) {
    sTransitioning = YES;
    generation = ++sTransitionGeneration;
  }
  NSLog(@"PROTO transition BEGIN gen=%lu", (unsigned long)generation);
  // Safety valve: prototype bundles never ping runtimeReady, so time the
  // transition out rather than starving a deferred link.
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(3 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    @synchronized (self) {
      if (generation != sTransitionGeneration || !sTransitioning) return;
    }
    NSLog(@"PROTO transition TIMEOUT gen=%lu", (unsigned long)generation);
    [self runtimeReady];
  });
}

+ (void)runtimeReady {
  NSString *pending;
  @synchronized (self) {
    sTransitioning = NO;
    pending = sPendingURL;
    sPendingURL = nil;
  }
  NSLog(@"PROTO runtime READY pending=%@", pending ?: @"none");
  if (pending) [self loadApp:pending];
}

+ (void)drainPendingAfterLoad {
  NSString *pending;
  @synchronized (self) {
    pending = sPendingURL;
    sPendingURL = nil;
  }
  if (pending) [self loadApp:pending];
}

+ (void)loadApp:(NSString *)urlString {
  NSURL *url = [self appURLFromString:urlString];
  if (!url) {
    NSLog(@"PROTO loadApp BAD_URL=%@", urlString);
    return;
  }
  // Defer instead of running: while a runtime is initializing or another load
  // is in flight, park the URL (last-wins) and load it once the coast is clear.
  @synchronized (self) {
    if (sTransitioning || sProtoLoadInFlight) {
      sPendingURL = urlString;
      NSLog(@"PROTO loadApp DEFERRED (transitioning=%d inFlight=%d)", sTransitioning, sProtoLoadInFlight);
      return;
    }
    sProtoLoadInFlight = YES;
  }
  NSLog(@"PROTO loadApp START url=%@", url.absoluteString);
  dispatch_async(dispatch_get_main_queue(), ^{
    [[EXDevLauncherController sharedInstance] loadApp:url onSuccess:^{
      @synchronized (self) {
        sProtoLoadInFlight = NO;
      }
      NSLog(@"PROTO loadApp SUCCESS");
      [[NSNotificationCenter defaultCenter] postNotificationName:@"ProtoPrototypeLoaded" object:nil];
    } onError:^(NSError *error) {
      @synchronized (self) {
        sProtoLoadInFlight = NO;
      }
      NSLog(@"PROTO loadApp ERROR=%@", error.localizedDescription);
      [self drainPendingAfterLoad];
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

+ (void)reload {
  // The currently-loaded prototype's source is still on the controller; re-posting the
  // loaded notification re-mounts it on a fresh host (AppDelegate onPrototypeLoaded).
  dispatch_async(dispatch_get_main_queue(), ^{
    NSLog(@"PROTO reload (re-mount current)");
    [[NSNotificationCenter defaultCenter] postNotificationName:@"ProtoPrototypeLoaded" object:nil];
  });
}

RCT_EXPORT_METHOD(loadPrototype:(NSString *)urlString) {
  [ProtoNativeLoader loadApp:urlString];
}

RCT_EXPORT_METHOD(goHome) {
  [ProtoNativeLoader goHome];
}

// The shell pings this from its root layout once its runtime is up — strictly
// after module registration, so a deferred deep link can now load safely.
RCT_EXPORT_METHOD(shellReady) {
  [ProtoNativeLoader runtimeReady];
}

@end
