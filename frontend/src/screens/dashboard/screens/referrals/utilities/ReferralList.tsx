import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

const ReferralList = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No referrals yet. Invite your friends!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Referred Users</Text>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.name}>{item.firstName}</Text>
            <Text style={styles.status}>{item.status || 'Pending'}</Text>
          </View>
        )}
      />
    </View>
  );
};

export default ReferralList;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    marginBottom: 20,
  },
  heading: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0c5b3f',
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  name: {
    fontSize: 13,
    color: '#333',
  },
  status: {
    fontSize: 13,
    color: '#888',
  },
  empty: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 13,
    color: '#777',
  },
});
