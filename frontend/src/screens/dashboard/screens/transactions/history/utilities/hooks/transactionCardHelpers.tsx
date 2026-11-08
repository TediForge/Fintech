import {
  ArrowLeftRight,
  Gift,
  Receipt,
  Smartphone,
  Ticket,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

export const getStatusColors = (status) => {
  switch (status?.toLowerCase()) {
    case 'successful':
    case 'success':
    case 'completed':
      return { textColor: '#2FB86D', bgColor: 'rgba(47,184,109,0.15)' };
    case 'reversed':
    case 'refunded':
      return { textColor: '#007BFF', bgColor: 'rgba(0,123,255,0.15)' };
    case 'processing':
    case 'pending':
      return { textColor: '#F0AD4E', bgColor: 'rgba(240,173,78,0.15)' };
    case 'failed':
    case 'declined':
      return { textColor: '#D9534F', bgColor: 'rgba(217,83,79,0.15)' };
    default:
      return { textColor: '#F0AD4E', bgColor: 'rgba(240,173,78,0.15)' };
  }
};

export const getIcon = (transactionType: string | null | undefined): LucideIcon => {
  const type = (transactionType || 'transaction').toLowerCase();
  if (type.includes('airtime')) return Smartphone;
  if (type.includes('bonus')) return Gift;
  if (type.includes('betting')) return Ticket;
  if (type.includes('data') || type.includes('bundle')) return Wifi;
  if (type.includes('electricity')) return Zap;
  if (type.includes('transfer') || type.includes('deposit') || type.includes('topup')) return ArrowLeftRight;
  return Receipt;
};