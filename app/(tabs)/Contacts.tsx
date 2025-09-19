import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Bubble from '../bubble'; 

type BubbleState = { id: string; size: number; x: number; y: number };

export default function Contacts() {
  const { width, height } = Dimensions.get('window');

  const [bubbles, setBubbles] = useState<BubbleState[]>([
    { id: 'b1', size: 150, x: 80,  y: 200 },
    { id: 'b2', size: 90,  x: 220, y: 120 },
    { id: 'b3', size: 70,  x: 40,  y: 400 },
    { id: 'b4', size: 110, x: 200, y: 350 },
    { id: 'b5', size: 130, x: 140, y: 500 },
    { id: 'b6', size: 60,  x: 260, y: 250 },
  ]);

  const bubbleMapRef = useRef<Map<string, BubbleState>>(new Map(bubbles.map(b => [b.id, b])));
  const syncMap = (arr: BubbleState[]) => {
    const m = bubbleMapRef.current;
    m.clear();
    arr.forEach(b => m.set(b.id, b));
  };

  const canMoveTo = (id: string, x: number, y: number) => {
    const curr = bubbleMapRef.current.get(id);
    if (!curr) return true;
    const r1 = curr.size / 2;

    // keep inside screen bounds
    if (x < 0 || y < 0) return false;
    if (x + curr.size > width) return false;
    if (y + curr.size > height) return false;

    // Check against other bubbles
    for (const [otherId, b] of bubbleMapRef.current.entries()) {
      if (otherId === id) continue;
      const r2 = b.size / 2;
      const c1x = x + r1;
      const c1y = y + r1;
      const c2x = b.x + r2;
      const c2y = b.y + r2;
      const dx = c1x - c2x;
      const dy = c1y - c2y;
      const distSq = dx * dx + dy * dy;
      const minDist = r1 + r2; // no margin, just touching allowed
      if (distSq < minDist * minDist) {
        return false; // would overlap
      }
    }
    return true;
  };

  const onChange = (id: string, x: number, y: number) => {
    setBubbles(prev => {
      const next = prev.map(b => (b.id === id ? { ...b, x, y } : b));
      syncMap(next);
      return next;
    });
  };

  useMemo(() => syncMap(bubbles), []);

  return (
    <View style={styles.container}>
      {bubbles.map(b => (
        <Bubble
          key={b.id}
          id={b.id}
          size={b.size}
          startX={b.x}
          startY={b.y}
          onChange={onChange}
          canMoveTo={canMoveTo}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f1a' },
});
