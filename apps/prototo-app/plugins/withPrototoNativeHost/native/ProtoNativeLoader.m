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
    [[EXDevLauncherController sharedInstance] loadLocalBundleOnSuccess:^{
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
