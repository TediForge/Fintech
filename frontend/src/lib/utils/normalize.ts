import { Dimensions, PixelRatio, Platform } from 'react-native';

const BASE_WIDTH = 414;

export function normalize(size: number): number {
    const { width } = Dimensions.get('window');
    const scaledSize = size * (width / BASE_WIDTH);
    const roundedSize = Math.round(PixelRatio.roundToNearestPixel(scaledSize));
    return Platform.OS === 'ios' ? roundedSize : roundedSize - 2;
}