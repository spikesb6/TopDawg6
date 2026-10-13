import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type BouncyPressableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Resting tilt in degrees, so crooked buttons keep their angle while bouncing. */
  tilt?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// A small bounce on tap. Skipped when the phone asks for reduced motion.
export function BouncyPressable({
  style,
  tilt = 0,
  onPress,
  children,
  ...rest
}: BouncyPressableProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt}deg` }, { scale: scale.get() }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPress={(e) => {
        if (!reduceMotion) {
          scale.set(
            withSequence(
              withTiming(0.94, { duration: 90 }),
              withSpring(1, { damping: 6, stiffness: 260 })
            )
          );
        }
        onPress?.(e);
      }}>
      {children}
    </AnimatedPressable>
  );
}
