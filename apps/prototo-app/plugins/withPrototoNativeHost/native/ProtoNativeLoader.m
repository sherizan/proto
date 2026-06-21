#import "ProtoNativeLoader.h"
#import <React/RCTBridgeModule.h>
#import <EXDevLauncher/EXDevLauncherController.h>

// JS bridge: exposes `PrototoRuntime.loadPrototype(url)` / `goHome()` to React Native,
// plus class methods for native callers (the overlay Home button).
@interface ProtoNativeLoader () <RCTBridgeModule>
@end

@implementation ProtoNativeLoader

RCT_EXPORT_MODULE(PrototoRuntime);

+ (BOOL)requiresMainQueueSetup { return NO; }

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

+ (void)loadApp:(NSString *)urlString {
  NSURL *url = [self appURLFromString:urlString];
  if (!url) {
    NSLog(@"PROTO loadApp BAD_URL=%@", urlString);
    return;
  }
  NSLog(@"PROTO loadApp START url=%@", url.absoluteString);
  dispatch_async(dispatch_get_main_queue(), ^{
    [[EXDevLauncherController sharedInstance] loadApp:url onSuccess:^{
      NSLog(@"PROTO loadApp SUCCESS");
      [[NSNotificationCenter defaultCenter] postNotificationName:@"ProtoPrototypeLoaded" object:nil];
    } onError:^(NSError *error) {
      NSLog(@"PROTO loadApp ERROR=%@", error.localizedDescription);
    }];
  });
}

+ (void)goHome {
  dispatch_async(dispatch_get_main_queue(), ^{
    EXDevLauncherController *controller = [EXDevLauncherController sharedInstance];
    // After an EAS-update load, `sourceUrl` prefers the update's launchAssetURL
    // (the prototype). Reset that so loadLocalBundle's embedded sourceUrl wins on return.
    @try {
      // KVC key without the leading underscore maps to the `_`-prefixed ivar.
      [controller setValue:@NO forKey:@"shouldPreferUpdatesInterfaceSourceUrl"];
    } @catch (NSException *e) {
      NSLog(@"PROTO goHome: could not reset source-url preference (%@)", e.name);
    }
    [controller loadLocalBundleOnSuccess:^{
      NSLog(@"PROTO goHome SUCCESS");
      [[NSNotificationCenter defaultCenter] postNotificationName:@"ProtoReturnedHome" object:nil];
    } onError:^(NSError *error) {
      NSLog(@"PROTO goHome ERROR=%@", error.localizedDescription);
    }];
  });
}

RCT_EXPORT_METHOD(loadPrototype:(NSString *)urlString) {
  [ProtoNativeLoader loadApp:urlString];
}

RCT_EXPORT_METHOD(goHome) {
  [ProtoNativeLoader goHome];
}

@end
