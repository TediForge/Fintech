import { Alert } from '@components/common/Alert';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionToken } from '@hooks/useAuth';
import UnifiedServiceSection from '@components/extra/UnifiedServiceSection';
import config from '@config/app';
import { apiConfig } from '@config/api';

const api = apiConfig.baseUrl;
const API_URL = `${api}/v1/rewards/extraTasks`;
const taskCacheKey = 'extraTasksCache';

const isCacheFromToday = (cachedAt) => {
    if (!cachedAt) return false;

    const cachedDate = new Date(cachedAt);
    const currentDate = new Date();

    return !Number.isNaN(cachedDate.getTime())
        && cachedDate.getFullYear() === currentDate.getFullYear()
        && cachedDate.getMonth() === currentDate.getMonth()
        && cachedDate.getDate() === currentDate.getDate();
};

// Global Services List
const SERVICES_DATA = [
    { icon: "football-outline", title: "Bets Funding", subtitle: "Top up SportyBet & others", screen: "BettingScreen" },
    { icon: "wallet-outline", title: "Grow Your Money", subtitle: "Earn up to 20% Annual Yield", screen: "Investment" },
    { icon: "bulb-outline", title: "Utility Bills", subtitle: "Pay Electricity & Water instantly", screen: "ElectricityScreen" },
    { icon: "tv-outline", title: "Cable TV", subtitle: "Renew DSTV, GOTV & Startimes", screen: "CableTvScreen" },
    { icon: "phone-portrait-outline", title: "Airtime Top-up", subtitle: "Instant 3% Cashback on airtime", screen: "AirtimeScreen" },
    { icon: "wifi-outline", title: "Data Bundles", subtitle: "Cheap data for all networks", screen: "DataScreen" },
    { icon: "school-outline", title: "Education Pins", subtitle: "WAEC, NECO & JAMB result pins", screen: "EducationScreen" },
    { icon: "card-outline", title: "Virtual Cards", subtitle: "Shop globally with ease", screen: "VirtualCard" },
    { icon: "swap-horizontal-outline", title: "Bank Transfer", subtitle: "Send money to all Nigerian banks", screen: "TransferScreen" },
    // { icon: "shield-checkmark-outline", title: "Insurance", subtitle: "Protect what matters most", screen: "Insurance" },
];

// Data for the new "Earn More" section
const earnMoreTasks = [
    {
        key: 'referrals',
        imageUrl: 'https://cdn-icons-png.flaticon.com/128/1490/1490852.png',
        title: 'Referrals',
        subtitle: 'Invite Friends & Get Rewards',
        screen: 'RefererScreen', // Assumed screen name
    },
    {
        key: 'transfer',
        imageUrl: 'https://cdn-icons-png.flaticon.com/128/3135/3135715.png',
        title: 'Transfer',
        subtitle: 'Send Money & Earn Cashback',
        screen: 'TransferScreen',
    },
    {
    key: 'streak',
    imageUrl: 'https://cdn-icons-png.flaticon.com/128/3916/3916984.png',
    title: 'Hot Streak',
    subtitle: 'Keep Streaks & Earn More',
    screen: 'StreakScreen',
    },
];

const discoverMoreTasks = [
    {
        key: 'airtime',
        imageUrl: 'https://cdn-icons-png.flaticon.com/128/724/724664.png',
        title: 'Airtime Top-up',
        subtitle: 'Recharge any network instantly',
        screen: 'AirtimeScreen',
    },
    {
        key: 'data',
        imageUrl: 'https://cdn-icons-png.flaticon.com/128/2877/2877163.png',
        title: 'Data Bundles',
        subtitle: 'Stay connected for less',
        screen: 'DataScreen',
    },
    {
        key: 'virtual-card',
        imageUrl: 'https://cdn-icons-png.flaticon.com/128/633/633611.png',
        title: 'Virtual Cards',
        subtitle: 'Shop globally with ease',
        screen: 'VirtualCard',
    },
];

export default function ExtraServices({ currentScreen, showUssdEnquiry = false, displayNumber, displayTask = false, discover = false }) {
    const navigation = useNavigation();
    const [backendTasks, setBackendTasks] = useState(null);
    const [loading, setLoading] = useState(false);
    const [claimingKey, setClaimingKey] = useState(null);

    const navigateToDestination = useCallback((destination) => {
        if (destination === 'VirtualCard') {
            navigation.replace('Dashboard', { tab: 'Cards' });
            return;
        }

        navigation.navigate(destination);
    }, [navigation]);

    const syncTasks = useCallback(async (silent = false) => {
        try {
            if (!silent) {
                setLoading(true);
            }
            const token = await getSessionToken();
            const cacheKey = `${taskCacheKey}:${token}`;
    
            // Always attempt to fetch fresh data from the network first.
            const response = await fetch(`${API_URL}?${encodeURIComponent(config.sessionToken)}=${encodeURIComponent(token)}&action=getStatus`);
            
            if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
                throw new Error(`Server returned non-JSON response: ${response.status}`);
            }
    
            const data = await response.json();
            if (data.status === "success") {
                setBackendTasks(data.tasks);
                // Update the cache with the fresh data.
                await AsyncStorage.setItem(cacheKey, JSON.stringify({
                    tasks: data.tasks,
                    cachedAt: new Date().toISOString(),
                }));
            }
        } catch (e) {
            console.warn("Task Sync Error (using fallback):", e.message);
            // Fallback to cache only if the network request fails.
            const token = await getSessionToken();
            const cacheKey = `${taskCacheKey}:${token}`;
            const cachedValue = await AsyncStorage.getItem(cacheKey);
            if (cachedValue) {
                setBackendTasks(JSON.parse(cachedValue).tasks);
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, []);

    const handleAction = async (key, task) => {
        if (task.status === 'go') {
            navigateToDestination(task.screen);
        } else if (task.status === 'claim') {
            try {
                setClaimingKey(key);
                const token = await getSessionToken();
                const response = await fetch(`${API_URL}?${encodeURIComponent(config.sessionToken)}=${encodeURIComponent(token)}&action=claimTask&taskKey=${key}`, {
                    method: 'POST'
                });

                if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
                    throw new Error('Invalid server response');
                }

                const data = await response.json();
                
                if (data.status === "success") {
                    Alert.sheet("Reward Claimed", "Added to your cashback wallet");
                    await syncTasks(); // Refetch tasks to update the UI state.
                } else {
                    Alert.sheet("Error", data.message);
                }
            } catch (e) {
                Alert.sheet("Error", "Check your internet connection");
            } finally {
                setClaimingKey(null);
            }
        }
    };

    useEffect(() => {
        if (!displayTask) return;

        // Perform an initial fetch that shows the loading indicator
        syncTasks(false);

        // Set up a silent background sync every 5 seconds
        const intervalId = setInterval(() => {
            syncTasks(true);
        }, 5000);

        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
    }, [displayTask, syncTasks]);

    const selectedServices = useMemo(() => {
        let available = SERVICES_DATA.filter(service => service.screen !== currentScreen);
        let count = displayNumber ? parseInt(displayNumber) : (showUssdEnquiry ? 2 : 3);
        return [...available].sort(() => 0.5 - Math.random()).slice(0, count);
    }, [currentScreen, showUssdEnquiry, displayNumber]);

    if (discover && !displayTask) {
        return (
            <View style={styles.container}>
                <UnifiedServiceSection
                    items={discoverMoreTasks}
                    title="Discover More"
                    rowMode="button"
                    marginVertical={10}
                    onItemPress={(item) => navigateToDestination(item.screen)}
                />
            </View>
        );
    }

    if (displayTask) {
        return (
            <View style={styles.container}>
                <UnifiedServiceSection
                    title="Extra Tasks"
                    items={backendTasks ? Object.keys(backendTasks).map((key) => ({
                        id: key,
                        ...backendTasks[key],
                        steps: `${backendTasks[key].current_step}/${backendTasks[key].max_step}`,
                        isActionLoading: claimingKey === key,
                    })) : []}
                    rowMode="button"
                    marginVertical={10}
                    showSteps
                    showTimer
                    isLoading={loading && !backendTasks}
                    onItemPress={(item) => handleAction(item.id, backendTasks[item.id])}
                />

                {/* "Earn More" card, displayed below "Progress Tasks" */}
                <UnifiedServiceSection
                    title="Earn More"
                    items={earnMoreTasks.map((task) => ({ ...task, status: 'go' }))}
                    rowMode="button"
                    marginVertical={10}
                    onItemPress={(item) => navigateToDestination(item.screen)}
                />

                {discover && (
                    <UnifiedServiceSection
                        title="Discover More"
                        items={discoverMoreTasks}
                        rowMode="button"
                        marginVertical={10}
                        onItemPress={(item) => navigateToDestination(item.screen)}
                    />
                )}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {showUssdEnquiry && !displayNumber && (
                <UnifiedServiceSection
                    title="USSD Enquiry"
                    rowMode="chevron"
                    marginVertical={10}
                    items={[{ id: 'ussd', icon: 'code-download-outline', title: 'USSD Enquiry', subtitle: 'Check phone balance and more' }]}
                    onItemPress={() => navigation.navigate('CodeEnquiryPage')}
                />
            )}
            <UnifiedServiceSection
                title="More Services"
                rowMode="chevron"
                marginVertical={10}
                items={selectedServices}
                onItemPress={(item) => navigateToDestination(item.screen)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: 'transparent' },
});