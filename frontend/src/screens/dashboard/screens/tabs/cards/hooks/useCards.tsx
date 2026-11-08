import { useMemo } from 'react';

const cardCatalogMock = {
  cards: [
    {
      id: 'virtual',
      type: 'virtual',
      name: 'Virtual Card',
      cardVariants: [
        {
          id: 'virtualClassic',
          name: 'Classic Blue',
          cardBrand: 'Verve',
          cardType: 'virtual',
          description: "Nigeria's Official Card",
          imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTAvEhrHtKJjmJ7AvMVgKNeSaMC0NyHLBmYxQiSbK_rkQ&s',
          isDefault: true,
          available: true,
          currency: 'NGN',
          issuanceFee: 500,
          maintenanceFee: 0,
          discount: {
            available: true,
            name: 'Launch Offer',
            percentage: 100,
            startDate: '2026-08-01T00:00:00Z',
            endDate: '2026-08-31T23:59:59Z',
          },
          items: [
            {
              title: 'Instant',
              desc: 'Create and use immediately',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/2563EB/flash-on.png',
            },
            {
              title: 'Online',
              desc: 'Pay on websites and apps',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/2563EB/internet.png',
            },
            {
              title: 'Subscriptions',
              desc: 'Works with recurring payments',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/2563EB/calendar.png',
            },
            {
              title: 'Secure',
              desc: 'Freeze and manage in the app',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/2563EB/lock.png',
            },
          ],
        },
        {
          id: 'virtualMidnight',
          name: 'Midnight Black',
          cardBrand: 'Verve',
          cardType: 'virtual',
          description: 'Secure and sleek',
          imageUrl: 'https://cdn.tediwave.com/cards/virtual/midnight-black.png',
          isDefault: false,
          available: true,
          currency: 'USD',
          issuanceFee: 150,
          maintenanceFee: 50,
          discount: {
            available: true,
            name: 'August Launch Offer',
            percentage: 10,
            startDate: '2026-08-01T00:00:00Z',
            endDate: '2026-08-31T23:59:59Z',
          },
          items: [
            {
              title: 'Instant',
              desc: 'Create and use immediately',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/2563EB/flash-on.png',
            },
            {
              title: 'Privacy',
              desc: 'Designed for secure online use',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/2563EB/privacy.png',
            },
            {
              title: 'Subscriptions',
              desc: 'Works with recurring payments',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/2563EB/calendar.png',
            },
          ],
        },
      ],
    },
    {
      id: 'physical',
      type: 'physical',
      name: 'Physical Card',
      cardVariants: [
        {
          id: 'physicalSilver',
          name: 'Silver Edition',
          cardBrand: 'Verve',
          cardType: 'physical',
          description: 'Premium metallic finish',
          imageUrl: 'https://cdn.tediwave.com/cards/physical/silver.png',
          isDefault: true,
          available: true,
          currency: 'NGN',
          issuanceFee: 2500,
          maintenanceFee: 100,
          discount: {
            available: true,
            name: 'Founders Edition Discount',
            percentage: 20,
            startDate: '2026-08-01T00:00:00Z',
            endDate: '2026-08-31T23:59:59Z',
          },
          items: [
            {
              title: 'Universal',
              desc: 'ATM and POS access anywhere',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/8B5CF6/atm.png',
            },
            {
              title: 'Contactless',
              desc: 'Swift tap-to-pay technology',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/8B5CF6/contactless-payment.png',
            },
            {
              title: 'Elite Build',
              desc: 'Durable design for your wallet',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/8B5CF6/star.png',
            },
            {
              title: 'Hybrid Safety',
              desc: 'Manage status via mobile app',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/8B5CF6/lock.png',
            },
          ],
        },
        {
          id: 'physicalBlack',
          name: 'Obsidian Black',
          cardBrand: 'Verve',
          cardType: 'physical',
          description: 'Bold contemporary look',
          imageUrl: 'https://cdn.tediwave.com/cards/physical/obsidian-black.png',
          isDefault: false,
          available: false,
          currency: 'EUR',
          issuanceFee: 3000,
          maintenanceFee: 120,
          discount: {
            available: false,
            name: null,
            percentage: 0,
            startDate: null,
            endDate: null,
          },
          items: [
            {
              title: 'Premium',
              desc: 'Premium matte finish',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/8B5CF6/star.png',
            },
            {
              title: 'Contactless',
              desc: 'Tap-to-pay supported',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/8B5CF6/contactless-payment.png',
            },
            {
              title: 'High Volume',
              desc: 'Elevated purchase limits',
              icon: 'https://img.icons8.com/fluency-systems-filled/48/8B5CF6/bar-chart.png',
            },
          ],
        },
      ],
    },
  ],
};

export const useCardCatalog = () => {
  const cards = useMemo(() => cardCatalogMock.cards, []);

  const getCardById = (id) => cards.find((card) => card.id === id) || null;
  const getCardsByType = (type) => cards.filter((card) => card.type === type);

  return {
    cards,
    getCardById,
    getCardsByType,
    loading: false,
    error: null,
  };
};

const userCardsScenarioPresets = {
  activeVirtualCard: {
    hasCard: true,
    activeType: 'virtual',
    cards: [
      {
        cardId: '6418eb71a37e405064694518',
        cardType: 'virtual',
        variantId: 'virtualClassic',
        status: 'active',
        cardHolder: 'Daniel Chukwudi',
        cardNumber: '9097 2680 1234 5678',
        maskedPan: '506110******1234',
        cvv: '482',
        cardBrand: 'Verve',
        expiryMonth: '09',
        expiryYear: '2028',
        balance: 125000,
        currency: 'NGN',
        spendingLimits: [
          {
            amount: 1500000,
            interval: 'daily',
          },
        ],
      },
    ],
  },
  activePhysicalCard: {
    hasCard: true,
    activeType: 'physical',
    cards: [
      {
        cardId: '6418eb71a37e405064694519',
        cardType: 'physical',
        variantId: 'physicalSilver',
        status: 'active',
        cardHolder: 'Daniel Chukwudi',
        cardNumber: '5123 4567 8910 1234',
        maskedPan: '512345******1234',
        cvv: '731',
        cardBrand: 'Verve',
        expiryMonth: '11',
        expiryYear: '2030',
        balance: 245000,
        currency: 'NGN',
        spendingLimits: [
          {
            amount: 3000000,
            interval: 'daily',
          },
        ],
      },
    ],
  },
  activeBothCards: {
    hasCard: true,
    activeType: 'both',
    cards: [
      {
        cardId: '6418eb71a37e405064694518',
        cardType: 'virtual',
        variantId: 'virtualClassic',
        status: 'active',
        cardHolder: 'Daniel Chukwudi',
        cardNumber: '9097 2680 1234 5678',
        maskedPan: '506110******1234',
        cvv: '482',
        cardBrand: 'Verve',
        expiryMonth: '09',
        expiryYear: '2028',
        balance: 125000,
        currency: 'NGN',
        spendingLimits: [
          {
            amount: 1500000,
            interval: 'daily',
          },
        ],
      },
      {
        cardId: '6418eb71a37e405064694519',
        cardType: 'physical',
        variantId: 'physicalSilver',
        status: 'active',
        cardHolder: 'Daniel Chukwudi',
        cardNumber: '5123 4567 8910 1234',
        maskedPan: '512345******1234',
        cvv: '731',
        cardBrand: 'Verve',
        expiryMonth: '11',
        expiryYear: '2030',
        balance: 245000,
        currency: 'NGN',
        spendingLimits: [
          {
            amount: 3000000,
            interval: 'daily',
          },
        ],
      },
    ],
  },
  noActiveCard: {
    hasCard: false,
    activeType: null,
    cards: [],
  },
  blockedVirtualCard: {
    hasCard: false,
    activeType: null,
    cards: [
      {
        cardId: '6418eb71a37e405064694520',
        cardType: 'virtual',
        variantId: 'virtualClassic',
        status: 'blocked',
        cardHolder: 'Daniel Chukwudi',
        cardNumber: null,
        maskedPan: '506110******1234',
        cvv: null,
        cardBrand: 'Verve',
        expiryMonth: '09',
        expiryYear: '2028',
        balance: 0,
        currency: 'NGN',
      },
    ],
  },
  pendingPhysicalCard: {
    hasCard: false,
    activeType: null,
    cards: [
      {
        cardId: '6418eb71a37e405064694521',
        cardType: 'physical',
        variantId: 'physicalSilver',
        status: 'pending',
        cardHolder: 'Daniel Chukwudi',
        cardNumber: null,
        maskedPan: null,
        cvv: null,
        cardBrand: 'Verve',
        expiryMonth: null,
        expiryYear: null,
        balance: 0,
        currency: 'NGN',
      },
    ],
  },
};

export const useUserCards = (scenario = 'activeVirtualCard') => {
  const userCards = useMemo(() => {
    return userCardsScenarioPresets[scenario] || userCardsScenarioPresets.activeVirtualCard;
  }, [scenario]);

  const activeCard = useMemo(() => {
    return userCards.cards.find((card) => card.status === 'active') || null;
  }, [userCards.cards]);

  return {
    ...userCards,
    activeCard,
    hasActiveCard: userCards.hasCard && Boolean(activeCard),
    loading: false,
    error: null,
  };
};

export default function useCards() {
  const cardCatalog = useCardCatalog();
  const userCards = useUserCards();

  return {
    ...cardCatalog,
    ...userCards,
    cardCatalog: cardCatalog.cards,
    userCards: userCards.cards,
  };
}
