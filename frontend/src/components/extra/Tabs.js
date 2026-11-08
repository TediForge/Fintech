import React, { useRef, useState, useEffect } from 'react';
import { 
  View, 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ScrollView, 
  LayoutAnimation, 
  Platform, 
  UIManager 
} from 'react-native';
import { useTheme } from '@providers/ThemeProvider';

// Enable LayoutAnimation on Android to ensure the "sweet" transition works on both platforms
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- STATIC PLACEHOLDER COMPONENTS ---

const StaticTabMock = ({ color }) => (
  <View style={[styles.tab, styles.skeletonTab]}>
    <View style={[styles.skeletonTextLine, { backgroundColor: color }]} />
  </View>
);

const TabsSkeleton = React.memo(({ tabCount, color }) => {
  const displayCount = tabCount > 0 ? tabCount : 2; 
  const dummyData = Array.from({ length: displayCount }, (_, i) => i);

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      scrollEnabled={false}
    >
      {dummyData.map((id) => (
        <StaticTabMock key={`tab_placeholder_${id}`} color={color} />
      ))}
    </ScrollView>
  );
});

// --- MAIN TABS COMPONENT ---

const Tabs = ({ tabs = [], activeTab, onTabChange, loading = false }) => {
  const scrollViewRef = useRef(null);
  const { colors, isDark } = useTheme();
  
  // Overlay palette (matches SearchBar approach) so the component
  // reads as 'lifted' on any parent background instead of forcing
  // a solid color that may clash with its container.
  const lightOverlay = {
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'rgba(0, 0, 0, 0.08)',
  };

  const darkOverlay = {
    background: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.12)',
  };

  const palette = isDark ? darkOverlay : lightOverlay;
  
  const [containerWidth, setContainerWidth] = useState(0);
  const [tabLayouts, setTabLayouts] = useState({});

  useEffect(() => {
    if (scrollViewRef.current && tabLayouts[activeTab] && containerWidth > 0) {
      const layout = tabLayouts[activeTab];
      
      const scrollToX = layout.x - (containerWidth / 2) + (layout.width / 2);
      
      scrollViewRef.current.scrollTo({
        x: Math.max(0, scrollToX), 
        animated: true, // Ensures the automatic scroll to center is buttery smooth
      });
    }
  }, [activeTab, tabLayouts, containerWidth]);

  const handleTabLayout = (event, tabValue) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts(prev => ({
      ...prev,
      [tabValue]: { x, width }
    }));
  };

  // Intercept the tab press to inject the sweet native animation
  const handleTabPress = (tabValue) => {
    if (activeTab !== tabValue) {
      // This configures the next render cycle to animate any layout/style changes natively
      LayoutAnimation.configureNext(
        LayoutAnimation.create(
          250, // Animation duration in milliseconds
          LayoutAnimation.Types.easeInEaseOut,
          LayoutAnimation.Properties.opacity
        )
      );
      onTabChange(tabValue);
    }
  };

  const renderItemContent = (item, index) => {
    const tabLabel = typeof item === 'string' ? item : item?.label;
    const tabValue = typeof item === 'string' ? item : item?.value;
    
    const isActive = activeTab === tabValue;

    const activeBg = colors.accentSoft || (isDark ? 'rgba(123,210,182,0.14)' : 'rgba(14,60,46,0.08)');
    const activeTextColor = isDark ? colors.card : colors.accent;

    return (
      <TouchableOpacity
        key={`${tabValue}-${index}`}
        style={[styles.tab, isActive && { backgroundColor: activeBg }]}
        onPress={() => handleTabPress(tabValue)}
        activeOpacity={0.7}
        onLayout={(event) => handleTabLayout(event, tabValue)}
      >
        <Text style={[
          styles.tabText,
          { color: isActive ? activeTextColor : colors.textSecondary },
        ]}>
          {tabLabel}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.tabSection}> 
      <View 
        style={[styles.tabContainer, { backgroundColor: palette.background }]}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {loading ? (
          <TabsSkeleton tabCount={tabs.length} color={colors.border} />
        ) : (
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={true}
            overScrollMode="never"
            decelerationRate="fast"
            scrollEventThrottle={16}
          >
            {tabs.map((item, index) => renderItemContent(item, index))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabSection: {
    marginBottom: 15,
  },
  tabContainer: {
    borderRadius: 14, 
    padding: 4,
    minHeight: 50, 
    overflow: 'hidden', 
  },
  scrollContent: {
    flexGrow: 1, 
    minWidth: '100%', 
  },
  tab: {
    flexGrow: 1, 
    paddingVertical: 12,
    paddingHorizontal: 20, 
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  activeTab: {
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
  },
  activeTabText: {
  },
  skeletonTab: {
    minWidth: 100, 
  },
  skeletonTextLine: {
    width: 60, 
    height: 12,
    
    borderRadius: 4,
  }
});

export default Tabs;

/* USAGE EXAMPLE:

  import Tabs from '@components/extra/Tabs';

  const TABS = [
    { label: 'Top Spenders', value: 'top' },
    { label: 'Personal Rank', value: 'personal' },
  ];

  <Tabs 
    tabs={TABS} 
    activeTab={activeTab} 
    onTabChange={setActiveTab} 
    loading={loading} 
  />
*/