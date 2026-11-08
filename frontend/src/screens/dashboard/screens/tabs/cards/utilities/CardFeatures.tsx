import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, TouchableOpacity } from 'react-native';
import ATMCard from './ATMCard';
import ImageTabSelector from './ImageTabSelector';
import useCards from '../hooks/useCards';

const { width } = Dimensions.get('window');
const isSmall = width < 300;

const CardFeatures = ({ type = 'virtual', onActionPress, card, tabs = [], selectedTab = null, onTabSelect = () => {} }) => {
  const { getCardsByType } = useCards();
  const [activeTab, setActiveTab] = useState(selectedTab);

  const cardTypeData = getCardsByType(type)[0] || null;
  const catalogTabs = cardTypeData?.cardVariants?.map((variant) => ({
    id: variant.id,
    value: variant.id,
    imageUrl: variant.imageUrl,
    name: variant.name,
    description: variant.description,
  })) ?? [];

  const tabList = tabs.length > 0 ? tabs : catalogTabs;

  useEffect(() => {
    if (selectedTab !== null) {
      setActiveTab(selectedTab);
    } else if (tabList.length > 0 && activeTab === null) {
      setActiveTab(tabList[0].value ?? tabList[0].id ?? 0);
    }
  }, [selectedTab, tabList]);

  const activeTabValue = activeTab ?? tabList[0]?.value ?? tabList[0]?.id;
  const activeVariant = cardTypeData?.cardVariants?.find((variant) => variant.id === activeTabValue) || null;
  const previewImage = activeVariant?.imageUrl || card?.imageUrl;

  const handleTabSelect = (value, item) => {
    setActiveTab(value);
    onTabSelect(value, item);
  };

  const current = {
    title: activeVariant?.name || card?.name || '',
    tagline: activeVariant?.description || card?.description || '',
    accent: activeVariant?.accent || '#3B82F6',
    bg: activeVariant?.bg || '#EFF6FF',
    items: activeVariant?.items || [],
  };

  const issuanceFee = Number(activeVariant?.issuanceFee ?? 0);
  const discount = activeVariant?.discount || {};
  const hasDiscount = Boolean(
    discount.available &&
    discount.name &&
    Number(discount.percentage) > 0 &&
    issuanceFee > 0
  );
  const finalAmount = hasDiscount
    ? Math.round(issuanceFee - issuanceFee * (Number(discount.percentage) / 100))
    : issuanceFee;
  const isFree = finalAmount <= 0;
  const isAvailable = activeVariant?.available !== false;

  const actionLabel = !isAvailable
    ? 'Unavailable'
    : isFree
    ? 'Get it for free'
    : `Get it for ₦${finalAmount.toLocaleString()}`;

  const buttonDisabled = !isAvailable;

  return (
    <>
      {card && (
        <View style={styles.cardPreviewWrapper}>
          <View style={styles.cardContainer2}>
            <ATMCard
              mode="preview"
              cardHolder={card.cardHolder}
              cardNumber={card.cardNumber}
              expiryDate={card.expiryDate}
              cardType={card.cardType}
              backgroundColor={card.backgroundColor}
              imageUrl={previewImage}
            />
          </View>
          <View style={styles.tabWrapper}>
            <ImageTabSelector
              tabs={tabList}
              selectedValue={activeTabValue}
              onSelect={handleTabSelect}
              itemSize={50}
              gap={10}
            />
          </View>
        </View>
      )}

      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.tagline}>{current.tagline}</Text>
          </View>
          {(hasDiscount || isFree) && isAvailable && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {isFree
                  ? 'FREE'
                  : `${Number(activeVariant.discount.percentage)}% OFF`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.list}>
        {current.items.map((item, index) => (
          <View key={index} style={styles.row}>
            <View style={[styles.circle, { backgroundColor: current.bg }]}> 
              <Image source={{ uri: item.icon }} style={styles.icon} resizeMode="contain" />
            </View>
            <View style={styles.content}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {onActionPress && (
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: buttonDisabled ? '#D1D5DB' : current.accent },
            buttonDisabled && styles.disabledButton,
          ]}
          onPress={buttonDisabled ? undefined : onActionPress}
          activeOpacity={buttonDisabled ? 1 : 0.8}
          disabled={buttonDisabled}
        >
          <View style={styles.buttonContentRow}>
            <Text style={[styles.actionButtonText, { color: buttonDisabled ? '#9CA3AF' : '#fff' }]}> 
              {actionLabel}
            </Text>
            {hasDiscount && (
              <Text style={styles.buttonOldPrice}>₦{issuanceFee.toLocaleString()}</Text>
            )}
          </View>
        </TouchableOpacity>
      )}
    </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignSelf: 'center',
    borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  header: {
    marginBottom: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardPreviewWrapper: {
    width: '100%',
    marginBottom: 14,
    alignItems: 'center',
  },
  cardContainer2: {
    width: '98%',
  },
  tabWrapper: {
    width: '100%',
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  tagline: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  list: {
    gap: 20, // Reduced gap between items
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#0369A1',
  },
  actionButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContentRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
  },
  buttonOldPrice: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textDecorationLine: 'line-through',
    marginLeft: 5,
  },
  buttonNewPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.9,
  },
  disabledButton: {
    opacity: 0.9,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  icon: {
    width: 18,
    height: 18,
  },
  content: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  itemDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
});

export default CardFeatures;