import React, { useRef } from 'react';
import { StyleSheet, View, PanResponder, Animated } from 'react-native';
import { Canvas, Circle, Group, RadialGradient, vec, BlurMask } from '@shopify/react-native-skia';

type Props = {
  size?: number;
  startX?: number;
  startY?: number;
};

export default function DraggableSkiaBubbleNoReanimated({
  size = 140,
  startX = 80,
  startY = 200,
}: Props) {
  const half = size / 2;
  const translate = useRef(new Animated.ValueXY({ x: startX, y: startY })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        translate.setOffset({ x: (translate as any).x._value, y: (translate as any).y._value });
        translate.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: translate.x, dy: translate.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        translate.flattenOffset();
        // small settle animation
        Animated.spring(translate, {
          toValue: { x: (translate as any).x._value, y: (translate as any).y._value },
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
        { width: size, height: size },
        { transform: [{ translateX: translate.x }, { translateY: translate.y }] },
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
