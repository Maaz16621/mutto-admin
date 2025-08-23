
import React, { useEffect, useState } from "react";
import {
  Box,
  Flex,
  Heading,
  Spinner,
  Text,
  VStack,
  Divider,
} from "@chakra-ui/react";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { firestore } from "../../firebase";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const fetchNotifications = async () => {
          setLoading(true);
          try {
            const notificationsCollection = collection(firestore, "notifications");
            const q = query(
              notificationsCollection,
              where("userId", "==", user.uid),
              orderBy("createdAt", "desc")
            );
            const querySnapshot = await getDocs(q);
            setNotifications(
              querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
            );
            console.log("notifications", querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
          } catch (error) {
            console.error("Error fetching notifications:", error);
          }
          setLoading(false);
        };
        fetchNotifications();
      } else {
        setNotifications([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }}>
      <Card>
        <CardBody>
          <Heading size="lg" mb={4}>
            Notifications
          </Heading>
          {loading ? (
            <Flex justify="center" align="center" minH="200px">
              <Spinner size="xl" />
            </Flex>
          ) : (
            <VStack divider={<Divider />} spacing={4} align="stretch">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <Box key={notification.id} p={4} shadow="md" borderWidth="1px" borderRadius="md">
                    <Heading size="md">{notification.title}</Heading>
                    <Text mt={2}>{notification.body}</Text>
                    <Text fontSize="sm" color="gray.500" mt={2}>
                      {new Date(notification.createdAt?.toDate()).toLocaleString()}
                    </Text>
                  </Box>
                ))
              ) : (
                <Text>No notifications found.</Text>
              )}
            </VStack>
          )}
        </CardBody>
      </Card>
    </Flex>
  );
}
