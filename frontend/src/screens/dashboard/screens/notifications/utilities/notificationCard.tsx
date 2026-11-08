import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { formatDateTime } from '@lib/utils/format';

const DEFAULT_PROFILE = 'https://paysmart.com.ng/assets/brand-logos/bitmap.png';

const NotificationCard = ({
  item,
  onPress,
  onMarkAsRead,
  onDelete,
  formatDate,
  swipeableRefs,
  closeOtherSwipeables,
  defaultProfileImage = DEFAULT_PROFILE,
  cardWidth,
  cardHeight,
}) => {
  const profileImg = item.profile_image_url || defaultProfileImage;
  const formattedDate = formatDate
    ? formatDate(item.date_sent || item.created_at)
    : formatDateTime(item.date_sent || item.created_at);

  const renderRightActions = () => {
    const actions = [];

    if (!item.is_read) {
      actions.push({
        id: 'mark',
        label: 'Read',
        icon: 'https://cdn-icons-png.flaticon.com/128/5070/5070394.png',
        color: '#2FB86D',
        onPress: () => {
          onMarkAsRead?.(item.id);
          swipeableRefs?.current?.get(item.id)?.close();
        },
      });
    }

    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: 'https://cdn-icons-png.flaticon.com/128/6861/6861362.png',
      color: '#FF3B30',
      onPress: () => {
        onDelete?.(item.id);
        swipeableRefs?.current?.get(item.id)?.close();
      },
    });

    return (
      <View style={styles.swipeActionsContainer}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[styles.swipeActionItem, { backgroundColor: action.color }]}
            onPress={action.onPress}
          >
            <Image source={{ uri: action.icon }} style={styles.swipeActionIcon} />
            <Text style={styles.swipeActionText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Swipeable
      key={item.id}
      ref={(ref) => {
        if (ref) swipeableRefs?.current?.set(item.id, ref);
        else swipeableRefs?.current?.delete(item.id);
      }}
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={() => closeOtherSwipeables?.(item.id)}
      friction={3}
      rightThreshold={40}
    >
      <TouchableOpacity activeOpacity={0.9} style={styles.withImage} onPress={() => onPress?.(item)}>
        {item.cover_image_url ? (
          <View style={[styles.image, cardWidth ? { width: cardWidth } : null, cardHeight ? { height: cardHeight } : null]}>
            <Image source={{ uri: item.cover_image_url }} style={styles.coverImage} resizeMode="cover" />
            {!item.is_read && <View style={styles.badge} />}
          </View>
        ) : null}

        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.imageBadgeWrapper}>
              <View style={styles.imageWrapper}>
                <Image source={{ uri: profileImg }} style={styles.profileImage} />
              </View>
              {!item.is_read && <View style={styles.profileBadge} />}
            </View>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          </View>

          <Text style={styles.messageText}>{item.message}</Text>
          <View style={styles.divider} />

          <View style={styles.bottomRow}>
            <Text style={styles.dateText}>{formattedDate}</Text>
            {item.action_label ? (
              <View style={styles.actionButton}>
                <View style={styles.actionContent}>
                  <Text style={styles.actionText}>{item.action_label}</Text>
                  <Ionicons name="chevron-forward" size={15} color="#2FB86D" style={styles.actionIcon} />
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  withImage: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  image: {
    width: '100%',
    height: 160,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  content: {
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  imageWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
  },
  imageBadgeWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  profileBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
    color: '#333',
  },
  messageText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
    marginBottom: 5,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#999',
  },
  actionButton: {
    paddingVertical: 5,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    color: '#2FB86D',
    fontWeight: 'bold',
  },
  actionIcon: {
    marginLeft: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f2f2f2',
    marginVertical: 5,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  swipeActionsContainer: {
    width: 65,
    marginLeft: 10,
    flexDirection: 'column',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 10,
  },
  swipeActionItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    borderRadius: 12,
  },
  swipeActionIcon: {
    width: 20,
    height: 20,
    tintColor: '#fff',
    marginBottom: 5,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default NotificationCard;
