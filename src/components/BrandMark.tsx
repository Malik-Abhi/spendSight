import { Image, StyleSheet, View } from 'react-native';

type BrandMarkProps = {
  size?: number;
};

const markSource = require('../../assets/spendsight-mark.png');

export function BrandMark({ size = 82 }: BrandMarkProps) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image source={markSource} resizeMode="contain" style={styles.image} accessibilityLabel="SpendSight logo" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  image: {
    width: '100%',
    height: '100%'
  }
});
