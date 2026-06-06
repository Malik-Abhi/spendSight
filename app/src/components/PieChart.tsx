import Svg, { Circle, G } from 'react-native-svg';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { CategoryTotal } from '../../../models/expense';

type PieChartProps = {
  data: CategoryTotal[];
  total: number;
  textColor: string;
  mutedColor: string;
};

export function PieChart({ data, total, textColor, mutedColor }: PieChartProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const size = 216;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const formattedTotal = `₹${total.toLocaleString('en-IN')}`;
  const amountSize = formattedTotal.length > 12 ? 19 : 25;
  const activeItem = data.find((item) => item.category === activeCategory) ?? data[0];
  const activePercent = activeItem && total > 0 ? Math.round((activeItem.total / total) * 100) : 0;

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
            const isActive = activeCategory === item.category;
            const webHoverProps =
              Platform.OS === 'web'
                ? ({
                    onMouseEnter: () => setActiveCategory(item.category),
                    onMouseLeave: () => setActiveCategory(null),
                    style: { cursor: 'pointer', transition: 'stroke-width 160ms ease, opacity 160ms ease' }
                  } as object)
                : {};
            offset += dash;

            return (
              <Circle
                key={item.category}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={item.color}
                strokeWidth={isActive ? strokeWidth + 5 : strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
                fill="transparent"
                opacity={!activeCategory || isActive ? 1 : 0.74}
                onPress={() => setActiveCategory(isActive ? null : item.category)}
                {...webHoverProps}
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
      {activeItem ? (
        <View style={[styles.tooltip, { borderColor: activeItem.color }]}>
          <View style={[styles.tooltipDot, { backgroundColor: activeItem.color }]} />
          <View style={styles.tooltipText}>
            <Text style={[styles.tooltipCategory, { color: textColor }]} numberOfLines={1}>
              {activeItem.category}
            </Text>
            <Text style={[styles.tooltipMeta, { color: mutedColor }]}>{activePercent}% of this month</Text>
          </View>
          <Text style={[styles.tooltipAmount, { color: activeItem.color }]} numberOfLines={1}>
            ₹{activeItem.total.toLocaleString('en-IN')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 216,
    height: 278,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 18,
    marginBottom: 22
  },
  center: {
    position: 'absolute',
    top: 78,
    alignItems: 'center',
    width: 148
  },
  amount: {
    fontWeight: '900'
  },
  label: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '700'
  },
  tooltip: {
    position: 'absolute',
    bottom: 10,
    left: 4,
    right: 4,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(21, 31, 40, 0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  tooltipDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  tooltipText: {
    flex: 1,
    minWidth: 0
  },
  tooltipCategory: {
    fontSize: 13,
    fontWeight: '900'
  },
  tooltipMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700'
  },
  tooltipAmount: {
    maxWidth: 82,
    fontSize: 12,
    fontWeight: '900'
  }
});
