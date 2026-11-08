import config from '@config/app';
import { brandConfig } from '@config/brand';
// Copyright (c) 2026 Tediwave, all rights reserved, subject to the proprietary license located in the root directory
// giftCardConfig.tsx

// 1. Custom Flag Overrides
export const CUSTOM_FLAGS = {
  "NG": "https://cdn-icons-png.flaticon.com/128/9993/9993892.png",
  "US": "https://cdn-icons-png.flaticon.com/128/197/197484.png",
  "GB": "https://cdn-icons-png.flaticon.com/128/197/197374.png",
  "AF": "https://cdn-icons-png.flaticon.com/128/11849/11849758.png",
  "AE": "https://cdn-icons-png.flaticon.com/128/197/197569.png",
  "UY": "https://cdn-icons-png.flaticon.com/128/197/197599.png",
  "AL": "https://cdn-icons-png.flaticon.com/128/13980/13980238.png",
  "DZ": "https://cdn-icons-png.flaticon.com/128/197/197511.png",
  "AS": "https://cdn-icons-png.flaticon.com/128/7826/7826192.png",
  "AI": "https://cdn-icons-png.flaticon.com/128/11849/11849432.png",
  "AO": "https://cdn-icons-png.flaticon.com/128/9906/9906441.png",
  "AR": "https://cdn-icons-png.flaticon.com/128/12360/12360151.png",
  "AG": "https://cdn-icons-png.flaticon.com/128/197/197533.png",
  "AM": "https://cdn-icons-png.flaticon.com/128/16021/16021890.png",
  "AW": "https://cdn-icons-png.flaticon.com/128/7826/7826263.png",
  "BS": "https://cdn-icons-png.flaticon.com/128/197/197442.png",
  "BH": "https://cdn-icons-png.flaticon.com/128/11849/11849478.png",
  "BD": "https://cdn-icons-png.flaticon.com/128/7826/7826304.png",
  "BB": "https://cdn-icons-png.flaticon.com/128/16021/16021926.png",
  "BZ": "https://cdn-icons-png.flaticon.com/128/11848/11848382.png",
  "BJ": "https://cdn-icons-png.flaticon.com/128/197/197539.png",
  "BM": "https://cdn-icons-png.flaticon.com/128/16184/16184195.png",
  "BO": "", "BW": "", "BR": "", "VG": "", "BF": "", "BI": "", "KH": "", "CM": "", "CA": "", 
  "CV": "", "KY": "", "CF": "", "CL": "", "CN": "", "CO": "", "CG": "", "CR": "", "CI": "", 
  "CU": "", "CY": "", "DM": "", "DO": "", "EC": "", "EG": "", "SV": "", "ET": "", "FJ": "", 
  "FR": "", "GM": "", "GE": "", "DE": "", "GH": "", "GD": "", "GT": "", "GN": "", "GW": "", 
  "GY": "", "HT": "", "HN": "", "IN": "", "ID": "", "IQ": "", "IT": "", "JM": "", "JO": "", 
  "KZ": "", "KE": "", "KW": "", "KG": "", "LA": "", "LB": "", "LR": "", "MK": "", "MG": "", 
  "MW": "", "MY": "", "ML": "", "MQ": "", "MX": "", "MD": "", "MA": "", "MZ": "", "MM": "", 
  "NA": "", "NR": "", "NP": "", "NL": "", "AN": "", "NI": "", "NE": "", "OM": "", "PK": "", 
  "PS": "", "PA": "", "PG": "", "PY": "", "PE": "", "PH": "", "PL": "", "PT": "", "PR": "", 
  "QA": "", "RO": "", "RU": "", "RW": "", "KN": "", "LC": "", "VC": "", "WS": "", "SA": "", 
  "SN": "", "SL": "", "SG": "", "ZA": "", "ES": "", "LK": "", "SR": "", "SZ": "", "TJ": "", 
  "TZ": "", "TH": "", "CD": "", "TG": "", "TO": "", "TT": "", "TN": "", "TR": "", "TC": "", 
  "UG": "", "UA": "", "UZ": "", "VU": "", "VN": "", "YE": "", "ZM": "", "ZW": "", "VE": "", 
  "GR": "", "SO": "", "BY": "", "KM": "", "MR": "", "BE": "", "MS": "", "KR": "", "IE": "", 
  "FI": "", "AU": "", "AT": "", "JP": "", "HK": "", "TW": "", "SE": "", "BG": "", "CZ": "", 
  "CH": "", "DK": "", "HU": "", "HR": "", "LT": "", "LU": "", "NO": "", "NZ": "", "SI": "", 
  "SK": "", "LV": "", "EE": ""
};

// 2. Priority Countries List
export const PRIORITY_COUNTRIES = ["NG", "US", "GB"];

// 3. Initial Gift Card Options
export const GIFTCARD_OPTIONS = [
  { id: 'sell', title: 'Sell Gift Cards', desc: 'Trade your gift cards for cash', icon: 'https://cdn-icons-png.flaticon.com/128/3916/3916657.png', bg: '#FFF3E0', isActive: true },
  { id: 'buy', title: 'Buy Gift Cards', desc: 'Purchase a new gift card', icon: 'https://cdn-icons-png.flaticon.com/128/16069/16069640.png', bg: '#E8F5E9', isActive: true },
  { id: 'paysmart', title: `${brandConfig.brandName}3782`, desc: 'Buy and redeem brand credits', icon: 'https://cdn-icons-png.flaticon.com/128/3997/3997852.png', bg: '#E3F2FD', isActive: true }
];

// 4. Gift Code Sub-Options
export const GIFTCODE_OPTIONS = [
  { id: 'buy', title: 'Buy Gift Code', desc: 'Purchase a Tediwave gift code', icon: 'https://cdn-icons-png.flaticon.com/128/16069/16069640.png', bg: '#E3F2FD', isActive: true },
  { id: 'redeem', title: 'Redeem Gift Code', desc: 'Use and redeem your gift code', icon: 'https://cdn-icons-png.flaticon.com/128/3997/3997852.png', bg: '#F3E5F5', isActive: true },
  { id: 'balance', title: 'Check Balance', desc: 'Show gift code current balance', icon: 'https://cdn-icons-png.flaticon.com/128/3997/3997852.png', bg: '#E8F5E9', isActive: false },
  { id: 'history', title: 'Gift Code History', desc: 'View your gift code transactions', icon: 'https://cdn-icons-png.flaticon.com/128/6785/6785394.png', bg: '#FFF3E0', isActive: true },
];
