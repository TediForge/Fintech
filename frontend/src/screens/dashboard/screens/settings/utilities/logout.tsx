import { Alert } from '@components/common/Alert';
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { confirmLogout } from '@hooks/useAuth';
import { LogOut as LogOutIcon, type LucideIcon } from 'lucide-react-native';

type LogoutFeature = {
  title: string;
  route: string;
  description: string;
  iconTop: LucideIcon;
  iconBottom: { uri: string };
  link?: string;
};

const features: LogoutFeature[] = [
  { 
    title: 'Log Out', 
    route: 'logout', 
    description: 'Logout from your account.', 
    iconTop: LogOutIcon,
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' }, 
  },
];

export default function LogOut() {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  const handleLogout = () => {
    confirmLogout({ navigation });
  };

  const handlePress = (item: LogoutFeature) => {
    if (item.route === 'logout') {
      handleLogout();
    } else if (item.route === 'rate' && item.link) {
      Linking.openURL(item.link).catch((err) =>
        Alert.sheet('Error', 'Unable to open link.')
      );
    } else {
      navigation.replace(item.route);
    }
  };

  const renderItem = ({ item }: { item: LogoutFeature }) => (
    <View style={styles.container}>
    <TouchableOpacity style={styles.itemContainer} onPress={() => handlePress(item)}>
      <Text style={styles.title}>{item.title}</Text>
    </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ marginTop: 10 }}>
        <FlatList<LogoutFeature>
          data={features}
          keyExtractor={(item) => item.title}
          renderItem={renderItem}
        />
      </View>
    
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#d5dddaff',
    borderRadius: 10,
    marginTop: 10,
    alignContent: 'center',
    justifyContent: 'center',
  },
  itemContainer: {
    alignContent: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
  },
  title: {
    fontSize: 14.1,
    fontWeight: '500',
    color: '#0E3C2E',
    textAlign: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
});