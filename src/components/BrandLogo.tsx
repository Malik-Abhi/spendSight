import { Image, StyleSheet, View } from 'react-native';

type BrandLogoProps = {
  width?: number;
  height?: number;
};

const logoSource = require('../../assets/spendsight-logo.png');

export function BrandLogo({ width = 280, height = 104 }: BrandLogoProps) {
  return (
    <View style={[styles.wrap, { width, height }]}>
      <Image source={logoSource} resizeMode="contain" style={styles.image} accessibilityLabel="SpendSight logo" />
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
