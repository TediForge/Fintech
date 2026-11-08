import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const TrackingTimeline = ({ status, date }) => {
  // Helper to parse or default the base date
  const baseDate = date ? new Date(date) : new Date();

  // Animated value for progress transitions
  const animatedProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animatedProgress.setValue(0);
    Animated.timing(animatedProgress, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [status]);

  // Format helpers to match standard presentation strings
  const formatTime = (dateObj) => {
    let hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
  };

  const formatDate = (dateObj) => {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Generate dynamic steps by subtracting seconds from the final date value
  const time3 = baseDate; 
  const time2 = new Date(time3.getTime() - 2 * 1000); 
  const time1 = new Date(time2.getTime() - 3 * 1000); 

  // Calculate the relative time duration between the milestones
  const formatTimeSpent = (current, previous) => {
    const diffInSeconds = Math.max(0, Math.floor((current.getTime() - previous.getTime()) / 1000));
    return `${diffInSeconds}s duration`;
  };

  // Dynamic color matching using requested rgba values
  const getStatusColor = (opacity = 1) => {
    if (status === 'successful') return `rgba(40, 167, 69, ${opacity})`; 
    if (status === 'failed') return `rgba(231, 76, 60, ${opacity})`; 
    return `rgba(240, 173, 78, ${opacity})`; 
  };

  let timelineData = [];

  if (status === 'successful') {
    timelineData = [
      {
        id: '1',
        title: 'Status',
        status: 'Completed',
        time: formatTime(time3),
        date: formatTimeSpent(time3, time2),
        isActive: true,
        isPassed: true,
      },
      {
        id: '2',
        title: 'Status',
        status: 'Routing',
        time: formatTime(time2),
        date: formatTimeSpent(time2, time1),
        isActive: false,
        isPassed: true,
      },
      {
        id: '3',
        title: 'Status',
        status: 'Initiated',
        time: formatTime(time1),
        date: '0s duration',
        isActive: false,
        isPassed: true,
      },
    ];
  } else if (status === 'failed') {
    timelineData = [
      {
        id: '1',
        title: 'Status',
        status: 'Failed to deliver',
        time: formatTime(time3),
        date: formatTimeSpent(time3, time2),
        isActive: true,
        isPassed: false,
      },
      {
        id: '2',
        title: 'Status',
        status: 'Issue encountered',
        time: formatTime(time2),
        date: formatTimeSpent(time2, time1),
        isActive: false,
        isPassed: true,
      },
      {
        id: '3',
        title: 'Status',
        status: 'Initiated',
        time: formatTime(time1),
        date: '0s duration',
        isActive: false,
        isPassed: true,
      },
    ];
  } else if (status === 'pending' || status === 'processing') {
    timelineData = [
      {
        id: '1',
        title: 'Status',
        status: 'Processing',
        time: formatTime(time3),
        date: formatTimeSpent(time3, time2),
        isActive: true,
        isPassed: false,
      },
      {
        id: '2',
        title: 'Status',
        status: 'Routing',
        time: formatTime(time2),
        date: formatTimeSpent(time2, time1),
        isActive: false,
        isPassed: false,
      },
      {
        id: '3',
        title: 'Status',
        status: 'Initiated',
        time: formatTime(time1),
        date: '0s duration',
        isActive: false,
        isPassed: true,
      },
    ];
  } else {
    timelineData = [
      {
        id: '1',
        title: 'Status',
        status: 'Arrived at post office 29133',
        time: formatTime(time3),
        date: formatTimeSpent(time3, time2),
        isActive: true,
        isPassed: true,
      },
      {
        id: '2',
        title: 'Status',
        status: 'Departed from depot 1',
        time: formatTime(time2),
        date: formatTimeSpent(time2, time1),
        isActive: false,
        isPassed: false,
      },
      {
        id: '3',
        title: 'Status',
        status: 'Arrives at depot 1',
        time: formatTime(time1),
        date: '0s duration',
        isActive: false,
        isPassed: false,
      },
    ];
  }

  return (
    <View style={styles.cardContainer}>
      <View style={styles.headerSection}>
        <View style={styles.titleContainer}>
          <Text style={styles.tripIcon}>☲</Text>
          <Text style={styles.headerTitle}>Timeline</Text>
        </View>
        <TouchableOpacity activeOpacity={0.6}>
        </TouchableOpacity>
      </View>

      <View style={styles.contentSection}>
        <View style={styles.timelineContainer}>
          {timelineData.map((item, index) => {
            const isLastItem = index === timelineData.length - 1;
            
            const startRange = index * 0.2;
            const endRange = Math.min(1, startRange + 0.5);

            const opacity = animatedProgress.interpolate({
              inputRange: [startRange, endRange],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            });

            const scale = animatedProgress.interpolate({
              inputRange: [startRange, endRange],
              outputRange: [0.7, 1],
              extrapolate: 'clamp',
            });

            const lineHeightFactor = animatedProgress.interpolate({
              inputRange: [startRange, endRange],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            });

            return (
              <View key={item.id} style={styles.rowContainer}>
                {/* 
                  The gradient container is wrapped here with absolute fills,
                  ensuring the pill heights scale directly with structural layout additions
                */}
                {item.isActive && (
                  <View style={styles.gradientWrapper}>
                    <LinearGradient
                      colors={[getStatusColor(0.25), getStatusColor(0.10), getStatusColor(0.02)]}
                      style={styles.gradientPill}
                    />
                  </View>
                )}

                <View style={styles.indicatorColumn}>
                  <Animated.View 
                    style={[
                      styles.outerCircle, 
                      { borderColor: item.isActive || item.isPassed ? getStatusColor(1) : 'rgba(0, 0, 0, 0.04)' },
                      { transform: [{ scale }] }
                    ]}
                  />

                  {!isLastItem && (
                    <View style={styles.lineTrack}>
                      <Animated.View 
                        style={[
                          styles.line, 
                          { backgroundColor: item.isPassed ? getStatusColor(1) : 'rgba(0, 0, 0, 0.08)' },
                          { height: lineHeightFactor }
                        ]} 
                      />
                    </View>
                  )}
                </View>

                <Animated.View style={[styles.contentColumn, !isLastItem && styles.contentPadding, { opacity }]}>
                  <View style={styles.textMainRow}>
                    <View style={styles.titleBlock}>
                      <Text style={[styles.titleText, item.isActive ? styles.textHighLight : styles.textLowLight]}>
                        {item.title}
                      </Text>
                    </View>
                    <Text style={[styles.timeText, item.isActive ? styles.timeActive : styles.timeInactive]}>
                      {item.time}
                    </Text>
                  </View>

                  <View style={styles.textSubRow}>
                    <Text style={[styles.statusText, item.isActive ? styles.statusActive : styles.statusInactive]}>
                      {item.status}
                    </Text>
                    <Text style={[styles.dateText, item.isActive ? styles.dateActive : styles.dateInactive]}>
                      {item.date}
                    </Text>
                  </View>
                </Animated.View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 16,
    marginVertical: 10,
    overflow: 'hidden',
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripIcon: {
    fontSize: 14,
    marginRight: 6,
    color: '#555A64',
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#555A64',
    fontSize: 13,
    fontWeight: '500',
  },
  seeMoreText: {
    color: '#555A64',
    fontSize: 13,
    fontWeight: '400',
  },
  contentSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 14,
    marginHorizontal: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  timelineContainer: {
    position: 'relative',
  },
  rowContainer: {
    flexDirection: 'row',
    position: 'relative',
  },
  gradientWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -3,
    width: 22,
    zIndex: 0,
  },
  gradientPill: {
    flex: 1,
    borderRadius: 11,
  },
  indicatorColumn: {
    alignItems: 'center',
    marginRight: 14,
    width: 16,
    zIndex: 3,
    paddingTop: 12,
  },
  outerCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  lineTrack: {
    position: 'absolute',
    top: 26, 
    bottom: -12, 
    width: 2,
    alignItems: 'center',
  },
  line: {
    width: '100%',
  },
  contentColumn: {
    flex: 1,
    zIndex: 2,
    paddingVertical: 10,
  },
  contentPadding: {
    borderBottomWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  textMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 11,
    fontWeight: '400',
  },
  timeText: {
    fontSize: 12,
  },
  timeActive: {
    fontWeight: '400',
    color: '#1E2432',
  },
  timeInactive: {
    fontWeight: '400',
    color: '#7A818E',
  },
  textSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    flex: 1,
    paddingRight: 8,
  },
  statusActive: {
    fontWeight: '700',
    color: '#1E2432',
  },
  statusInactive: {
    fontWeight: '500',
    color: '#7A818E',
  },
  dateText: {
    fontSize: 12,
  },
  dateActive: {
    color: '#7A818E',
    fontWeight: '400',
  },
  dateInactive: {
    color: '#AAB0BC',
    fontWeight: '400',
  },
  textHighLight: {
    color: '#1E2432',
  },
  textLowLight: {
    color: '#7A818E',
  },
});

export default TrackingTimeline;