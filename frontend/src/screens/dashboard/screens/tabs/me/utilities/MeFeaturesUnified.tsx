import { Alert } from '@components/common/Alert';
import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { useTheme } from '@providers/ThemeProvider';
import { useVisualDelay } from '@hooks/useVisualDelay';
import { FeatureRow, SectionShell, FeatureSkeleton } from '@components/extra/FeatureSection';
import meFeatureRegistry from './MeFeaturesRegistry';
import Browser from '@components/common/Browser';

const api = apiConfig.baseUrl;

export default function MeFeaturesUnified() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  
  // State from FeatureList I, II & III
  const [leaderboardCount, setLeaderboardCount] = useState(0);
  const [contentReady, setContentReady] = useState(false);
  const [browserDetails, setBrowserDetails] = useState(null);
  const showSkeleton = useVisualDelay(contentReady, 260);

  useEffect(() => {
    const timer = setTimeout(() => {
      setContentReady(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkLeaderboardStatus = async () => {
      try {
        const api_url = `${api}/v1/user/transactions/leaderboard.php`;
        const response = await fetch(api_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_top_10' }),
        });
        const json = await response.json();
        if (json.success && Array.isArray(json.data)) {
          setLeaderboardCount(json.data.length);
        }
      } catch (error) {
        console.error('Leaderboard fetch error:', error);
      }
    };
  
    checkLeaderboardStatus();
  }, []);

  const handlePress = (item) => {
    if (item.route === 'RATE_ACTION') {
      setBrowserDetails({
        url: `${apiConfig.baseUrl}/v1/feedback/rate/index.php`,
        title: item.title,
      });
      return;
    }
    if (item.route === 'Leaderboard' && leaderboardCount < 10) {
      Alert.sheet(
        "Gathering Champions",
        "We need 10 champions to show this board",
        [{ text: "Understood" }]
      );
      return;
    }
    if (item.route === 'WebViewScreen') {
      setBrowserDetails({ url: item.link, title: item.title });
    } else {
      navigation.navigate(item.route);
    }
  };

  const visibleSections = React.useMemo(() => {
    return (meFeatureRegistry || []).reduce((acc, section) => {
      const visibleItems = (section.data || []).filter((item) => item && item.isActive !== false);
      if (visibleItems.length) {
        acc.push({ ...section, data: visibleItems });
      }
      return acc;
    }, []);
  }, []);

  if (showSkeleton) {
    return (
      <View>
      <FeatureSkeleton isDark={isDark} />
      </View>
    );
  }

  return (
    <View>
      {visibleSections.map((section) => (
        <SectionShell key={section.section} title={section.section} isDark={isDark}>
          {section.data.map((item, idx) => (
            <FeatureRow
              key={item.title}
              title={item.title}
              description={item.description}
              iconTop={item.iconTop}
              iconBottom={item.iconBottom}
              isDark={isDark}
              isLast={idx === section.data.length - 1}
              onPress={() => handlePress(item)}
            />
          ))}
        </SectionShell>
      ))}
      {browserDetails && (
        <Browser
          visible
          url={browserDetails.url}
          title={browserDetails.title}
          onClose={() => setBrowserDetails(null)}
        />
      )}
    </View>
  );
}

