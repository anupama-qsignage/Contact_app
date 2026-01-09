import { BlurMask, Canvas, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';

type Props = {
  id: string;
  size?: number;
  startX?: number;   
  startY?: number;   
  margin?: number;   
  onChange?: (id: string, x: number, y: number) => void;
  canMoveTo?: (id: string, x: number, y: number) => boolean;
  contactName?: string;
  callDuration?: number; // Total call duration in seconds
};

export default function Bubble({
  id,
  size = 140,
  startX = 80,
  startY = 200,
  margin = 6,
  onChange,
  canMoveTo,
  contactName,
  callDuration = 0,
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

  const getInitials = (name: string | undefined): string => {
    if (!name) return '';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return 'No calls';
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      if (minutes > 0) {
        return secs > 0 ? `${hours}h ${minutes}m ${secs}s` : `${hours}h ${minutes}m`;
      }
      return secs > 0 ? `${hours}h ${secs}s` : `${hours}h`;
    }
  };

  const fontSize = size * 0.25;
  const initials = contactName ? getInitials(contactName) : '';
  const durationText = formatDuration(callDuration);

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
      {contactName && (
        <View style={[styles.textContainer, { width: size, height: size }]}>
          <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
          <Text style={[styles.name, { fontSize: size * 0.12 }]} numberOfLines={1}>
            {contactName}
          </Text>
          <Text style={[styles.duration, { fontSize: size * 0.09 }]}>
            {durationText}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  textContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    top: 0,
    left: 0,
  },
  initials: {
    color: '#fff',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 4,
  },
  name: {
    color: '#fff',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginTop: 2,
  },
  duration: {
    color: '#fff',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.9,
  },
});
