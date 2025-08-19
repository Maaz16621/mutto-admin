import React, { useState, useEffect } from "react";
import { Box, Text, Flex, Button, useToast, Spinner, VStack, HStack, Spacer, Input } from "@chakra-ui/react";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, orderBy, addDoc } from "firebase/firestore";
import { firestore, auth } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";

function SupportChatManagement() {
  const [pendingChats, setPendingChats] = useState([]);
  const [assignedChats, setAssignedChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const toast = useToast();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listener for pending chats
    const qPending = query(collection(firestore, "supportChats"), where("status", "==", "pending"));
    const unsubscribePending = onSnapshot(qPending, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendingChats(chats);
    });

    // Listener for assigned chats (to current staff member)
    const qAssigned = query(collection(firestore, "supportChats"), where("status", "==", "assigned"), where("staffId", "==", user.uid));
    const unsubscribeAssigned = onSnapshot(qAssigned, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssignedChats(chats);
    });

    return () => { unsubscribePending(); unsubscribeAssigned(); };
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

  const handleSendMessage = async () => {
    if (newMessage.trim() === "" || !user || !selectedChatId) return;

    try {
      await addDoc(collection(firestore, "supportChats", selectedChatId, "messages"), {
        text: newMessage,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
      setNewMessage("");
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
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [selectedChatId]);

  if (loading) {
    return (
      <Flex justify="center" align="center" h="100vh">
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (!user) {
    return (
      <Flex justify="center" align="center" h="100vh">
        <Text>Please log in to access support chat management.</Text>
      </Flex>
    );
  }

  if (selectedChatId) {
    const currentChat = assignedChats.find(chat => chat.id === selectedChatId);
    return (
      <Box pt={{ base: "120px", md: "75px" }}>
        <Flex mb="4" alignItems="center">
          <Button onClick={() => setSelectedChatId(null)} mr="4">Back to Chats</Button>
          <Text fontSize="xl" fontWeight="bold">Chat with Worker: {currentChat?.workerId || "N/A"}</Text>
        </Flex>

        <VStack spacing="4" align="stretch" mb="4" maxHeight="60vh" overflowY="auto">
          {messages.map((msg) => (
            <Flex key={msg.id} justify={msg.senderId === user.uid ? "flex-end" : "flex-start"}>
              <Box
                bg={msg.senderId === user.uid ? "blue.500" : "gray.200"}
                color={msg.senderId === user.uid ? "white" : "black"}
                p="3"
                borderRadius="lg"
                maxWidth="70%"
              >
                <Text>{msg.text}</Text>
                <Text fontSize="xs" color={msg.senderId === user.uid ? "blue.100" : "gray.600"} mt="1">
                  {msg.createdAt?.toDate().toLocaleString()}
                </Text>
              </Box>
            </Flex>
          ))}
        </VStack>

        <HStack>
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleSendMessage();
              }
            }}
          />
          <Button colorScheme="blue" onClick={handleSendMessage}>Send</Button>
        </HStack>
      </Box>
    );
  }

  return (
    <Box pt={{ base: "120px", md: "75px" }}>
      <Text fontSize="xl" fontWeight="bold" mb="4">Support Chat Management</Text>

      <Box mb="8">
        <Text fontSize="lg" fontWeight="semibold" mb="4">Pending Chats</Text>
        {pendingChats.length === 0 ? (
          <Text>No pending support chats.</Text>
        ) : (
          <VStack spacing="4" align="stretch">
            {pendingChats.map((chat) => (
              <Box key={chat.id} p="4" borderWidth="1px" borderRadius="lg" boxShadow="md">
                <HStack>
                  <Text fontWeight="bold">Chat ID: {chat.id}</Text>
                  <Spacer />
                  <Text fontSize="sm" color="gray.500">Requested: {chat.createdAt?.toDate().toLocaleString()}</Text>
                </HStack>
                <Text>Worker ID: {chat.workerId || 'N/A'}</Text>
                <Text>Status: {chat.status}</Text>
                <Button mt="2" colorScheme="orange" onClick={() => handleAcceptChat(chat.id)}>
                  Accept Chat
                </Button>
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb="4">Your Assigned Chats</Text>
        {assignedChats.length === 0 ? (
          <Text>No chats currently assigned to you.</Text>
        ) : (
          <VStack spacing="4" align="stretch">
            {assignedChats.map((chat) => (
              <Box key={chat.id} p="4" borderWidth="1px" borderRadius="lg" boxShadow="md">
                <HStack>
                  <Text fontWeight="bold">Chat ID: {chat.id}</Text>
                  <Spacer />
                  <Text fontSize="sm" color="gray.500">Assigned: {chat.assignedAt?.toDate().toLocaleString()}</Text>
                </HStack>
                <Text>Worker ID: {chat.workerId || 'N/A'}</Text>
                <Text>Status: {chat.status}</Text>
                <Button mt="2" colorScheme="blue" onClick={() => setSelectedChatId(chat.id)}>
                  Open Chat
                </Button>
              </Box>
            ))}
          </VStack>
        )}
      </Box>
    </Box>
  );
}

export default SupportChatManagement;
