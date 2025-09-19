import React, { useRef } from 'react';
import { StyleSheet, Animated, PanResponder } from 'react-native';
import { Canvas, Circle, Group, RadialGradient, vec, BlurMask } from '@shopify/react-native-skia';

type Props = {
  id: string;
  size?: number;
  startX?: number;   
  startY?: number;   
  margin?: number;   
  onChange?: (id: string, x: number, y: number) => void;
  canMoveTo?: (id: string, x: number, y: number) => boolean;
};

export default function Bubble({
  id,
  size = 140,
  startX = 80,
  startY = 200,
  margin = 6,
  onChange,
  canMoveTo,
}: Props) {
  const half = size / 2;

  // We store the "base" absolute offset separately so we can compute candidates quickly.
  const baseX = useRef(startX);
  const baseY = useRef(startY);

  const translate = useRef(new Animated.ValueXY({ x: startX, y: startY })).current;

  const tryMoveTo = (candX: number, candY: number) => {
    // Ask parent if new position is allowed; if not provided, allow.
    const allowed = canMoveTo ? canMoveTo(id, candX, candY) : true;
    if (allowed) {
      translate.setValue({ x: candX, y: candY });
      if (onChange) onChange(id, candX, candY);
      return true;
    }
    return false;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Nothing special; we move in absolute coords directly.
      },
      onPanResponderMove: (_, gesture) => {
        const candX = baseX.current + gesture.dx;
        const candY = baseY.current + gesture.dy;
        // Only update if no overlap
        tryMoveTo(candX, candY);
      },
      onPanResponderRelease: (_, gesture) => {
        // Finalize position; if last move was blocked, keep previous allowed pos
        const candX = baseX.current + gesture.dx;
        const candY = baseY.current + gesture.dy;
        const moved = tryMoveTo(candX, candY);
        // Update base to the actually shown position
        const { x, y } = (translate as any).__getValue();
        baseX.current = moved ? candX : x;
        baseY.current = moved ? candY : y;

        // small settle (optional)
        Animated.spring(translate, {
          toValue: { x: baseX.current, y: baseY.current },
          friction: 6,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.wrap,
        { width: size, height: size, transform: [{ translateX: translate.x }, { translateY: translate.y }] },
      ]}
    >
      <Canvas style={{ width: size, height: size }}>
        <Group>
          <Circle cx={half} cy={half} r={half * 0.98}>
            <RadialGradient
              c={vec(half * 0.65, half * 0.6)}
              r={half}
              colors={[
                'rgba(255,255,255,0.65)',
                'rgba(255,182,193,0.55)',
                'rgba(173,216,230,0.45)',
                'rgba(144,238,144,0.35)',
                'rgba(255,255,255,0.25)',
              ]}
            />
          </Circle>

          <Circle cx={half} cy={half} r={half * 0.98} color="rgba(255,255,255,0.22)">
            <BlurMask blur={2.5} style="normal" />
          </Circle>

          <Circle cx={half * 0.55} cy={half * 0.45} r={half * 0.22} color="rgba(255,255,255,0.85)">
            <BlurMask blur={8} style="normal" />
          </Circle>

          <Circle cx={half * 0.72} cy={half * 0.35} r={half * 0.10} color="rgba(255,255,255,0.55)">
            <BlurMask blur={6} style="normal" />
          </Circle>

          <Circle cx={half} cy={half} r={half * 0.65}>
            <RadialGradient
              c={vec(half * 0.9, half * 0.85)}
              r={half * 0.9}
              colors={[
                'rgba(255,255,255,0.0)',
                'rgba(186,85,211,0.15)',
                'rgba(72,209,204,0.18)',
                'rgba(255,105,180,0.14)',
              ]}
            />
          </Circle>
        </Group>
      </Canvas>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
});
