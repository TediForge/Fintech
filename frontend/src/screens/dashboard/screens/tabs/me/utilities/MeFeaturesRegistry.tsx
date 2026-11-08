import {
  Bug,
  Headset,
  Lightbulb,
  Newspaper,
  Phone,
  ShieldCheck,
  Star,
  UsersRound,
} from 'lucide-react-native';

const meFeatureRegistry = [
  {
    section: 'Financial Tools',
    data: [
      {
        title: 'USSD Service',
        route: 'UssdServiceScree',
        description: 'Access account without internet',
        isActive: true,
        iconTop: Phone,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
      },
    ],
  },
  {
    section: 'Help & Support',
    data: [
      {
        title: 'Customer Service',
        route: 'CustomerService',
        description: 'Get help with account issues',
        isActive: true,
        iconTop: Headset,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
      },
    ],
  },
  {
    section: 'Earn & Rewards',
    data: [
      {
        title: 'Invite Friends & Earn',
        route: 'RefererScreen',
        description: 'Earn rewards from your invites',
        isActive: true,
        iconTop: UsersRound,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
      },
    ],
  },
  {
    section: 'Feedback',
    data: [
      {
        title: 'Suggest a Feature',
        route: 'SuggestFeatureScreen',
        description: 'Provide ideas for new features',
        isActive: true,
        iconTop: Lightbulb,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
      },
      {
        title: 'Report a Bug',
        route: 'ReportBugScreen',
        description: 'Let us know about technical issues',
        isActive: false,
        iconTop: Bug,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
      },
      {
        title: 'Rate Our Platform',
        route: 'RATE_ACTION',
        description: 'Share your thoughts with us',
        isActive: true,
        link: '/v1/feedback/rate/index.php',
        iconTop: Star,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
      },
    ],
  },
  {
    section: 'Explore More',
    data: [
      {
        title: 'News & Updates',
        route: 'NewsUpdatesScreen',
        description: 'View latest updates and news',
        isActive: false,
        iconTop: Newspaper,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
      },
      {
        title: 'System & Compliance',
        route: 'SystemOverviewScreen',
        description: 'Check features and legal info',
        isActive: true,
        iconTop: ShieldCheck,
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
      },
    ],
  },
];

export default meFeatureRegistry;
