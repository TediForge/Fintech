import React from 'react';
import {
	StyleSheet,
	View,
	type ColorValue,
	type DimensionValue,
	type StyleProp,
	type ViewStyle,
} from 'react-native';

type SkeletonProps = {
	width?: DimensionValue;
	height?: DimensionValue;
	borderRadius?: number;
	circle?: boolean;
	color?: ColorValue;
	style?: StyleProp<ViewStyle>;
};

export const Skeleton = React.memo(function Skeleton({
	width = '100%',
	height = 12,
	borderRadius = 4,
	circle = false,
	color = '#E2E8F0',
	style,
}: SkeletonProps) {
	return (
		<View
			accessible={false}
			style={[
				styles.block,
				{ width, height, borderRadius: circle ? 999 : borderRadius, backgroundColor: color },
				style,
			]}
		/>
	);
});

type SkeletonRowsProps = {
	count?: number;
	trailingValue?: boolean;
	style?: StyleProp<ViewStyle>;
};

export const SkeletonRow = React.memo(function SkeletonRow({
	trailingValue = true,
	style,
}: Omit<SkeletonRowsProps, 'count'>) {
	return (
		<View style={[styles.row, style]}>
			<Skeleton width={40} height={40} circle />
			<View style={styles.textStack}>
				<Skeleton width="55%" height={12} />
				<Skeleton width="75%" height={8} style={styles.secondLine} />
			</View>
			{trailingValue ? <Skeleton width={52} height={14} /> : null}
		</View>
	);
});

export const SkeletonList = React.memo(function SkeletonList({ count = 5, style }: SkeletonRowsProps) {
	return (
		<View style={style}>
			{Array.from({ length: Math.max(0, count) }, (_, index) => (
				<SkeletonRow key={index} />
			))}
		</View>
	);
});

type SkeletonGridProps = {
	count?: number;
	style?: StyleProp<ViewStyle>;
};

export const SkeletonGrid = React.memo(function SkeletonGrid({ count = 4, style }: SkeletonGridProps) {
	return (
		<View style={[styles.grid, style]}>
			{Array.from({ length: Math.max(0, count) }, (_, index) => (
				<View key={index} style={styles.gridItem}>
					<Skeleton height={120} borderRadius={8} />
					<Skeleton width="80%" height={12} style={styles.gridTitle} />
					<Skeleton width="50%" height={10} style={styles.gridSubtitle} />
				</View>
			))}
		</View>
	);
});

const styles = StyleSheet.create({
	block: {
		flexShrink: 0,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 14,
	},
	textStack: {
		flex: 1,
		marginHorizontal: 12,
	},
	secondLine: {
		marginTop: 6,
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
	},
	gridItem: {
		width: '48%',
		marginBottom: 16,
	},
	gridTitle: {
		marginTop: 12,
	},
	gridSubtitle: {
		marginTop: 8,
	},
});
