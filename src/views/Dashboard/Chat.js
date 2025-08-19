
import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Flex,
  Text,
  Avatar,
  VStack,
  HStack,
  Input,
  Button,
  Spacer,
  useToast,
  Spinner,
} from "@chakra-ui/react";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, orderBy, addDoc, getDoc } from "firebase/firestore";
import { firestore, auth } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";

// Card components
import Card from "components/Card/Card.js";
import CardBody from "components/Card/CardBody.js";

function Chat() {
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [pendingChats, setPendingChats] = useState([]);
  const [assignedChats, setAssignedChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [senderNames, setSenderNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const toast = useToast();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchUserName = async (uid) => {
    if (!uid) return "Unknown User";
    try {
      const workerDoc = await getDoc(doc(firestore, "workers", uid));
      if (workerDoc.exists()) {
        return workerDoc.data().userName || workerDoc.data().name || "Worker";
      }
      const userDoc = await getDoc(doc(firestore, "users", uid));
      if (userDoc.exists()) {
        return userDoc.data().userName || userDoc.data().name || userDoc.data().username || "User";
      }
    } catch (error) {
      console.error("Error fetching user name:", error);
    }
    return "Unknown User";
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qPending = query(collection(firestore, "supportChats"), where("status", "==", "pending"));
    const unsubscribePending = onSnapshot(qPending, async (snapshot) => {
      const chatsWithNames = await Promise.all(snapshot.docs.map(async doc => {
        const chatData = doc.data();
        let initiatorId = chatData.workerId || chatData.userId;
        let initiatorType = chatData.workerId ? "Worker" : (chatData.userId ? "User" : "Unknown");
        const userName = await fetchUserName(initiatorId);
        return { id: doc.id, ...chatData, userName, initiatorType };
      }));
      setPendingChats(chatsWithNames);
    });

    const qAssigned = query(collection(firestore, "supportChats"), where("status", "==", "assigned"), where("staffId", "==", user.uid));
    const unsubscribeAssigned = onSnapshot(qAssigned, async (snapshot) => {
      const chatsWithNames = await Promise.all(snapshot.docs.map(async doc => {
        const chatData = doc.data();
        let initiatorId = chatData.workerId || chatData.userId;
        let initiatorType = chatData.workerId ? "Worker" : (chatData.userId ? "User" : "Unknown");
        const userName = await fetchUserName(initiatorId);
        return { id: doc.id, ...chatData, userName, initiatorType };
      }));
      setAssignedChats(chatsWithNames);
    });

    return () => {
      unsubscribePending();
      unsubscribeAssigned();
    };
  }, [user]);

  const handleAcceptChat = async (chatId) => {
    if (!user) {
      toast({ title: "Please log in to accept chats.", status: "error", duration: 3000, isClosable: true });
      return;
    }
    try {
      const chatRef = doc(firestore, "supportChats", chatId);
      await updateDoc(chatRef, {
        status: "assigned",
        staffId: user.uid,
        assignedAt: serverTimestamp(),
      });
      toast({ title: "Chat accepted!", status: "success", duration: 3000, isClosable: true });
    } catch (error) {
      console.error("Error accepting chat:", error);
      toast({ title: "Failed to accept chat.", description: error.message, status: "error", duration: 5000, isClosable: true });
    }
  };

  const handleMarkAsResolved = async (chatId) => {
    try {
      const chatRef = doc(firestore, "supportChats", chatId);
      await updateDoc(chatRef, {
        status: "resolved",
        staffId: null,
      });
      toast({ title: "Chat marked as resolved.", status: "success", duration: 3000, isClosable: true });
      setSelectedChatId(null);
    } catch (error) {
      console.error("Error marking chat as resolved:", error);
      toast({ title: "Failed to mark chat as resolved.", description: error.message, status: "error", duration: 5000, isClosable: true });
    }
  };

  const handleSendMessageFirebase = async () => {
    if (messageInput.trim() === "" || !user || !selectedChatId) return;
    try {
      const chatDoc = await getDoc(doc(firestore, "supportChats", selectedChatId));
      if (chatDoc.exists() && chatDoc.data().status === 'resolved') {
        await updateDoc(doc(firestore, "supportChats", selectedChatId), {
          status: 'pending'
        });
      }

      await addDoc(collection(firestore, "supportChats", selectedChatId, "messages"), {
        text: messageInput,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
      setMessageInput("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Failed to send message.", description: error.message, status: "error", duration: 5000, isClosable: true });
    }
  };

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }
    const q = query(collection(firestore, "supportChats", selectedChatId, "messages"), orderBy("createdAt"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      const uniqueSenderIds = [...new Set(msgs.map(msg => msg.senderId))];
      const newSenderNames = {};
      for (const senderId of uniqueSenderIds) {
        if (!senderNames[senderId]) {
          newSenderNames[senderId] = await fetchUserName(senderId);
        }
      }
      if (Object.keys(newSenderNames).length > 0) {
        setSenderNames(prevNames => ({ ...prevNames, ...newSenderNames }));
      }
    });
    return () => unsubscribe();
  }, [selectedChatId]);

  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }} h="100vh">
      <Card h="100%">
        <CardBody h="100%">
          <Flex h="100%" direction={{ base: "column", md: "row" }}>
            {/* Left Column: Chat List */}
            <VStack
              w={{ base: "100%", md: "300px" }}
              h={{ base: "auto", md: "100%" }}
              borderRight={{ base: "none", md: "1px solid lightgray" }}
              pr={{ base: 0, md: 4 }}
              mb={{ base: 4, md: 0 }}
              overflowY="auto"
              spacing={4}
              align="stretch"
            >
              <Box>
                <Text fontSize="lg" fontWeight="semibold" mb="2">Pending Chats</Text>
                {pendingChats.length === 0 ? (
                  <Text fontSize="sm" color="gray.500">No pending support chats.</Text>
                ) : (
                  <VStack spacing="2" align="stretch">
                    {pendingChats.map((chat) => (
                      <HStack
                        key={chat.id}
                        p={2}
                        borderRadius="lg"
                        bg="orange.50"
                        _hover={{ bg: "orange.100", cursor: "pointer" }}
                        align="center"
                        onClick={() => handleAcceptChat(chat.id)}
                      >
                        <Avatar name={chat.userName || "User"} />
                        <Box flex="1">
                          <Text fontWeight="bold">{chat.initiatorType}: {chat.userName || 'N/A'}</Text>
                          <Text fontSize="xs" color="gray.600" noOfLines={1}>
                            Requested: {chat.createdAt?.toDate().toLocaleString()}
                          </Text>
                        </Box>
                        <Button size="sm" colorScheme="orange">
                          Accept
                        </Button>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </Box>
              <Box>
                <Text fontSize="lg" fontWeight="semibold" mb="2">Your Assigned Chats</Text>
                {assignedChats.length === 0 ? (
                  <Text fontSize="sm" color="gray.500">No chats currently assigned to you.</Text>
                ) : (
                  <VStack spacing="2" align="stretch">
                    {assignedChats.map((chat) => (
                      <HStack
                        key={chat.id}
                        p={2}
                        borderRadius="lg"
                        bg={selectedChatId === chat.id ? "blue.50" : "gray.50"}
                        _hover={{ bg: "gray.100", cursor: "pointer" }}
                        onClick={() => setSelectedChatId(chat.id)}
                        align="center"
                      >
                        <Avatar name={chat.userName || "User"} />
                        <Box flex="1">
                          <Text fontWeight="bold">{chat.initiatorType}: {chat.userName || 'N/A'}</Text>
                          <Text fontSize="xs" color="gray.600" noOfLines={1}>
                            Assigned: {chat.assignedAt?.toDate().toLocaleString()}
                          </Text>
                        </Box>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </Box>
            </VStack>

            {/* Right Column: Messages */}
            <Flex flex="1" direction="column" h="100%">
              {selectedChatId ? (
                <>
                  <HStack p={3} borderBottom="1px solid lightgray" mb={4}>
                    <Avatar name={assignedChats.find(chat => chat.id === selectedChatId)?.userName || "User"} />
                    <Text fontWeight="bold" fontSize="lg">
                      Chat with {senderNames[assignedChats.find(chat => chat.id === selectedChatId)?.initiatorId] || "N/A"}
                    </Text>
                    <Spacer />
                    <Button size="sm" colorScheme="green" onClick={() => handleMarkAsResolved(selectedChatId)}>Mark as Resolved</Button>
                    <Button size="sm" onClick={() => setSelectedChatId(null)}>Close Chat</Button>
                  </HStack>
                  <VStack flex="1" overflowY="auto" spacing={3} align="stretch" p={2}>
                    {messages.map((msg) => (
                      <Flex
                        key={msg.id}
                        justify={msg.senderId === user.uid ? "flex-end" : "flex-start"}
                      >
                        <Box
                          bg={msg.senderId === user.uid ? "blue.500" : "gray.200"}
                          color={msg.senderId === user.uid ? "white" : "black"}
                          p={3}
                          borderRadius="lg"
                          maxW="70%"
                        >
                          <Text fontSize="sm">{msg.text}</Text>
                          <Text fontSize="xs" textAlign="right" mt={1}>
                            {msg.createdAt?.toDate().toLocaleTimeString()}
                          </Text>
                        </Box>
                      </Flex>
                    ))}
                    <div ref={messagesEndRef} />
                  </VStack>
                  <HStack my="4" p={2}>
                    <Input
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          handleSendMessageFirebase();
                        }
                      }}
                    />
                    <Button colorScheme="orange" onClick={handleSendMessageFirebase}>
                      Send
                    </Button>
                  </HStack>
                </>
              ) : (
                <Flex justify="center" align="center" h="100%">
                  <Text fontSize="xl" color="gray.500">
                    Select a chat to start messaging
                  </Text>
                </Flex>
              )}
            </Flex>
          </Flex>
        </CardBody>
      </Card>
    </Flex>
  );
}

export default Chat;
