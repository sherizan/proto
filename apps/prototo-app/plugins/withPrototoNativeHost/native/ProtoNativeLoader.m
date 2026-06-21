#import "ProtoNativeLoader.h"
#import <EXDevLauncher/EXDevLauncherController.h>

@implementation ProtoNativeLoader

+ (void)loadApp:(NSString *)urlString {
  NSURL *url = [NSURL URLWithString:urlString];
  if (!url) {
    NSLog(@"PROTOSPIKE crux2 loadApp BAD_URL=%@", urlString);
    return;
  }
  NSLog(@"PROTOSPIKE crux2 loadApp START url=%@", urlString);
  dispatch_async(dispatch_get_main_queue(), ^{
    [[EXDevLauncherController sharedInstance] loadApp:url onSuccess:^{
      UIViewController *root = UIApplication.sharedApplication.delegate.window.rootViewController;
      NSLog(@"PROTOSPIKE crux2 loadApp SUCCESS rootVC=%@", NSStringFromClass([root class]));
    } onError:^(NSError *error) {
      NSLog(@"PROTOSPIKE crux2 loadApp ERROR=%@", error.localizedDescription);
    }];
  });
}

+ (void)goHome {
  dispatch_async(dispatch_get_main_queue(), ^{
    [[EXDevLauncherController sharedInstance] loadLocalBundleOnSuccess:^{
      NSLog(@"PROTOSPIKE goHome SUCCESS");
    } onError:^(NSError *error) {
      NSLog(@"PROTOSPIKE goHome ERROR=%@", error.localizedDescription);
    }];
  });
}

@end
