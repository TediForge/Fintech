import { Alert } from '@components/common/Alert';
import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from "../screens/SplashScreen";
import LoginSheet from "@auth/login/LoginSheet";
import SignupSheet from "@auth/signup/SignupSheet";
import ForgotScreen from "@auth/recovery/ForgotScreen";
import Dashboard from "../screens/dashboard/index";
import RefererScreen from '../screens/dashboard/screens/referrals/RefererScreen';
import AddMoneyScreen from '../screens/dashboard/screens/deposit';
import TransactionHistoryScreen from '../screens/dashboard/screens/transactions/history/TransactionHistoryScreen';
import TransactionDetailsScreen from '../screens/dashboard/screens/transactions/details/TransactionDetailsScreen';
import DebitTransactionResultScreen from '../screens/dashboard/screens/transactions/result/DebitTransactionResultScreen';
import CreditTransactionResultScreen from '../screens/dashboard/screens/transactions/result/CreditTransactionResultScreen';
import { AllService } from '../screens/dashboard/screens/tabs/home/screens/services';
import PayAMerchant from '../screens/dashboard/screens/PayAMerchant';
import Settings from '../screens/dashboard/screens/settings';
import NotificationScreen from '../screens/dashboard/screens/notifications/NotificationScreen';
import CardDeposit from '../screens/dashboard/screens/deposit/card';
import ProfilePhotoUploadScreen from '../screens/dashboard/screens/profile/screens/profilePhotoUpload';
import UssdDeposit from '../screens/dashboard/screens/deposit/ussd/ussdDeposit';
import CodeEnquiryPage from '../screens/dashboard/screens/CodeEnquiryPage';
import QrDeposit from '../screens/dashboard/screens/deposit/qr/qrDeposit';
import TransferScreen from '../screens/dashboard/screens/transfer/TransferScreen';
import SuggestFeatureScreen from '../screens/dashboard/screens/feedback/suggest';
import ReportBugScreen from '../screens/dashboard/screens/feedback/reportBug';
import UssdServiceScreen from '../screens/dashboard/screens/tabs/me/screens/ussdService/ussdService';
import Leaderboard from '../screens/dashboard/screens/leaderboard/Leaderboard';
import AccountStatementScreen from '../screens/dashboard/screens/transactions/statements/AccountStatementScreen';
import NetworkRatePage from '../screens/dashboard/screens/NetworkRatePage';
import GiftCardBuyScreen from '../screens/dashboard/screens/giftCards/buy/GiftCardBuyScreen';
import AccountLimitsScreen from '../screens/dashboard/screens/profile/screens/accountLimits';
import ReferralDetailList from '../screens/dashboard/screens/referrals/ReferralDetailList';
import GiftCardBuyDetails from '../screens/dashboard/screens/giftCards/buy/utilities/GiftCardBuyDetails';
import AllBeneficiariesSheet from '../screens/dashboard/screens/transfer/beneficiaries/AllBeneficiariesSheet';
import DeviceManagementScreen from '../screens/dashboard/screens/profile/screens/deviceManagement';
import SellGiftCard from '../screens/dashboard/screens/giftCards/sell/SellGiftCard';
import SystemOverviewScreen from '../screens/dashboard/screens/systemOverview';
import ScannerSheet from '@components/common/Scanner';
import FaceVerificationScreen from '@auth/verification/face/FaceVerificationScreen';
import { getDepositScreens } from '../screens/dashboard/screens/deposit/navigate/depositNavigate';
import { getHelpScreens } from '../screens/dashboard/screens/help/navigate/helpNavigate';
import { getSettingsScreens } from '../screens/dashboard/screens/settings/navigate/settingsNavigate';
import { getProfileScreens } from '../screens/dashboard/screens/profile/navigate/profileNavigate';
import { getEarnScreens } from '../screens/dashboard/screens/tabs/earn/navigate/earnNavigate';
import { getMeScreens } from '../screens/dashboard/screens/tabs/me/navigate/meNavigate';
import { getKycScreens } from '../screens/dashboard/screens/kyc/navigate/kycNavigate';
import { getFinanceScreens } from '../screens/dashboard/screens/tabs/finance/navigate/financeNavigate';
import { getWalletScreens } from '../screens/dashboard/screens/wallet/navigate/walletNavigate';
import { getBillsScreens } from '../screens/dashboard/screens/bills/navigate/billsNavigate';

const Stack = createNativeStackNavigator();

// 1. Create a Global Navigation Helper
export const navigationRef = React.createRef();

/**
 * Call this function instead of navigation.navigate for "ghost" routes,
 * or use the listener approach below.
 */
export function navigateSafely(name, params) {
  if (navigationRef.current?.isReady()) {
    const rootState = navigationRef.current.getRootState();
    // Logic to check if route exists in any nested navigator
    const allRouteNames = getAllRouteNames(rootState);

    if (allRouteNames.includes(name)) {
      navigationRef.current.navigate(name, params);
    } else {
      Alert.sheet("Oops", "This feature is currently under development and will be available soon");
    }
  }
}

const AppStack = () => {
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }} 
      initialRouteName="Splash"
    >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="JoinIn" component={LoginSheet} />
        <Stack.Screen name="JoinUs" component={SignupSheet} />
        <Stack.Screen name="Forgot" component={ForgotScreen} />
        <Stack.Screen name="Dashboard" component={Dashboard} />
        
        <>
          <Stack.Screen name="RefererScreen" component={RefererScreen} />
          <Stack.Screen name="AddMoneyScreen" component={AddMoneyScreen} />
          {getDepositScreens(Stack)}
          {getBillsScreens(Stack)}
          <Stack.Screen name="TransactionDetailsScreen" component={TransactionDetailsScreen} />
          <Stack.Screen name="TransactionHistoryScreen" component={TransactionHistoryScreen} />
          <Stack.Screen name="DebitTransactionResultScreen" component={DebitTransactionResultScreen} />
          <Stack.Screen name="CreditTransactionResultScreen" component={CreditTransactionResultScreen} />
          <Stack.Screen name="AllService" component={AllService} />
          <Stack.Screen name="PayAMerchant" component={PayAMerchant} />
          <Stack.Screen name="Settings" component={Settings} />
          <Stack.Screen name="cardDeposit" component={CardDeposit} />
          <Stack.Screen name="NotificationScreen" component={NotificationScreen} />
          <Stack.Screen name="ussdDeposit" component={UssdDeposit} />
          <Stack.Screen name="CodeEnquiryPage" component={CodeEnquiryPage} />
          <Stack.Screen name="qrDeposit" component={QrDeposit} />
          <Stack.Screen name="TransferScreen" component={TransferScreen} />
          <Stack.Screen name="SuggestFeatureScreen" component={SuggestFeatureScreen} />
          <Stack.Screen name="ReportBugScreen" component={ReportBugScreen} />
          <Stack.Screen name="UssdServiceScreen" component={UssdServiceScreen} />
          <Stack.Screen name="Leaderboard" component={Leaderboard} />
          <Stack.Screen name="AccountStatementScreen" component={AccountStatementScreen} />
          <Stack.Screen name="NetworkRatePage" component={NetworkRatePage} />
          <Stack.Screen name="GiftCardBuyScreen" component={GiftCardBuyScreen} />
          <Stack.Screen name="AccountLimitsScreen" component={AccountLimitsScreen} />
          <Stack.Screen name="ReferralDetailList" component={ReferralDetailList} />
          <Stack.Screen name="GiftCardBuyDetails" component={GiftCardBuyDetails} />
          <Stack.Screen name="AllBeneficiariesSheet" component={AllBeneficiariesSheet} />
          <Stack.Screen name="DeviceManagementScreen" component={DeviceManagementScreen} />
          <Stack.Screen name="SellGiftCard" component={SellGiftCard} />
          <Stack.Screen name="SystemOverviewScreen" component={SystemOverviewScreen} />
          <Stack.Screen name="ScannerSheet" component={ScannerSheet} />
          <Stack.Screen name="ProfilePhotoUpload" component={ProfilePhotoUploadScreen} />
          <Stack.Screen name="FaceVerificationScreen" component={FaceVerificationScreen} />
          {getHelpScreens(Stack)}
          {getProfileScreens(Stack)}
          {getSettingsScreens(Stack)}
          {getEarnScreens(Stack)}
          {getMeScreens(Stack)}
          {getKycScreens(Stack)}
          {getFinanceScreens(Stack)}
          {getWalletScreens(Stack)}
        </>
    </Stack.Navigator>
  );
};

export default AppStack;