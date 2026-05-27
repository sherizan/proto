import { forwardRef } from 'react';
import LottieView, { type LottieViewProps } from 'lottie-react-native';

export type LottieProps = LottieViewProps;

export const Lottie = forwardRef<LottieView, LottieProps>(function Lottie(
  { autoPlay = true, loop = true, ...rest },
  ref,
) {
  return <LottieView ref={ref} autoPlay={autoPlay} loop={loop} {...rest} />;
});

export type LottieRef = LottieView;
