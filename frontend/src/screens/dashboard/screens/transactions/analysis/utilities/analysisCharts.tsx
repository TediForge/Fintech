import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Circle, Path, Rect } from 'react-native-svg';

const radians = (degrees) => (degrees * Math.PI) / 180;

const describeArc = (cx, cy, r, startAngle, endAngle) => {
  const start = {
    x: cx + r * Math.cos(radians(endAngle)),
    y: cy + r * Math.sin(radians(endAngle)),
  };
  const end = {
    x: cx + r * Math.cos(radians(startAngle)),
    y: cy + r * Math.sin(radians(startAngle)),
  };
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

export const DonutChart = ({ data = [], size = 160, strokeWidth = 18, innerLabel = '' }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  let startAngle = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${center}, ${center}`}>
          {data.map((item, index) => {
            const angle = (item.value / total) * 360;
            const path = describeArc(center, center, radius, startAngle, startAngle + angle);
            const element = (
              <Path
                key={`donut-segment-${index}`}
                d={path}
                stroke={item.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
            );
            startAngle += angle;
            return element;
          })}
        </G>
        <Circle cx={center} cy={center} r={radius - strokeWidth / 2 - 2} fill="#f7fafc" />
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={styles.donutLabel}>{innerLabel}</Text>
      </View>
    </View>
  );
};

export const TrendLineChart = ({ income = [], expense = [], labels = [], width = 280, height = 140 }) => {
  const maxValue = Math.max(...income, ...expense, 1);
  const xStep = labels.length > 1 ? width / (labels.length - 1) : width;

  const linePath = (values) => {
    return values
      .map((value, index) => {
        const x = xStep * index;
        const y = height - (value / maxValue) * height;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  return (
    <View style={{ width, height, position: 'relative' }}>
      <Svg width={width} height={height}>
        {[0, 1, 2, 3].map((index) => (
          <LineGridRow key={`grid-${index}`} width={width} y={(height / 4) * index} />
        ))}
        <Path d={linePath(expense)} fill="none" stroke="#D9534F" strokeWidth={2.5} />
        <Path d={linePath(income)} fill="none" stroke="#2FB86D" strokeWidth={2.5} />
        {[...income, ...expense].map((_, idx) => null)}
      </Svg>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#2FB86D' }]} /><Text style={styles.legendText}>Income</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#D9534F' }]} /><Text style={styles.legendText}>Spend</Text></View>
      </View>
      <View style={styles.labelRow}>
        {labels.map((label, idx) => (
          <Text key={`label-${idx}`} style={styles.xLabel}>{label}</Text>
        ))}
      </View>
    </View>
  );
};

const LineGridRow = ({ width, y }) => (
  <Path d={`M0 ${y} H${width}`} stroke="#E2E8F0" strokeWidth={1} />
);

export const ProgressBar = ({ value, max, color = '#0E3C2E' }) => {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.progressBarLabel}>{percent}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  donutCenter: {
    position: 'absolute',
    width: '60%',
    height: '60%',
    left: '20%',
    top: '20%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  legendRow: {
    position: 'absolute',
    top: 8,
    left: 12,
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
  },
  labelRow: {
    position: 'absolute',
    bottom: 4,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  xLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  progressBarContainer: {
    width: '100%',
    marginTop: 8,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressBarLabel: {
    marginTop: 6,
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },
});
