import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import UnifiedServiceSection from '@components/extra/UnifiedServiceSection';
import { useTheme } from '@providers/ThemeProvider';
import PinSetup from '@auth/verification/pin/pinSetup';
import PinReset from '@auth/verification/pin/pinReset';
import PinUpdate from '@auth/verification/pin/pinUpdate';

const pinManagementOptions = [
  {
    id: 'setup-pin',
    title: 'Setup',
    subtitle: 'Create your transaction pin',
    icon: 'key-outline',
  },
  {
    id: 'reset-pin',
    title: 'Reset',
    subtitle: 'Reset your transaction pin',
    icon: 'refresh-outline',
  },
  {
    id: 'update-pin',
    title: 'Update',
    subtitle: 'Update your transaction pin',
    icon: 'create-outline',
  },
];

const PinManagementScreen = () => {
  const { isDark, colors } = useTheme();
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showPinReset, setShowPinReset] = useState(false);
  const [showPinUpdate, setShowPinUpdate] = useState(false);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? [colors.background, colors.background] : [colors.surface, colors.background]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          title="PIN Management"
          backgroundColor={colors.surface}
          textColor={colors.textPrimary}
          iconColor={colors.textPrimary}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <UnifiedServiceSection
            title="PIN Settings"
            items={pinManagementOptions}
            rowMode="chevron"
            marginVertical={0}
            onItemPress={(item) => {
              if (item.id === 'setup-pin') setShowPinSetup(true);
              if (item.id === 'reset-pin') setShowPinReset(true);
              if (item.id === 'update-pin') setShowPinUpdate(true);
            }}
          />
        </ScrollView>
        <PinSetup visible={showPinSetup} onClose={() => setShowPinSetup(false)} />
        <PinReset visible={showPinReset} onClose={() => setShowPinReset(false)} />
        <PinUpdate visible={showPinUpdate} onClose={() => setShowPinUpdate(false)} />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  description: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});

export default PinManagementScreen;
