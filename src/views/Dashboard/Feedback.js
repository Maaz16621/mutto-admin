import React, { useEffect, useState } from "react";
import {
  Flex,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Spinner,
  Avatar,
  Text,
  useToast,
  Tag,
  Wrap,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Box,
  HStack,
} from "@chakra-ui/react";
import { StarIcon } from "@chakra-ui/icons";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { firestore } from "../../firebase";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody";

export default function Feedback() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(firestore, "feedback"));
      const feedbackList = await Promise.all(
        querySnapshot.docs.map(async (docSnap) => {
          const fb = { id: docSnap.id, ...docSnap.data() };

          // Fetch booking details
          let bookingData = null;
          if (fb.bookingId) {
            const bookingRef = doc(firestore, "bookings", fb.bookingId);
            const bookingSnap = await getDoc(bookingRef);
            if (bookingSnap.exists()) bookingData = bookingSnap.data();
          }

          // Fetch worker details
          let workerData = null;
          if (fb.workerId) {
            const workerRef = doc(firestore, "workers", fb.workerId);
            const workerSnap = await getDoc(workerRef);
            if (workerSnap.exists()) workerData = workerSnap.data();
          }

          return {
            ...fb,
            booking: bookingData,
            worker: workerData,
          };
        })
      );

      setFeedbacks(feedbackList);
    } catch (err) {
      toast({
        title: "Error fetching feedback",
        status: "error",
        description: err.message,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const renderStars = (rating = 0) => {
    return (
      <HStack spacing={1}>
        {[...Array(5)].map((_, i) => (
          <StarIcon
            key={i}
            color={i < rating ? "yellow.400" : "gray.300"}
            boxSize={4}
          />
        ))}
      </HStack>
    );
  };

  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }}>
      <Card overflowX={{ sm: "scroll", xl: "hidden" }} pb="0px">
        <CardHeader p="6px 0px 22px 0px">
          <Flex justify="space-between" align="center">
            <Heading size="md">User Feedback</Heading>
          </Flex>
        </CardHeader>
        <CardBody>
          {loading ? (
            <Flex justify="center" align="center" minH="100px">
              <Spinner size="lg" />
            </Flex>
          ) : (
            <Table variant="simple" size="md">
              <Thead>
                <Tr>
                  <Th>User</Th>
                  <Th>Worker</Th>
                  <Th>Service</Th>
                  <Th>Booking Time</Th>
                  <Th>Address</Th>
                  <Th>Rating</Th>
                  <Th>Tags</Th>
                  <Th>Created</Th>
                  <Th>Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {feedbacks.length === 0 ? (
                  <Tr>
                    <Td colSpan={9}>
                      <Text textAlign="center">No feedback available.</Text>
                    </Td>
                  </Tr>
                ) : (
                  feedbacks.map((fb) => {
                    const booking = fb.booking;
                    const worker = fb.worker;

                    return (
                      <Tr key={fb.id}>
                        {/* User */}
                        <Td>
                          <Flex align="center" gap="3">
                            <Avatar
                              size="sm"
                              src={fb.userImage}
                              name={fb.userName}
                            />
                            <Text>{fb.userName || "Unknown"}</Text>
                          </Flex>
                        </Td>

                        {/* Worker */}
                        <Td>{worker?.name || fb.workerName || "N/A"}</Td>

                        {/* Service Name */}
                        <Td>{booking?.serviceName || "N/A"}</Td>

                        {/* Booking Time */}
                        <Td>
                          {booking
                            ? `${booking.selectedDate || ""} ${
                                booking.selectedTime || ""
                              }`
                            : "-"}
                        </Td>

                        {/* Address */}
                        <Td>{booking?.selectedAddress?.address || "No address"}</Td>

                        {/* Job Rating as Stars */}
                        <Td>{renderStars(fb.jobRating)}</Td>

                        {/* Tags */}
                        <Td>
                          {fb.tags && fb.tags.length > 0 ? (
                            <Wrap>
                              {fb.tags.map((tag, i) => (
                                <Tag
                                  key={i}
                                  colorScheme="blue"
                                  borderRadius="full"
                                >
                                  {tag}
                                </Tag>
                              ))}
                            </Wrap>
                          ) : (
                            "-"
                          )}
                        </Td>

                        {/* Created At */}
                        <Td>
                          {fb.createdAt
                            ? new Date(
                                fb.createdAt.seconds * 1000
                              ).toLocaleString()
                            : "-"}
                        </Td>

                        {/* View Details */}
                        <Td>
                          <Button
                            size="sm"
                            colorScheme="teal"
                            onClick={() => {
                              setSelectedFeedback(fb);
                              onOpen();
                            }}
                          >
                            View Details
                          </Button>
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Details Modal */}
      {selectedFeedback && (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Feedback Details</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Box>
                <Heading size="sm" mb={2}>
                  User Info
                </Heading>
                <Flex align="center" gap="3" mb={3}>
                  <Avatar
                    src={selectedFeedback.userImage}
                    name={selectedFeedback.userName}
                  />
                  <Text>{selectedFeedback.userName || "Unknown"}</Text>
                </Flex>

                <Heading size="sm" mb={2}>
                  Worker Info
                </Heading>
                <Text>Name: {selectedFeedback.worker?.name || "N/A"}</Text>
                <Text>
                  Phone: {selectedFeedback.worker?.phoneNumber || "N/A"}
                </Text>

                <Heading size="sm" mt={4} mb={2}>
                  Booking Info
                </Heading>
                <Text>
                  Service: {selectedFeedback.booking?.serviceName || "N/A"}
                </Text>
                <Text>
                  Date & Time:{" "}
                  {selectedFeedback.booking
                    ? `${selectedFeedback.booking.selectedDate || ""} ${
                        selectedFeedback.booking.selectedTime || ""
                      }`
                    : "-"}
                </Text>
                <Text>
                  Address:{" "}
                  {selectedFeedback.booking?.selectedAddress?.address ||
                    "No address"}
                </Text>

                <Heading size="sm" mt={4} mb={2}>
                  Feedback
                </Heading>
                {renderStars(selectedFeedback.jobRating)}
                <Text mt={2}>{selectedFeedback.message || "No message"}</Text>
                {selectedFeedback.tags?.length > 0 && (
                  <Wrap mt={3}>
                    {selectedFeedback.tags.map((tag, i) => (
                      <Tag key={i} colorScheme="blue">
                        {tag}
                      </Tag>
                    ))}
                  </Wrap>
                )}
              </Box>
            </ModalBody>
            <ModalFooter>
              <Button onClick={onClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </Flex>
  );
}
