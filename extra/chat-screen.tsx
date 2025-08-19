import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';

const ChatScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { chatId, chatType, userId } = params as { chatId?: string; chatType?: string; userId?: string };
  const { userData } = useUser();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [otherParticipant, setOtherParticipant] = useState(null);
  const [supportChatData, setSupportChatData] = useState(null);

  const handleRetry = async (messageToRetry) => {
    let messagesCollectionRef;
    if (chatType === 'support' && chatId) {
      messagesCollectionRef = collection(db, 'supportChats', chatId, 'messages');
    } else if (userId) {
      const chatRoomId = getChatRoomId(userData.uid, userId);
      messagesCollectionRef = collection(db, 'chats', chatRoomId, 'messages');
    } else {
      return; // No valid chat context
    }

    // Update status to sending again
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg._id === messageToRetry._id ? { ...msg, status: 'sending' } : msg
      )
    );

    try {
      const docRef = await addDoc(messagesCollectionRef, {
        text: messageToRetry.text,
        createdAt: serverTimestamp(),
        senderId: messageToRetry.senderId,
      });

      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg._id === messageToRetry._id ? { ...msg, id: docRef.id, status: 'sent' } : msg
        )
      );
    } catch (error) {
      console.error("Error retrying message:", error);
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg._id === messageToRetry._id ? { ...msg, status: 'failed' } : msg
        )
      );
    }
  };

  useEffect(() => {
    const fetchOtherParticipantData = async () => {
      if (chatType === 'support' && chatId) {
        const chatRef = doc(db, 'supportChats', chatId);
        const unsubscribe = onSnapshot(chatRef, async (docSnap) => {
          if (docSnap.exists()) {
            const chatData = docSnap.data();
            setSupportChatData(chatData); // Set support chat data

            if (chatData.staffId) {
              const staffRef = doc(db, 'staff', chatData.staffId);
              const staffSnap = await getDoc(staffRef);
              if (staffSnap.exists()) {
                setOtherParticipant({ id: staffSnap.id, ...staffSnap.data(), type: 'staff' });
              }
            } else {
              setOtherParticipant({ id: 'pending', name: 'Mutto Support', type: 'pending' }); // Placeholder for pending staff
            }
          } else {
            // setChatStatus('closed'); // Removed
            setOtherParticipant({ id: 'closed', name: 'Chat Closed', type: 'closed' }); // Indicate chat is closed
          }
        });
        return () => unsubscribe();
      } else if (userId) { // Existing customer-worker chat
        // setChatStatus('assigned'); // Removed
        const userRef = doc(db, 'users', userId as string);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setOtherParticipant({ id: userSnap.id, ...userSnap.data(), type: 'user' });
        }
      }
    };

    fetchOtherParticipantData();
  }, [chatId, chatType, userId]);

  useEffect(() => {
    if (userData && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Check if the last message is from the other user and not yet seen
      if (lastMessage.senderId !== userData.uid && !lastMessage.seen) {
        const chatRoomId = getChatRoomId(userData.uid, userId);
        const messageRef = doc(db, "chats", chatRoomId, "messages", lastMessage.id);
        updateDoc(messageRef, { seen: true })
          .then(() => console.log("Message marked as seen"))
          .catch(error => console.error("Error marking message as seen:", error));
      }
    }
  }, [messages, userData, userId]); // Add userId to dependencies

  const getChatRoomId = (userId, workerId) => {
    return [userId, workerId].sort().join('_');
  };

  useEffect(() => {
    if (!userData) return;

    let messagesCollectionRef;
    if (chatType === 'support' && chatId) {
      messagesCollectionRef = collection(db, 'supportChats', chatId, 'messages');
    } else if (userId) {
      const chatRoomId = getChatRoomId(userData.uid, userId);
      messagesCollectionRef = collection(db, 'chats', chatRoomId, 'messages');
    } else {
      return;
    }

    const q = query(messagesCollectionRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(
        snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(), // Ensure createdAt is always a Date object
          };
        })
      );
    });

    return () => unsubscribe();
  }, [userData, userId, chatId, chatType]);

  const handleSend = async () => {
    if (inputText.trim() && userData) {
      // If it's a support chat and currently resolved, change status to pending
      if (chatType === 'support' && chatId && supportChatData?.status === 'resolved') {
        const chatDocRef = doc(db, 'supportChats', chatId);
        await updateDoc(chatDocRef, { status: 'pending' });
      }

      let messagesCollectionRef;
      if (chatType === 'support' && chatId) {
        messagesCollectionRef = collection(db, 'supportChats', chatId, 'messages');
      } else if (userId) {
        const chatRoomId = getChatRoomId(userData.uid, userId);
        messagesCollectionRef = collection(db, 'chats', chatRoomId, 'messages');
      } else {
        return; // No valid chat context
      }

      const tempId = Date.now().toString(); // Temporary ID for optimistic update
      const tempMessage = {
        _id: tempId, // Use _id to avoid conflict with Firestore's 'id'
        text: inputText.trim(),
        createdAt: new Date(), // Client-side timestamp for immediate display
        senderId: userData.uid,
        status: 'sending', // Custom status for optimistic UI
      };

      // Optimistically add the message to the UI
      setMessages(prevMessages => [...prevMessages, tempMessage]);
      setInputText(''); // Clear input immediately

      try {
        const docRef = await addDoc(messagesCollectionRef, {
          text: tempMessage.text,
          createdAt: serverTimestamp(), // Use server timestamp for actual storage
          senderId: tempMessage.senderId,
        });

        // Update the message status and actual ID once confirmed by Firestore
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg._id === tempId ? { ...msg, id: docRef.id, status: 'sent' } : msg
          )
        );
      } catch (error).
        console.error("Error sending message:", error);
        // Update message status to failed if sending fails
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg._id === tempId ? { ...msg, status: 'failed' } : msg
          )
        );
      }
    }
  };

  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  return (
    <SafeAreaProvider>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.customHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          {otherParticipant && (
            <View style={styles.headerCenterContent}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {otherParticipant.type === 'pending'
                    ? '?'
                    : otherParticipant.type === 'staff'
                      ? otherParticipant.name?.charAt(0)
                      : otherParticipant.type === 'closed'
                        ? 'X' // Or some other indicator for closed chat
                        : otherParticipant.username?.charAt(0)}
                </Text>
              </View>
              <View>
                <Text style={styles.workerName}>
                  {otherParticipant.type === 'pending'
                    ? 'Waiting for Staff...'
                    : otherParticipant.type === 'staff'
                      ? otherParticipant.name
                      : otherParticipant.type === 'closed'
                        ? 'Chat Closed'
                        : otherParticipant.username}
                </Text>
                {otherParticipant.type !== 'pending' && otherParticipant.type !== 'closed' && (
                  <Text style={styles.onlineStatus}>
                    {otherParticipant.isOnline ? 'Online' : 'Offline'}
                  </Text>
                )}
              </View>
            </View>
          )}
          <TouchableOpacity style={styles.callButton}>
            <Ionicons name="call-outline" size={24} color="#FF7A00" />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item._id || item.id}
            renderItem={({ item, index }) => (
              <View style={[styles.messageContainer, item.senderId === userData.uid ? styles.userMessageContainer : styles.workerMessageContainer]}>
                <Text style={styles.messageText}>{item.text}</Text>
                <Text style={styles.messageTime}>
                  {item.status === 'sending'
                    ? 'Sending...'
                    : item.createdAt
                      ? (item.createdAt instanceof Date
                        ? item.createdAt
                        : item.createdAt.toDate()
                      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '' // Fallback if createdAt is still null/undefined
                  }
                </Text>
                {item.status === 'failed' && (
                  <TouchableOpacity onPress={() => handleRetry(item)} style={styles.retryButton}>
                    <Ionicons name="refresh-circle-outline" size={20} color="red" />
                  </TouchableOpacity>
                )}
                {/* "Seen" label */}
                {item.senderId === userData.uid && item.seen && index === messages.length - 1 && otherParticipant?.type !== 'pending' && (
                  <Text style={styles.seenLabel}>Seen</Text>
                )}
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 10 }}
          />
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Send message..."
            />
            <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
              <Ionicons name="send" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    justifyContent: 'flex-start',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  headerCenterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    marginRight: 'auto',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF7A00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  workerName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  onlineStatus: {
    fontSize: 12,
    color: '#888',
  },
  backButton: {
    marginLeft: 10,
  },
  callButton: {
    backgroundColor: '#FFEEE5',
    borderRadius: 50,
    padding: 8,
    marginRight: 10,
    alignSelf: 'flex-end',
  },
  messageContainer: {
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    marginHorizontal: 10,
    maxWidth: '80%',
  },
  userMessageContainer: {
    backgroundColor: '#FF7A00',
    alignSelf: 'flex-end',
  },
  workerMessageContainer: {
    backgroundColor: '#F1F1F1',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    color: '#fff',
  },
  messageTime: {
    fontSize: 12,
    color: '#d3d3d3ff',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#F1F1F1',
    borderRadius: 20,
    paddingHorizontal: 15,
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#FF7A00',
    borderRadius: 20,
    padding: 8,
  },
  retryButton: {
    marginLeft: 5,
    alignSelf: 'flex-end', // Align with message time
  },
  seenLabel: {
    fontSize: 10,
    color: '#888',
    alignSelf: 'flex-end',
    marginTop: 2,
  },
});

export default ChatScreen;
