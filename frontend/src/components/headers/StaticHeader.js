import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@providers/ThemeProvider';

export default function StaticHeader({ 
  title, 
  onRightIconPress, 
  rightIconUri,
  textColor,
  iconColor 
}) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();

  const finalTextColor = textColor || colors.textPrimary;
  const finalIconColor = iconColor || colors.textSecondary;

  return (
    <View 
      style={[
        styles.headerContainer, 
        { 
          paddingTop: insets.top + (Platform.OS === 'ios' ? 12 : 14) 
        }
      ]}
    >
      <Text style={[styles.title, { color: finalTextColor }]}>{title}</Text>
      {onRightIconPress && rightIconUri && (
        <TouchableOpacity onPress={onRightIconPress}>
          <Image
            source={{ uri: rightIconUri }}
            style={[styles.headerIcon, finalIconColor && { tintColor: finalIconColor }]}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 15,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0E3C2E',
  },
  headerIcon: {
    width: 22,
    height: 22, 
    resizeMode: 'contain',
  },
});

/* USAGE EXAMPLE:

  import StaticHeader from '@components/headers/StaticHeader';

  <StaticHeader 
    title="Finance"
    onRightIconPress={() => navigation.navigate('Settings', { page: 'system' })}
    rightIconUri="https://cdn-icons-png.flaticon.com/128/16327/16327901.png"
  />
*/