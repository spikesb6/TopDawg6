import { useEffect, useState } from 'react';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const SPIN_MS = 1300;
const FLASH_MS = 100;
const WOBBLE_MS = 80;

/**
 * The result card's spin: about 1.3 s of wobble while random entries from `flashPool`
 * flash past, then it lands on the target. With reduce motion on it lands right away.
 */
export function useSpin<T, Id>(startId: Id, spinOnOpen: boolean, flashPool: T[]) {
  const reduceMotion = useReducedMotion();
  const [currentId, setCurrentId] = useState(startId);
  const [target, setTarget] = useState<Id | null>(() =>
    spinOnOpen && !reduceMotion ? startId : null
  );
  const [flash, setFlash] = useState<T | null>(null);

  const wobble = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-1 + wobble.get()}deg` }],
  }));

  useEffect(() => {
    if (target == null) return;
    wobble.set(
      withSequence(
        withRepeat(
          withSequence(
            withTiming(-4, { duration: WOBBLE_MS }),
            withTiming(4, { duration: WOBBLE_MS })
          ),
          Math.floor(SPIN_MS / (WOBBLE_MS * 2)),
          true
        ),
        withTiming(0, { duration: WOBBLE_MS })
      )
    );
    const flashTimer = setInterval(() => {
      if (flashPool.length > 0) setFlash(flashPool[Math.floor(Math.random() * flashPool.length)]);
    }, FLASH_MS);
    const land = setTimeout(() => {
      clearInterval(flashTimer);
      setCurrentId(target);
      setFlash(null);
      setTarget(null);
    }, SPIN_MS);
    return () => {
      clearInterval(flashTimer);
      clearTimeout(land);
    };
  }, [target, wobble, flashPool]);

  return {
    currentId,
    spinning: target != null,
    flash,
    cardStyle,
    spinTo: (id: Id) => (reduceMotion ? setCurrentId(id) : setTarget(id)),
  };
}
