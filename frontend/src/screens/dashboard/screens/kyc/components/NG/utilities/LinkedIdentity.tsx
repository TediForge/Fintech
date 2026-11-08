import React from 'react';
import { View } from 'react-native';
import { useEffect, useState } from 'react';
import FeatureCardGrid from '@components/extra/FeatureCardGrid';
import { handleProfile } from '../handlers/handleProfile';

const linkedRecords = [
  { key: 'nin', id: 'nin', icon: 'card-outline', title: 'NIN Profile' },
  { key: 'bvn', id: 'bvn', icon: 'wallet-outline', title: 'BVN Profile' },
  { key: 'address', id: 'address', icon: 'location-outline', title: 'Address Profile' },
  { key: 'income', id: 'income', icon: 'cash-outline', title: 'Income Profile' },
  { key: 'merchant', id: 'merchant', icon: 'briefcase-outline', title: 'Merchant Profile' },
];

const getRecordStatus = (record) => {
  if (typeof record === 'string') return record.trim();
  return String(record?.status || record?.verificationStatus || '').trim();
};

const formatStatus = (status) => status.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const LinkedIdentity = ({ containerStyle }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadLinkedIdentities = async () => {
      const profileResult = await handleProfile();

      if (!isMounted) return;
      if (!profileResult?.success) throw new Error(profileResult?.message || 'Unable to load KYC profile');

      const profile = profileResult.data || {};
      const records = linkedRecords.flatMap(({ key, id, icon, title }) => {
        const status = getRecordStatus(profile[key]);
        if (status.toLowerCase() !== 'approved') return [];
        return [{ id, icon, title, desc: formatStatus(status) }];
      });

      setItems(records);
      setLoading(false);
    };

    loadLinkedIdentities().catch(() => {
      if (isMounted) {
        setItems([]);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <View style={containerStyle}>
      <FeatureCardGrid
        items={items}
        navigationEnabled={false}
        isLoading={loading}
        delayMs={350}
      />
    </View>
  );
};

export default LinkedIdentity;
