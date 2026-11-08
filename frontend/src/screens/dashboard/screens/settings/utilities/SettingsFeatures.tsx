import React from 'react';
import { View, StyleSheet, type ImageSourcePropType } from 'react-native';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useTheme } from '@providers/ThemeProvider';
import { FeatureRow, SectionShell } from '@components/extra/FeatureSection';
import { getSettingAuthPolicy } from './settingAuthConfig';
import type { LucideIcon } from 'lucide-react-native';
import {
  Bell,
  BellRing,
  BookOpen,
  CreditCard,
  Download,
  EyeOff,
  Fingerprint,
  Gauge,
  Gift,
  Globe,
  Hash,
  History,
  Key,
  KeyRound,
  LogOut,
  MessageCircle,
  Moon,
  PiggyBank,
  Repeat,
  ShieldCheck,
  Smartphone,
  User,
  UserX,
  Wifi,
  CircleAlert,
} from 'lucide-react-native';

type SettingsPage = 'system' | 'account' | 'reusable';

type SettingsFeature = {
  title: string;
  description?: string;
  route?: string;
  routeParams?: object;
  iconTop?: LucideIcon;
  iconBottom?: ImageSourcePropType;
  isSwitch?: boolean;
  isTheme?: boolean;
  isActive?: boolean;
  isLogout?: boolean;
  authRequired?: boolean;
  authMethod?: string;
  confirmRequired?: boolean;
  endpoint?: string;
  setting?: string;
  page?: SettingsPage;
  category?: string;
};

type SettingsFeatureSection = {
  section: string;
  page?: SettingsPage;
  category?: string;
  data: SettingsFeature[];
};

type SettingsFeaturesProps = {
  page?: SettingsPage;
  features?: SettingsFeatureSection[];
  switchValues?: Record<string, boolean>;
  onSwitchChange?: (feature: SettingsFeature) => void;
  onProtectedAction?: (feature: SettingsFeature) => void;
  busySettingTitles?: string[];
  disabledSettingTitles?: string[];
};

const systemSettingsFeatureRegistry: SettingsFeatureSection[] = [
  {
    section: 'Access Channels',
    page: 'system',
    data: [
      {
        title: 'Leo (WhatsApp/Telegram)',
        description: 'Buy airtime, data & more via chat',
        iconTop: MessageCircle,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        endpoint: 'leo-switch',
        isActive: false,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
    ],
  },
  {
    section: 'Update Manager',
    page: 'system',
    data: [
      {
        title: 'Auto Download',
        description: 'Download updates in background',
        iconTop: Download,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
      {
        title: 'Notify On Update',
        description: 'Notify when updates are available',
        iconTop: Bell,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
      {
        title: 'Wi‑Fi Only Downloads',
        description: 'Only download updates on Wi‑Fi', 
        iconTop: Wifi,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
    ],
  },
  {
    section: 'Appearance',
    page: 'system',
    data: [
      {
        title: 'Dark Mode',
        description: 'Enjoy a darker color scheme',
        iconTop: Moon,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        isTheme: true,
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
      {
        title: 'Language',
        description: 'Choose your preferred app language',
        route: 'language-settings',
        iconTop: Globe,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: false,
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
    ],
  },
  {
    section: 'Biometric Settings',
    page: 'system',
    data: [
      {
        title: 'Biometrics Login',
        description: 'Login with fingerprint or Face ID',
        iconTop: Fingerprint,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        endpoint: 'biometrics-login',
        isActive: true,
        authRequired: true,
        authMethod: 'pin',
        confirmRequired: true,
      },
      {
        title: 'Pay With Biometric',
        description: 'Approve payments with biometrics',
        iconTop: Fingerprint,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        endpoint: 'biometrics-pay',
        isActive: true,
        authRequired: true,
        authMethod: 'pin',
        confirmRequired: true,
      },
    ],
  },
  {
    section: 'Security Settings',
    page: 'system',
    data: [
      {
        title: 'Multi Factor Authentication',
        description: 'Add extra protection to your account',
        iconTop: ShieldCheck,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        endpoint: 'mfa-access',
        setting: 'mfaAccess',
        isActive: false,
        authRequired: true,
        authMethod: 'pin',
        confirmRequired: true,
      },
    ],
  },
  {
    section: 'Notification Settings',
    page: 'system',
    data: [
      {
        title: 'In-App Notifications',
        description: 'Get alerts inside the app',
        iconTop: Bell,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        endpoint: 'inapp-access',
        setting: 'inAppAccess',
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
      {
        title: 'Push Notifications',
        description: 'Get alerts on your device',
        iconTop: BellRing,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        endpoint: 'push-access',
        setting: 'pushAccess',
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
    ],
  },
  {
    section: 'Device & Privacy',
    page: 'system',
    data: [
      {
        title: 'Hide Balance',
        description: 'Hide balance from your dashboard',
        iconTop: EyeOff,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        endpoint: 'hide-balance',
        isActive: false,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
    ],
  },
  {
    section: 'Session',
    page: 'system',
    data: [
      {
        title: 'Log Out',
        description: 'Log out of your account',
        isLogout: true,
        isActive: true,
      },
    ],
  },
];

const accountSettingsFeatureRegistry: SettingsFeatureSection[] = [
  {
    section: 'Security Settings',
    page: 'account',
    data: [
      {
        title: 'Manage Passcode',
        description: 'Manage your sign-in passcode',
        route: 'change-passcode',
        iconTop: KeyRound,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: false,
        isActive: true,
        authRequired: true,
        authMethod: 'facial',
        confirmRequired: true,
      },
      {
        title: 'PIN Management',
        description: 'Manage or reset your PIN settings',
        route: 'reset-pin',
        iconTop: Key,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: false,
        isActive: true,
        authRequired: true,
        authMethod: 'facial',
        confirmRequired: true,
      },
    ],
  },
  {
    section: 'Account',
    page: 'account',
    data: [
      {
        title: 'Account Limits',
        description: 'View limits for transfers and payments',
        route: 'kycScreen',
        iconTop: Gauge,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: false,
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
      {
        title: 'Profile Photo',
        description: 'Upload or update your profile picture',
        route: 'ProfilePhotoUpload',
        iconTop: User,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: false,
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
    ],
  },
  {
    section: 'Device & Privacy',
    page: 'account',
    data: [
      {
        title: 'Device Management',
        description: 'Review and manage signed-in devices',
        route: 'DeviceManagementScreen',
        iconTop: Smartphone,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: false,
        isActive: true, 
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
      {
        title: 'Close Account',
        description: 'Permanently deactivate your account',
        route: 'AboutScreen',
        iconTop: UserX,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: false,
        isActive: true,
        authRequired: true,
        authMethod: 'facial',
        confirmRequired: true,
      },
    ],
  },
];

const reusableSettingsFeatureRegistry: SettingsFeatureSection[] = [
  {
    section: 'Access Channels',
    category: 'finance',
    page: 'reusable',
    data: [
      {
        title: 'Leo (WhatsApp/Telegram)',
        description: 'Manage your savings via chat',
        iconTop: MessageCircle,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        endpoint: 'leo-finance-switch',
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
    ],
  },
  {
    section: 'Wallet Control',
    category: 'wallet',
    page: 'reusable',
    data: [
      {
        title: 'Online Payments',
        description: 'Enable or disable web transactions',
        iconTop: CreditCard,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        endpoint: 'online-payment-switch',
        isActive: true,
        authRequired: true,
        authMethod: 'pin',
        confirmRequired: true,
      },
      {
        title: 'Recurring Payments',
        description: 'Manage automated subscriptions',
        iconTop: Repeat,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: false,
        route: 'recurring-payments',
        isActive: true,
        authRequired: true,
        authMethod: 'facial',
        confirmRequired: true,
      },
      {
        title: 'Low Balance Alert',
        description: 'Notify me when funds are low',
        iconTop: CircleAlert,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        endpoint: 'low-balance-alert',
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
    ],
  },
  {
    section: 'Savings Settings',
    category: 'finance',
    page: 'reusable',
    data: [
      {
        title: 'Savings Interest',
        description: 'Toggle interest on your savings',
        iconTop: PiggyBank,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        endpoint: 'savings-interest',
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
      {
        title: 'Auto-Save',
        description: 'Automate your savings with ease',
        iconTop: PiggyBank,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: false,
        route: 'reward-history',
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
    ],
  },
  {
    section: 'Access Channels',
    category: 'earn',
    page: 'reusable',
    data: [
      {
        title: 'Leo (WhatsApp/Telegram)',
        description: 'Track your earnings via chat',
        iconTop: MessageCircle,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: true,
        endpoint: 'leo-earn-switch',
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
    ],
  },
  {
    section: 'Earn Access',
    category: 'earn',
    page: 'reusable',
    data: [
      {
        title: 'USSD Rewards',
        description: 'Check & claim rewards via USSD',
        iconTop: Hash,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: false,
        route: 'UssdServiceScreen',
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
    ],
  },
  {
    section: 'Rewards & Coupons',
    category: 'earn',
    page: 'reusable',
    data: [
      {
        title: 'Special Offers',
        description: 'Browse current special offers',
        iconTop: Gift,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: false,
        route: 'SpecialOffersScreen',
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
      {
        title: 'Reward History',
        description: 'View your past earned rewards',
        iconTop: History,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: false,
        route: 'TransactionHistoryScreen',
        routeParams: { category: 'Cashback' },
        isActive: true,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
      {
        title: 'Earning Rules',
        description: 'Understand how you earn rewards',
        iconTop: BookOpen,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        isSwitch: false,
        route: 'earning-rules',
        isActive: false,
        authRequired: false,
        authMethod: 'pin',
        confirmRequired: false,
      },
    ],
  },
];

const settingsFeatureRegistryByPage: Record<SettingsPage, SettingsFeatureSection[]> = {
  system: systemSettingsFeatureRegistry,
  account: accountSettingsFeatureRegistry,
  reusable: reusableSettingsFeatureRegistry,
};

function SettingsFeatures({
  page = 'system',
  features,
  switchValues = {},
  onSwitchChange,
  onProtectedAction,
  busySettingTitles = [],
  disabledSettingTitles = [],
}: SettingsFeaturesProps) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { isDark, toggleTheme } = useTheme();

  const handleActionPress = (item: SettingsFeature) => {
    if (!item.route) return;

    const authPolicy = getSettingAuthPolicy(item);

    if (!authPolicy.authRequired) {
      navigation.navigate(item.route, item.routeParams);
      return;
    }

    if (typeof onProtectedAction === 'function') {
      onProtectedAction(item);
      return;
    }

    navigation.navigate(item.route, item.routeParams);
  };

  const normalizedFeatures = Array.isArray(features)
    ? features
    : settingsFeatureRegistryByPage[page] || [];

  const visibleSections = normalizedFeatures
    .filter((section) => !section.page || section.page === page)
    .map((section) => ({
      ...section,
      data: (section.data || []).filter((item) => (!item.page || item.page === page) && item.isActive !== false && !item.isLogout),
    }))
    .filter((section) => section.data.length > 0);

  return (
    <View>
      {visibleSections.map((section, index) => (
        <View key={`${section.section}-${index}`}>
          <SectionShell title={section.section} isDark={isDark}>
            {section.data.map((item, idx) => (
              <FeatureRow
                key={item.title}
                title={item.title}
                description={item.description}
                iconTop={item.iconTop}
                iconBottom={item.iconBottom}
                isDark={isDark}
                isSwitch={Boolean(item.isSwitch)}
                switchValue={item.isTheme ? isDark : Boolean(switchValues[item.title])}
                onSwitchChange={item.isTheme ? () => toggleTheme() : () => onSwitchChange?.(item)}
                onPress={() => handleActionPress(item)}
                isLast={idx === section.data.length - 1}
                disabled={busySettingTitles.includes(item.title) || disabledSettingTitles.includes(item.title)}
                loading={busySettingTitles.includes(item.title)}
                disabledLabel={disabledSettingTitles.includes(item.title) ? 'Unavailable' : 'Syncing'}
              />
            ))}
          </SectionShell>
        </View>
      ))}
    </View>
  );
}

SettingsFeatures.getRegistry = (page: SettingsPage = 'system') => settingsFeatureRegistryByPage[page];

export default SettingsFeatures;

const styles = StyleSheet.create({});
