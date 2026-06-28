import LottieView, { type LottieViewProps } from 'lottie-react-native';

export type LottieProps = {
  source: LottieViewProps['source'];
  autoPlay?: boolean;
  loop?: boolean;
  style?: LottieViewProps['style'];
};

export function Lottie({ source, autoPlay = true, loop = true, style }: LottieProps) {
  return <LottieView source={source} autoPlay={autoPlay} loop={loop} style={style} />;
}
