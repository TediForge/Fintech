import React, { useRef, useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator, 
  Image, 
  Keyboard,
  StatusBar,
  Linking,
  Dimensions,
  Animated,
  Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pusher } from '@pusher/pusher-websocket-react-native';
import { getSessionToken } from '@hooks/useAuth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import ScreenHeader from '@components/headers/ScreenHeader';
import useApiClient from '@hooks/apiClient';
import config from '@config/app';
import { brandConfig } from '@config/brand';
import { apiConfig } from '@config/api';

const api = apiConfig.baseUrl;
const chatEndpoint = `${api}/v1/help/support/chat/index.php`;

const BRAND_COLOR = '#0E3C2E';
const SKELETON_FILL = '#E2E8F0';
const INPUT_AREA_HEIGHT = 63;

// 1. Single Unit row mimicking an incoming AI support message
const StaticMessageRow = () => (
  <View style={[styles.messageRow, { marginBottom: 15 }]}>
    <View style={skeletonStyles.avatarShape} />
    <View style={skeletonStyles.bubbleShape}>
      <View style={[skeletonStyles.line, { width: '40%', height: 8, marginBottom: 8 }]} />
      <View style={[skeletonStyles.line, { width: '85%', height: 12, marginBottom: 6 }]} />
      <View style={[skeletonStyles.line, { width: '60%', height: 12 }]} />
    </View>
  </View>
);

// 2. Complete screen list wrapper locked with React.memo to prevent re-renders
const ChatSkeleton = React.memo(() => (
  <View style={styles.listContent}>
    {[1, 2, 3, 4, 5].map((i) => (
      <StaticMessageRow key={`chat_placeholder_${i}`} />
    ))}
  </View>
));

const SYSTEM_IMAGE = 'https://paysmart.com.ng/assets/brand-logos/bitmap.png';
const TYPING_DELAY_NEW_CHAT = 5000; // 5 seconds typing before welcome message
const SCROLL_THRESHOLD = 100; // Threshold to determine if we should auto-scroll
const pusherApiKey = '4b5420a9bdc757202694';
const pusherCluster = 'mt1';

// CUSTOM: Animated Typing Indicator with 3 dots
const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const animationRef = useRef(null);

  useEffect(() => {
    const createAnimation = (dot, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(dot, {
              toValue: 1,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(dot, {
            toValue: 0,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    };

    animationRef.current = Animated.parallel([
      createAnimation(dot1, 0),
      createAnimation(dot2, 150),
      createAnimation(dot3, 300),
    ]);
    
    animationRef.current.start();

    return () => {
      animationRef.current?.stop();
    };
  }, [dot1, dot2, dot3]);

  const getDotStyle = (anim) => ({
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    }),
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.7, 1.2],
        }),
      },
    ],
  });

  return (
    <View style={styles.customTypingIndicator}>
      <Animated.View style={[styles.typingDot, getDotStyle(dot1)]} />
      <Animated.View style={[styles.typingDot, getDotStyle(dot2)]} />
      <Animated.View style={[styles.typingDot, getDotStyle(dot3)]} />
    </View>
  );
};

export default function ChatRoom({ route, navigation }) {
  const { chatId, ticketId } = route.params || {};
  const insets = useSafeAreaInsets();
  const { user, profileImage } = useApiClient();
  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : undefined;
  const safeBottomInset = Math.max(insets.bottom, 0);
  const composerBottomInset = Math.max(insets.bottom, 0);
  const [messages, setMessages] = useState([]); // Single source of truth
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [image, setImage] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showRecordingControls, setShowRecordingControls] = useState(false);
  const [activeChatId, setActiveChatId] = useState(chatId);
  const [displayTicketId, setDisplayTicketId] = useState(ticketId);
  const [chatState, setChatState] = useState('initializing');
  const [isChatClosed, setIsChatClosed] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true); // For skeleton loading
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [composerHeight, setComposerHeight] = useState(INPUT_AREA_HEIGHT);
  const composerTranslate = useRef(new Animated.Value(0)).current;
  const shouldAutoScroll = useRef(true);
  const flatRef = useRef();
  const pusherInitializedRef = useRef(false);
  const pusherSubscriptionRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const listBottomPadding = keyboardVisible
    ? keyboardHeight + composerHeight + 16
    : composerHeight + composerBottomInset + 12;

  const userFullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'User';
  const userProfilePic = profileImage?.type === 'online' 
    ? profileImage.url 
    : (user?.avatarUrl || SYSTEM_IMAGE);

  // Keyboard Movement & Layout Debugging
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      const nextHeight = Math.max(e.endCoordinates?.height || 0, 0);
      setKeyboardHeight(nextHeight);
      setKeyboardVisible(true);
      Animated.timing(composerTranslate, {
        toValue: Platform.OS === 'ios' ? -nextHeight : -(nextHeight - safeBottomInset),
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
      console.log(`[ChatRoom Debug] Movement: Raising. Target Keyboard Height: ${nextHeight}`);
    });

    const didShowSub = Keyboard.addListener('keyboardDidShow', (e) => {
      console.log(`[ChatRoom Debug] Movement: Settled (Raised). Final Screen Y: ${e.endCoordinates.screenY}`);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
      Animated.timing(composerTranslate, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
      console.log(`[ChatRoom Debug] Movement: Lowering (Keyboard Hiding).`);
    });

    return () => {
      showSub.remove();
      didShowSub.remove();
      hideSub.remove();
    };
  }, [composerTranslate, safeBottomInset]);

  // Fetch messages from backend - LOCAL FIRST APPROACH
  const fetchMessages = async () => {
    if (!activeChatId) {
      console.log('[ChatRoom] fetchMessages skipped: No activeChatId');
      return;
    }
    
    const token = await getSessionToken();

    console.log(`[ChatRoom] Fetching messages for chatId: ${activeChatId}`);
    try {
      const query = new URLSearchParams({
        action: 'getMsg',
        chatId: String(activeChatId),
        [config.sessionToken]: token || '',
      });
      const res = await fetch(`${chatEndpoint}?${query.toString()}`);
      const json = await res.json();
      if (json.status === "success") {
        const incomingMsgs = json.data.messages || [];
        console.log(`[ChatRoom] Fetch success. Received ${incomingMsgs.length} messages. State: ${json.data.chatState}`);

        const newMessages = incomingMsgs.map(msg => ({
          ...msg,
          timestamp: msg.created_at || msg.timestamp || new Date().toISOString(),
          sender_name: msg.senderName || msg.sender_name || (msg.sender === 'user' ? userFullName : 'Unknown Sender'),
          sender_image: msg.senderImage || msg.sender_image || SYSTEM_IMAGE,
          id: msg.id
        })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Directly set the fetched messages, replacing the old state.
        setMessages(newMessages);

        setIsLoadingMessages(false);
        // Check chat state from backend
        setIsAiTyping(false);
        setIsChatClosed(json.data.chatState === 'closed');
        if (json.data.chatState) {
          setChatState(json.data.chatState);
        }
      } else {
        console.log("[ChatRoom] Fetch failed:", json.message);
      }
    } catch (e) {
      console.log("[ChatRoom] Fetch Error:", e);
    }
  };

  // Start new chat with 5-second typing delay
  const startNewChat = async () => {
    console.log('[ChatRoom] Starting new chat initialization...');
    setIsStartingChat(true);
    const token = await getSessionToken();
    try {
      const res = await fetch(chatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'startChat',
          [config.sessionToken]: token || '',
        }),
      });
      const json = await res.json();
      if (json.status === "success") {
        console.log(`[ChatRoom] New chat started. ID: ${json.data.chatId}, Ticket: ${json.data.ticketId}`);
        setActiveChatId(json.data.chatId);
        setDisplayTicketId(json.data.ticketId);
        setChatState(json.data.state || json.data.chatState);
        setIsChatClosed(false); // New chat is always open

        setIsAiTyping(true);
        await new Promise(resolve => setTimeout(resolve, TYPING_DELAY_NEW_CHAT));
        setIsAiTyping(false);

        const timestamp = new Date().toISOString();
        setMessages([{ 
          sender: 'ai', 
          message: json.data.message,
          sender_name: json.data.senderName || `${brandConfig.brandName}9257`,
          sender_image: json.data.senderImage || SYSTEM_IMAGE,
          timestamp: timestamp,
          id: `initial_${timestamp}`
        }]);
      } else {
        console.log("[ChatRoom] Start chat failed:", json.message);
      }
    } catch (e) { console.log("[ChatRoom] Init Error:", e); }
    setIsStartingChat(false);
  };

  // Load the conversation once, then receive new messages through Pusher.
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const handleRealtimeEvent = (event) => {
        if (event.eventName !== 'chat.message' || !event.data) return;

        try {
          const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          const realtimeMessage = {
            ...payload,
            id: payload.id || `realtime_${payload.chatId}_${payload.sender}_${payload.timestamp}`,
            timestamp: payload.timestamp || new Date().toISOString(),
            sender_name: payload.senderName || payload.sender_name || (payload.sender === 'user' ? userFullName : 'Unknown Sender'),
            sender_image: payload.senderImage || payload.sender_image || SYSTEM_IMAGE,
          };

          setMessages((previous) => {
            const exists = previous.some((message) => (
              message.message === realtimeMessage.message
              && message.sender === realtimeMessage.sender
              && message.timestamp === realtimeMessage.timestamp
            ));

            return exists ? previous : [...previous, realtimeMessage];
          });

          if (realtimeMessage.state) {
            setChatState(realtimeMessage.state);
            setIsChatClosed(realtimeMessage.state === 'closed');
          }
          setIsAiTyping(false);
        } catch (error) {
          console.log('[ChatRoom] Invalid realtime message:', error);
        }
      };

      const subscribeToChat = async () => {
        if (!activeChatId) {
          await startNewChat();
          return;
        }

        await fetchMessages();
        if (!isActive) return;

        const pusher = Pusher.getInstance();
        if (!pusherInitializedRef.current) {
          await pusher.init({
            apiKey: pusherApiKey,
            cluster: pusherCluster,
            useTLS: true,
            onAuthorizer: async (channelName, socketId) => {
              const token = await getSessionToken();
              const response = await fetch(chatEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'realtimeAuth',
                  [config.sessionToken]: token || '',
                  socket_id: socketId,
                  channel_name: channelName,
                }),
              });
              const result = await response.json();
              if (!response.ok || !result.auth) {
                throw new Error(result.message || 'Realtime authorization failed');
              }
              return { auth: result.auth };
            },
            onConnectionStateChange: (currentState, previousState) => {
              const recoveredConnection = previousState === 'RECONNECTING' || previousState === 'DISCONNECTED';
              if (currentState === 'CONNECTED' && recoveredConnection && isActive) {
                fetchMessages();
              }
            },
            onError: (message) => console.log('[ChatRoom] Pusher error:', message),
          });
          pusherInitializedRef.current = true;
        }

        await pusher.connect();
        if (!isActive) return;

        const channelName = `private-chat-${activeChatId}`;
        pusherSubscriptionRef.current = await pusher.subscribe({
          channelName,
          onEvent: handleRealtimeEvent,
        });
        console.log(`[ChatRoom] Realtime subscribed: ${channelName}`);
      };

      subscribeToChat().catch((error) => {
        console.log('[ChatRoom] Realtime setup failed:', error);
      });

      return () => {
        isActive = false;
        const channelName = activeChatId ? `private-chat-${activeChatId}` : null;
        if (channelName) {
          Pusher.getInstance().unsubscribe({ channelName }).catch((error) => {
            console.log('[ChatRoom] Realtime unsubscribe failed:', error);
          });
        }
        pusherSubscriptionRef.current = null;
      };
    }, [activeChatId, userFullName])
  );

  const pickImage = async () => {
    setShowAttachmentMenu(false);
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
    });
    if (!result.canceled) {
      setImage(result.assets[0]);
      setSelectedDocument(null);
    }
    console.log('[ChatRoom] Image selected:', !result.canceled ? result.assets[0].uri : 'Cancelled');
  };

  const pickDocument = async () => {
    setShowAttachmentMenu(false);
    alert('Document picker is unavailable in this build. Please use the image option for now.');
  };

  const startRecording = async () => {
    if (isSending || isChatClosed) return;

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        alert('Microphone permission is required to record voice notes.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await newRecording.startAsync();

      setRecording(newRecording);
      setIsRecording(true);
      setIsRecordingPaused(false);
      setShowRecordingControls(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (e) {
      console.log('[ChatRoom] Start recording error:', e);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      setIsRecordingPaused(false);
      setShowRecordingControls(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      if (uri) {
        setMessages(prev => [...prev, {
          sender: 'user',
          message: '',
          voice_note_uri: uri,
          sender_name: userFullName,
          sender_image: userProfilePic,
          timestamp: new Date().toISOString(),
          client_id: `voice_${Date.now()}`,
          isPending: true,
        }]);
      }
    } catch (e) {
      console.log('[ChatRoom] Stop recording error:', e);
    }
  };

  const pauseRecording = async () => {
    if (!recording || isRecordingPaused) return;

    try {
      await recording.pauseAsync();
      setIsRecordingPaused(true);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    } catch (e) {
      console.log('[ChatRoom] Pause recording error:', e);
    }
  };

  const resumeRecording = async () => {
    if (!recording || !isRecordingPaused) return;

    try {
      await recording.startAsync();
      setIsRecordingPaused(false);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (e) {
      console.log('[ChatRoom] Resume recording error:', e);
    }
  };

  const sendMessage = async () => {
    if ((!text.trim() && !image && !selectedDocument) || isSending || isChatClosed) return;
    
    const token = await getSessionToken();
    const clientId = `client_${Date.now()}`;
    const currentText = text; // Capturing current text for potential rollback

    console.log(`[ChatRoom] Sending message. ClientID: ${clientId}, HasImage: ${!!image}`);
    
    const fd = new FormData();
    fd.append('action', 'sendMsg');
    fd.append('message', currentText);
    fd.append('chatId', String(activeChatId));
    fd.append('client_id', clientId);
    fd.append(config.sessionToken, token || '');
    
    if (image) {
      fd.append('image', {
        uri: image.uri,
        name: image.fileName || 'upload.jpg',
        type: image.type || 'image/jpeg',
      });
    }

    if (selectedDocument) {
      fd.append('document', {
        uri: selectedDocument.uri,
        name: selectedDocument.name,
        type: selectedDocument.mimeType || 'application/octet-stream',
      });
    }

    const timestamp = new Date().toISOString();
    const userMsg = { 
      sender: 'user', 
      message: currentText, 
      image_url: image?.uri,
      document_name: selectedDocument?.name,
      sender_name: userFullName,
      sender_image: userProfilePic,
      timestamp: timestamp,
      client_id: clientId,
      isPending: true // Flag to show it's pending
    };
    
    setMessages(prev => [...prev, userMsg]);
    
    setText(''); 
    setImage(null);
    setSelectedDocument(null);
    setShowAttachmentMenu(false);
    setIsSending(true);

      console.log('[ChatRoom] Uploading to server...');
    try {
      const res = await fetch(chatEndpoint, {
        method: 'POST',
        body: fd
      });
      const json = await res.json();
      
      if (json.status === "success") {
        setMessages(prev => prev.map(msg => 
          msg.client_id === clientId ? { ...msg, isPending: false, id: json.data.id } : msg
        ));

        if (json.data.state) {
          setChatState(json.data.state);
          setIsChatClosed(json.data.state === 'closed');
        }
      } else {
          console.log('[ChatRoom] Message failed at server:', json.message);
        setText(currentText);
        setMessages(prev => prev.filter(msg => msg.client_id !== clientId));
        alert(json.message || "Failed to send message");
      }
    } catch (e) { 
        console.log('[ChatRoom] Network error during sendMessage:', e);
      setText(currentText);
      setMessages(prev => prev.filter(msg => msg.client_id !== clientId));
      alert("Network error while sending");
    }
    setIsSending(false);
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + "y ago";
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + "mo ago";
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + "d ago";
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + "h ago";
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + "m ago";
    
    return "Now";
  };

  const inputPadding = {
  paddingBottom: keyboardVisible ? 10 : 20 + composerBottomInset,
  };

  // NEW: Parse link format exactly as WhatsApp handler does (for button wrapping)
  const parseMessageWithLink = (msg) => {
    if (!msg) return { text: '', displayText: null, url: null };
    const regex = /(.*?)(?:\[(.*?)\])?\s*(https?:\/\/\S+)\s*$/s;
    const match = msg.match(regex);
    if (match) {
      return {
        text: match[1].trim(),
        displayText: match[2] || "Tap Here",
        url: match[3]
      };
    }
    return { text: msg, displayText: null, url: null };
  };

  const getHeaderTitle = () => {
    if (displayTicketId) return `Ticket: ${displayTicketId}`;
    if (chatState === 'collectingEmail' || chatState === 'collectingName') return "Account Verification";
    return `${brandConfig.brandName}14594`;
  };

  const handleStartNewChat = () => {
    navigation.goBack(); // Or call startNewChat() directly if preferred
  };

  // NEW: Close chat function (calls the new backend action)
  const handleCloseChat = async () => {
    if (!activeChatId || isChatClosed) return;
    console.log(`[ChatRoom] Closing chat: ${activeChatId}`);
    const token = await getSessionToken();
    try {
      const res = await fetch(chatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'closeChat',
          [config.sessionToken]: token || '',
          chatId: Number(activeChatId),
        }),
      });
      const json = await res.json();
      if (json.status === "success") {
        console.log('[ChatRoom] Chat closed successfully.');
        setIsChatClosed(true);
        setChatState('closed');
      } else {
        alert(json.message || "Could not close chat");
      }
    } catch (e) {
      console.log("[ChatRoom] Close chat error:", e);
    }
  };

  const renderChatBody = () => (
    <View style={{ flex: 1, backgroundColor: '#F8FAF9' }}>
      {isLoadingMessages ? (
        <ChatSkeleton />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item) => {
            // Ensure a unique key, even if id/client_id are missing.
            // Fallback to a combination of timestamp and a random element.
            const key = item.id || item.client_id || `fallback_${item.timestamp}_${Math.random()}`;
            return String(key);
          }}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: listBottomPadding,
            },
          ]}
          onContentSizeChange={() => {
            if (shouldAutoScroll.current) flatRef.current?.scrollToEnd({ animated: true });
          }}
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - SCROLL_THRESHOLD;
            shouldAutoScroll.current = isAtBottom;
          }}
          initialNumToRender={15}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={({ item }) => {
            const parsed = parseMessageWithLink(item.message || '');
            return (
              <View style={[styles.messageRow, item.sender === 'user' ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
                <Image 
                  source={{ uri: item.sender_image || SYSTEM_IMAGE }} 
                  style={styles.avatar} 
                />
                <View style={[styles.bubble, item.sender === 'user' ? styles.user : styles.ai]}>
                  <Text style={[styles.senderName, { color: item.sender === 'user' ? '#EEE' : '#666' }]}>
                    {item.sender_name || 'Unknown Sender'}
                    {item.isPending && <Text style={styles.pendingBadge}> (pending)</Text>}
                  </Text>
                  {item.image_url && (
                    <Image source={{ uri: item.image_url }} style={styles.msgImg} resizeMode="cover" />
                  )}
                  {item.document_name && (
                    <View style={styles.documentBubble}>
                      <Ionicons name="document-text-outline" size={18} color={BRAND_COLOR} />
                      <Text style={styles.documentBubbleText}>{item.document_name}</Text>
                    </View>
                  )}
                  {parsed.text ? (
                    <Text style={[styles.msgText, { color: item.sender === 'user' ? '#FFF' : '#333' }]}>
                      {parsed.text}
                    </Text>
                  ) : null}
                  {parsed.url && (
                    <TouchableOpacity 
                      onPress={() => Linking.openURL(parsed.url)}
                      style={styles.linkButton}
                    >
                      <Text style={styles.linkButtonText}>{parsed.displayText}</Text>
                    </TouchableOpacity>
                  )}
                  {item.timestamp && (
                    <Text style={styles.timestamp}>
                      {formatTimeAgo(item.timestamp)}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
          ListFooterComponent={() => isAiTyping && (
            <View style={styles.typingIndicatorContainer}>
              <TypingIndicator />
              <Text style={styles.typingText}>{brandConfig.brandName} Support is typing...</Text>
            </View>
          )}
        />
      )}
    </View>
  );

  const renderComposer = () => (
    <Animated.View style={[
      styles.composerContainer,
      { 
        transform: [{ translateY: composerTranslate }],
      }
    ]}
      onLayout={(event) => {
        const nextHeight = Math.ceil(event.nativeEvent.layout.height);
        if (nextHeight > 0 && nextHeight !== composerHeight) {
          setComposerHeight(nextHeight);
        }
      }}
    >
      {(image || selectedDocument) && (
        <View style={styles.preview}>
          {image ? (
            <>
              <Image source={{ uri: image.uri }} style={styles.thumb} />
              <View style={styles.previewTextWrap}>
                <Text style={styles.previewTitle}>Image ready</Text>
                <Text style={styles.previewSubtitle}>{image.fileName || 'Selected image'}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.documentPreviewIcon}>
                <Ionicons name="document-text-outline" size={24} color={BRAND_COLOR} />
              </View>
              <View style={styles.previewTextWrap}>
                <Text style={styles.previewTitle}>Document ready</Text>
                <Text style={styles.previewSubtitle}>{selectedDocument?.name || 'Selected document'}</Text>
              </View>
            </>
          )}
          <TouchableOpacity onPress={() => { setImage(null); setSelectedDocument(null); }} style={styles.closePreview}>
            <Ionicons name="close-circle" size={24} color="red" />
          </TouchableOpacity>
        </View>
      )}
      
      {isChatClosed ? (
  <View 
    style={[
      styles.inputArea, 
      inputPadding,
      styles.closedChatContainer
    ]}
  >
    <Text style={styles.closedChatText}>This chat has been closed.</Text>
    <TouchableOpacity style={styles.newChatButton} onPress={handleStartNewChat}>
      <Text style={styles.newChatButtonText}>Start New Chat</Text>
    </TouchableOpacity>
  </View>
) : (
  <View 
    style={[
      styles.inputArea, 
      inputPadding
    ]}
  >
    <TouchableOpacity onPress={() => setShowAttachmentMenu((prev) => !prev)} style={styles.iconButton} disabled={isChatClosed}>
      <Ionicons name={showAttachmentMenu ? 'close' : 'add-outline'} size={26} color={BRAND_COLOR} />
    </TouchableOpacity>

    {showAttachmentMenu && (
      <View style={styles.attachmentMenu}>
        <TouchableOpacity style={styles.attachmentOption} onPress={pickImage}>
          <Ionicons name="images-outline" size={18} color={BRAND_COLOR} />
          <Text style={styles.attachmentOptionText}>Images</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.attachmentOption} onPress={pickDocument}>
          <Ionicons name="document-text-outline" size={18} color={BRAND_COLOR} />
          <Text style={styles.attachmentOptionText}>Document</Text>
        </TouchableOpacity>
      </View>
    )}

    <TextInput
      style={styles.input}
      value={text}
      onChangeText={setText}
      placeholder={chatState === 'collectingEmail' ? "Enter email..." : "Type your message..."}
      multiline
      placeholderTextColor="#999"
    />

    {showRecordingControls ? (
      <View style={styles.recordingControls}>
        <TouchableOpacity onPress={isRecordingPaused ? resumeRecording : pauseRecording} style={styles.recordControlButton}>
          <Ionicons name={isRecordingPaused ? 'play' : 'pause'} size={16} color={BRAND_COLOR} />
        </TouchableOpacity>
        <TouchableOpacity onPress={stopRecording} style={styles.recordControlButton}>
          <Ionicons name="stop" size={16} color="#DC2626" />
        </TouchableOpacity>
        <TouchableOpacity onPress={stopRecording} style={styles.recordControlButtonPrimary}>
          <Ionicons name="send" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>
    ) : (
      <TouchableOpacity
        onPress={text.trim() || image || selectedDocument ? sendMessage : undefined}
        onLongPress={text.trim() || image || selectedDocument ? undefined : startRecording}
        delayLongPress={140}
        activeOpacity={0.85}
        style={[
          styles.send,
          (!text.trim() && !image && !selectedDocument) ? styles.sendVoice : styles.sendDefault,
          isSending && styles.sendDisabled,
        ]}
        disabled={isSending}
      >
        {isSending ? <ActivityIndicator color="#FFF" /> : (
          <Ionicons name={text.trim() || image || selectedDocument ? 'send' : 'mic'} size={18} color="#FFF" />
        )}
      </TouchableOpacity>
    )}
  </View>
)}
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: '#eff7f4' }]}>
      <ScreenHeader
        title={getHeaderTitle()} 
        backgroundColor="#eff7f4"
        textColor="#1A1A1A"
        iconColor="#1A1A1A"
        onBack={() => navigation.goBack()} 
        rightText={isChatClosed ? undefined : "Close Chat"}
        onRightPress={isChatClosed ? undefined : handleCloseChat}
      /> 

      {/* 
        The KeyboardAvoidingView has been removed. We now use a standard View 
        and rely on the manual Animated.View transform in `renderComposer` 
        for both iOS and Android to ensure consistent behavior.
      */}
      <View style={{ flex: 1 }}>
        {renderChatBody()}
        {renderComposer()}
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  avatarShape: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginHorizontal: 8,
    backgroundColor: SKELETON_FILL,
    alignSelf: 'flex-end',
  },
  bubbleShape: {
    padding: 12,
    borderRadius: 18,
    width: '70%',
    backgroundColor: '#FFF', // Keeping white background for the container to match AI bubble
    borderBottomLeftRadius: 2,
  },
  line: {
    backgroundColor: SKELETON_FILL,
    borderRadius: 4,
  },
});

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
  },
  chatWrapper: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  listContent: { 
    paddingHorizontal: 12, 
    paddingTop: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginHorizontal: 8,
    backgroundColor: '#EEE',
    alignSelf: 'flex-end'
  },
  bubble: { 
    padding: 12, 
    borderRadius: 18, 
    maxWidth: '75%',
    justifyContent: 'center'
  },
  user: { 
    backgroundColor: BRAND_COLOR, 
    borderBottomRightRadius: 2,
    marginLeft: 'auto'
  },
  ai: { 
    backgroundColor: '#FFF', 
    elevation: 1, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 5, 
    borderBottomLeftRadius: 2,
    marginRight: 'auto'
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  pendingBadge: {
    fontSize: 9,
    color: '#DDD',
    fontStyle: 'italic',
  },
  msgText: { 
    fontSize: 14, 
    lineHeight: 21 
  },
  msgImg: { 
    width: 180, 
    height: 140, 
    borderRadius: 10, 
    marginBottom: 8 
  },
  timestamp: {
    fontSize: 10,
    color: '#999',
    marginTop: 6,
    alignSelf: 'flex-end'
  },
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 8,
    justifyContent: 'flex-start',
  },
  customTypingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND_COLOR,
    marginHorizontal: 4,
  },
  typingText: {
    fontSize: 13,
    color: '#777',
    marginLeft: 10,
    fontStyle: 'italic',
    fontWeight: '500'
  },
  composerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  preview: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#F0F2F1',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
  previewTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  previewSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  thumb: { 
    width: 50, 
    height: 50, 
    borderRadius: 10, 
    marginRight: 12,
    backgroundColor: '#EEE'
  },
  documentPreviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E8F2ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closePreview: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentMenu: {
    position: 'absolute',
    left: 10,
    bottom: 76,
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    minWidth: 148,
  },
  attachmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  attachmentOptionText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  inputArea: { 
    flexDirection: 'row', 
    paddingHorizontal: 12, 
    paddingTop: 10,
    backgroundColor: '#FFF', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    borderTopWidth: 0.3, 
    borderTopColor: '#E0E0E0',
  },
  iconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: { 
    flex: 1, 
    marginHorizontal: 8, 
    backgroundColor: '#F5F5F5', 
    borderRadius: 24, 
    paddingHorizontal: 16, 
    paddingVertical: 11, 
    maxHeight: 100,
    fontSize: 15,
    color: '#333',
    textAlignVertical: 'center'
  },
  send: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginLeft: 4
  },
  sendDefault: {
    backgroundColor: BRAND_COLOR,
  },
  sendVoice: {
    backgroundColor: '#DC2626',
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordControlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordControlButtonPrimary: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendDisabled: {
    backgroundColor: '#BDBDBD',
    opacity: 0.6
  },
  // Closed chat UI
  closedChatContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  closedChatText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  newChatButton: {
    backgroundColor: BRAND_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 28,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newChatButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    backgroundColor: BRAND_COLOR,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  linkButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  }
});