import { useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import { EaseView } from 'react-native-ease';
import type {
  AnimateProps,
  CubicBezier,
  EasingType,
  EaseViewProps,
  NoneTransition,
  SingleTransition,
  SpringTransition,
  TimingTransition,
  Transition,
  TransitionEndEvent,
  TransitionMap,
  TransformOrigin,
  TransformPerspective,
} from 'react-native-ease';

export type MotionPressableProps = Omit<PressableProps, 'children' | 'style'> & {
  animate?: AnimateProps;
  pressedAnimate?: AnimateProps;
  transition?: Transition;
  style?: ViewStyle;
  children?: ReactNode;
};

function MotionPressable({
  animate,
  pressedAnimate,
  transition,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: MotionPressableProps) {
  const [pressed, setPressed] = useState(false);
  const current: AnimateProps | undefined =
    pressed && pressedAnimate ? { ...animate, ...pressedAnimate } : animate;

  return (
    <Pressable
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      {...rest}
    >
      <EaseView animate={current} transition={transition} style={style}>
        {children}
      </EaseView>
    </Pressable>
  );
}

export const Motion = {
  View: EaseView,
  Pressable: MotionPressable,
};

export type {
  AnimateProps,
  CubicBezier,
  EasingType,
  EaseViewProps,
  NoneTransition,
  SingleTransition,
  SpringTransition,
  TimingTransition,
  Transition,
  TransitionEndEvent,
  TransitionMap,
  TransformOrigin,
  TransformPerspective,
};
