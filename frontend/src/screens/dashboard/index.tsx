import { Alert } from '@components/common/Alert';
import React, { useState, useEffect } from 'react';
import {
  View,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import HomeScreen from './screens/tabs/home/HomeScreen';
import FinanceScreen from './screens/tabs/finance/FinanceScreen';
import EarnScreen from './screens/tabs/earn/EarnScreen';
import CardsScreen from './screens/tabs/cards/CardsScreen';
import MeScreen from './screens/tabs/me/MeScreen';

// Components
import TabNavigator from './screens/tabs/utilities/Tabs';  
import AuthSheetHost from '@hooks/useAuth';
import Browser from '@components/common/Browser';

const containerColors = {
  primary: '#022c22',
  background: '#ffffff',
};

const implementedScreens = ['Home', 'Finance', 'Reward', 'Cards', 'More'];

const tabAliases = {
  home: 'Home',
  finance: 'Finance',
  reward: 'Reward',
  earn: 'Reward',
  cards: 'Cards',
  virtualcard: 'Cards',
  more: 'More',
};

const getRequestedTab = (params) => {
  const requestedTab = params?.tab || params?.screen;
  return tabAliases[String(requestedTab || '').toLowerCase()] || requestedTab;
};

export default function Index({ route, navigation }) {
  const initialTab = getRequestedTab(route?.params);
  const [activeTab, setActiveTab] = useState(
    implementedScreens.includes(initialTab) ? initialTab : 'Home'
  );
  const [centerOverlayOpen, setCenterOverlayOpen] = useState(false);
  const [browserDetails, setBrowserDetails] = useState(null);
  const insets = useSafeAreaInsets();

  const handleTabChange = (targetKey) => {
    setCenterOverlayOpen(false);
    if (targetKey === activeTab) return;

    const isFound = implementedScreens.includes(targetKey);

    if (isFound) {
      setActiveTab(targetKey);
    } else {
      Alert.sheet(
        "Feature Unavailable",
        "This option is undergoing maintenance now",
        [{ text: "Understood" }]
      );
    }
  };

  useEffect(() => {
    const targetTab = getRequestedTab(route?.params);
    if (targetTab) {
      handleTabChange(targetTab);
      navigation.setParams({ tab: undefined, screen: undefined });
    }
  }, [route?.params?.tab, route?.params?.screen]);

  useEffect(() => {
    if (route?.params?.browserUrl) {
      setBrowserDetails({
        url: route.params.browserUrl,
        title: route.params.browserTitle,
      });
      navigation.setParams({ browserUrl: undefined, browserTitle: undefined });
    }
  }, [route?.params?.browserUrl, route?.params?.browserTitle, navigation]);

  const screenProps = { renderTab: handleTabChange };

  // Pure binary conditional tree rendering: instantly drops previous screen structure
  const renderActiveViewport = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeScreen {...screenProps} />;
      case 'Finance':
        return <FinanceScreen {...screenProps} />;
      case 'Reward':
        return <EarnScreen {...screenProps} />;
      case 'Cards':
        return <CardsScreen {...screenProps} />;
      case 'More':
        return <MeScreen {...screenProps} />;
      default:
        return <HomeScreen {...screenProps} />;
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={containerColors.background} />

      <View style={styles.root}>
        <View style={styles.container}>
          {renderActiveViewport()}
        </View>

        {centerOverlayOpen && (
          <View style={styles.screenBlocker} pointerEvents="auto" />
        )}

        <TabNavigator
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onCenterPress={() => setCenterOverlayOpen((isOpen) => !isOpen)}
          centerActionOpen={centerOverlayOpen}
          bottomInset={insets.bottom}
        />
        <AuthSheetHost />
        {browserDetails && (
          <Browser
            visible
            url={browserDetails.url}
            title={browserDetails.title}
            onClose={() => setBrowserDetails(null)}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: containerColors.background,
  },
  container: {
    flex: 1,
    backgroundColor: containerColors.background,
  },
  screenBlocker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
});