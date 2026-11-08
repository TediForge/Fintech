import React from 'react';
import { useNavigation } from '@react-navigation/native';
import FeatureCardGrid from '@components/extra/FeatureCardGrid';

const financeOptions = [
  {
    title: 'SmartWealth',
    desc: 'Save daily, weekly, monthly toward goals',
    route: 'SmartWealthScreen',
    icon: 'trending-up-outline',
  },
  {
    title: 'SmartLock',
    desc: 'Your set daily, weekly locked savings plan',
    route: 'SmartLockScreen',
    icon: 'lock-closed-outline',
  },
  {
    title: 'Spend & Save',
    desc: 'Spend and save toward your goals',
    route: 'SpendSaveScreen',
    icon: 'people-outline',
  },
];

const SmartSavingsOptions = () => {
  const navigation = useNavigation();

  return (
    <FeatureCardGrid
      items={financeOptions}
      onPress={(option) => navigation.navigate(option.route)}
      delayMs={0}
    />
  );
};

export default SmartSavingsOptions;