import React from 'react';
import { StyleSheet, View } from 'react-native';
import DraggableSkiaBubbleNoReanimated from '../DraggableSkiaBubbleNoReanimated';

export default function Contacts() {
  return (
    <View style={styles.container}>
      {/* Big center bubble */}
      <DraggableSkiaBubbleNoReanimated size={150} startX={80} startY={200} />

      {/* Smaller ones */}
      <DraggableSkiaBubbleNoReanimated size={90} startX={220} startY={120} />
      <DraggableSkiaBubbleNoReanimated size={70} startX={40} startY={400} />
      <DraggableSkiaBubbleNoReanimated size={110} startX={200} startY={350} />
      <DraggableSkiaBubbleNoReanimated size={130} startX={140} startY={500} />

      {/* Extra tiny bubble */}
      <DraggableSkiaBubbleNoReanimated size={60} startX={260} startY={250} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f1a', // dark background looks great
  },
});
