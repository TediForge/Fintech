import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import FeatureCardGrid from '@components/extra/FeatureCardGrid';

export default function FintechDashboardMenu({ transaction, reference }) {
  const navigation = useNavigation();

  const handleViewReceipt = () => {
    navigation.navigate("TransactionDetailsScreen", { transactionReference: reference });
  };

  const handleMenuAction = (action) => {
    if (action === 'viewReceipt') {
      handleViewReceipt();
      return;
    }

    console.log(`Action triggered: ${action}`, { transaction, reference });
  };

  const menuActions = [
    {
      id: 'viewReceipt',
      title: 'View Receipt',
      desc: 'See the full details of this transaction',
      icon: 'receipt-outline',
    },
    {
      id: 'shareReceipt',
      title: 'Share Receipt',
      desc: 'Send this transaction receipt to others',
      icon: 'share-social-outline',
    },
    {
      id: 'saveReceipt',
      title: 'Save Receipt',
      desc: 'Keep a copy of this transaction receipt',
      icon: 'download-outline',
    },
  ];

  return (
    <View style={styles.mainContainer}>
      <FeatureCardGrid items={menuActions} onPress={(menuAction) => handleMenuAction(menuAction.id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    width: '100%',
    marginVertical: 10,
  },
});