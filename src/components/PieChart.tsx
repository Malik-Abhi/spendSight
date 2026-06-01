import Svg, { Circle, G } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';
import { CategoryTotal } from '../types/expense';

type PieChartProps = {
  data: CategoryTotal[];
  total: number;
  textColor: string;
  mutedColor: string;
};

export function PieChart({ data, total, textColor, mutedColor }: PieChartProps) {
  const size = 184;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const formattedTotal = `₹${total.toLocaleString('en-IN')}`;
  const amountSize = formattedTotal.length > 11 ? 18 : 23;

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={mutedColor}
            strokeWidth={strokeWidth}
            opacity={0.18}
            fill="transparent"
          />
          {data.map((item) => {
            const dash = total > 0 ? (item.total / total) * circumference : 0;
            const strokeDashoffset = -offset;
            offset += dash;

            return (
              <Circle
                key={item.category}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            );
          })}
        </G>
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.amount, { color: textColor, fontSize: amountSize }]} numberOfLines={1} adjustsFontSizeToFit>
          {formattedTotal}
        </Text>
        <Text style={[styles.label, { color: mutedColor }]}>This month</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 184,
    height: 184,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    maxWidth: 116
  },
  amount: {
    fontWeight: '900'
  },
  label: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '700'
  }
});
