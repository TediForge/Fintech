import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@providers/ThemeProvider';

const MAX_TWEET_LENGTH = 280;

const normalizeTweetText = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\r\n/g, '\n').trim();
};

const formatTweetDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const normalizeTweets = (tweetData = []) => {
  if (!Array.isArray(tweetData)) return [];

  return tweetData
    .filter((item) => item && item.text)
    .map((item, index) => ({
      id: String(item.id || `tweet-${index}`),
      author: item.author || 'Unknown',
      handle: item.handle || '@anonymous',
      avatar: item.avatar || 'https://cdn-icons-png.flaticon.com/128/3135/3135715.png',
      createdAt: item.createdAt || '',
      text: normalizeTweetText(item.text),
      mediaUrl: item.mediaUrl || null,
      likes: Number(item.likes || 0),
      reposts: Number(item.reposts || 0),
      replies: Number(item.replies || 0),
      views: Number(item.views || 0),
      isLiked: Boolean(item.isLiked),
      isReposted: Boolean(item.isReposted),
    }));
};

const TweetItem = ({ tweet, colors }) => (
  <View style={[styles.tweetCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
    <View style={styles.headerRow}>
      <View style={styles.authorRow}>
        <Image source={{ uri: tweet.avatar }} style={styles.avatar} />
        <View>
          <Text style={[styles.authorName, { color: colors.textPrimary }]}>{tweet.author}</Text>
          <Text style={[styles.authorHandle, { color: colors.textSecondary }]}>{tweet.handle}</Text>
        </View>
      </View>
      <Text style={[styles.tweetDate, { color: colors.textSecondary }]}>{formatTweetDate(tweet.createdAt)}</Text>
    </View>

    <Text style={[styles.tweetText, { color: colors.textPrimary }]}>{tweet.text}</Text>

    {tweet.mediaUrl ? (
      <Image source={{ uri: tweet.mediaUrl }} style={styles.mediaImage} />
    ) : null}

    <View style={styles.metricsRow}>
      <View style={styles.metricItem}>
        <Ionicons name="heart-outline" size={14} color={colors.textSecondary} style={styles.metricIcon} />
        <Text style={[styles.metricText, { color: colors.textSecondary }]}>{tweet.likes}</Text>
      </View>
      <View style={styles.metricItem}>
        <Ionicons name="repeat-outline" size={14} color={colors.textSecondary} style={styles.metricIcon} />
        <Text style={[styles.metricText, { color: colors.textSecondary }]}>{tweet.reposts}</Text>
      </View>
      <View style={styles.metricItem}>
        <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} style={styles.metricIcon} />
        <Text style={[styles.metricText, { color: colors.textSecondary }]}>{tweet.replies}</Text>
      </View>
      <View style={styles.metricItem}>
        <Ionicons name="eye-outline" size={14} color={colors.textSecondary} style={styles.metricIcon} />
        <Text style={[styles.metricText, { color: colors.textSecondary }]}>{tweet.views}</Text>
      </View>
    </View>

    <View style={styles.statusRow}>
      <Text style={[styles.statusText, { color: tweet.isLiked ? colors.accent : colors.textSecondary }]}>
        {tweet.isLiked ? 'Liked' : 'Like'}
      </Text>
      <Text style={[styles.statusText, { color: tweet.isReposted ? colors.accent : colors.textSecondary }]}>
        {tweet.isReposted ? 'Reposted' : 'Repost'}
      </Text>
    </View>
  </View>
);

export const TweetCard = ({ tweets = [] }) => {
  const { colors } = useTheme();
  const normalizedTweets = normalizeTweets(tweets);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.surface }]}> 
      {normalizedTweets.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No tweet content available.</Text>
        </View>
      ) : (
        normalizedTweets.map((tweet) => (
          <TweetItem key={tweet.id} tweet={tweet} colors={colors} />
        ))
      )}
    </ScrollView>
  );
};

export default TweetCard;

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  emptyState: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  tweetCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  authorHandle: {
    fontSize: 12,
  },
  tweetDate: {
    fontSize: 11,
  },
  tweetText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  mediaImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricIcon: {
    marginRight: 4,
  },
  metricText: {
    fontSize: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
