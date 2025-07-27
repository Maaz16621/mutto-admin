
import React, { useState } from "react";
import {
  Box,
  Grid,
  Flex,
  Text,
  Avatar,
  VStack,
  HStack,
  Input,
  Button,
  Spacer,
} from "@chakra-ui/react";

// Card components
import Card from "components/Card/Card.js";
import CardBody from "components/Card/CardBody.js";
import CardHeader from "components/Card/CardHeader.js";

function Chat() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [messageInput, setMessageInput] = useState("");

  // Dummy Data for Chat List
  const chatList = [
    {
      id: "1",
      name: "Alice Smith",
      avatar: "https://i.pravatar.cc/150?img=1",
      lastMessage: "Hey, how are you?",
      messages: [
        { id: "m1", sender: "Alice Smith", text: "Hey, how are you?", time: "10:00 AM" },
        { id: "m2", sender: "You", text: "I'm good, thanks! How about you?", time: "10:05 AM" },
        { id: "m3", sender: "Alice Smith", text: "Doing great!", time: "10:10 AM" },
      ],
    },
    {
      id: "2",
      name: "Bob Johnson",
      avatar: "https://i.pravatar.cc/150?img=2",
      lastMessage: "See you tomorrow!",
      messages: [
        { id: "m4", sender: "Bob Johnson", text: "Are we meeting tomorrow?", time: "Yesterday" },
        { id: "m5", sender: "You", text: "Yes, at 2 PM.", time: "Yesterday" },
        { id: "m6", sender: "Bob Johnson", text: "Great! See you then.", time: "Yesterday" },
      ],
    },
    {
      id: "3",
      name: "Charlie Brown",
      avatar: "https://i.pravatar.cc/150?img=3",
      lastMessage: "Don't forget the report.",
      messages: [
        { id: "m7", sender: "Charlie Brown", text: "Did you finish the report?", time: "1 week ago" },
        { id: "m8", sender: "You", text: "Almost, just a few more edits.", time: "1 week ago" },
      ],
    },
  ];

  const handleSendMessage = () => {
    if (messageInput.trim() === "" || !selectedChat) return;

    const newMessage = {
      id: `m${selectedChat.messages.length + 1}`,
      sender: "You", // Assuming "You" are sending the message
      text: messageInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Update the selected chat's messages (in a real app, this would update backend)
    setSelectedChat((prevChat) => ({
      ...prevChat,
      messages: [...prevChat.messages, newMessage],
    }));

    // Update the last message in the chat list
    const updatedChatList = chatList.map((chat) =>
      chat.id === selectedChat.id
        ? { ...chat, lastMessage: messageInput.trim() }
        : chat
    );
    // In a real app, you'd update the actual chatList state or context
    // For this dummy data, we're just updating selectedChat's messages.

    setMessageInput("");
  };

  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }}>
      <Card overflowX={{ sm: "scroll", xl: "hidden" }} >
       
        <CardBody>
          <Grid templateColumns="0.3fr 1fr" gap={6} h="70vh">
            {/* Left Column: User List */}
            <VStack align="stretch" spacing={2} borderRight="1px solid lightgray" pr={4}>
              {chatList.map((chat) => (
                <HStack
                  key={chat.id}
                  p={3}
                  borderRadius="lg"
                  bg={selectedChat?.id === chat.id ? "orange.100" : "gray.50"}
                  _hover={{ bg: "gray.100", cursor: "pointer" }}
                  onClick={() => setSelectedChat(chat)}
                  align="center"
                >
                  <Avatar src={chat.avatar} name={chat.name} />
                  <Box>
                    <Text fontWeight="bold">{chat.name}</Text>
                    <Text fontSize="sm" color="gray.600" noOfLines={1}>
                      {chat.lastMessage}
                    </Text>
                  </Box>
                </HStack>
              ))}
            </VStack>

            {/* Right Column: Messages */}
            <Flex direction="column" h="100%">
              {selectedChat ? (
                <>
                  <HStack p={3} borderBottom="1px solid lightgray" mb={4}>
                    <Avatar src={selectedChat.avatar} name={selectedChat.name} />
                    <Text fontWeight="bold" fontSize="lg">
                      {selectedChat.name}
                    </Text>
                  </HStack>
                  <VStack flex="1" overflowY="auto" spacing={3} align="stretch" p={2}>
                    {selectedChat.messages.map((msg) => (
                      <Flex
                        key={msg.id}
                        justify={msg.sender === "You" ? "flex-end" : "flex-start"}
                      >
                        <Box
                          bg={msg.sender === "You" ? "orange.400" : "gray.200"}
                          color={msg.sender === "You" ? "white" : "black"}
                          p={3}
                          borderRadius="lg"
                          maxW="70%"
                        >
                          <Text fontSize="sm">{msg.text}</Text>
                          <Text fontSize="xs" textAlign="right" mt={1}>
                            {msg.time}
                          </Text>
                        </Box>
                      </Flex>
                    ))}
                  </VStack>
                  <HStack mt={4}>
                    <Input
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button colorScheme="orange" onClick={handleSendMessage}>
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
          </Grid>
        </CardBody>
      </Card>
    </Flex>
  );
}

export default Chat;
