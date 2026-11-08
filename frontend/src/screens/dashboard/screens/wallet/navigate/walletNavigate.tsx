import WalletTransferScreen from '../screens/transfer';
import WalletScreen from '../WalletScreen';

export const walletScreens = {
  walletTransfer: WalletTransferScreen,
};

export const getWalletScreens = (Stack) => (
  <>
    <Stack.Screen name="WalletScreen" component={WalletScreen} />
    <Stack.Screen name="walletTransfer" component={WalletTransferScreen} />
  </>
);

export default walletScreens;
