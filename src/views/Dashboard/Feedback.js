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
  Link,
  Text,
  useToast,
} from "@chakra-ui/react";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "../../firebase";
import { Link as RouterLink } from "react-router-dom";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody";

export default function Feedback() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(firestore, "feedbacks"));
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFeedbacks(data);
    } catch (err) {
      toast({
        title: "Error fetching feedbacks",
        status: "error",
        description: err.message,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

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
                  <Th>Booking Number</Th>
                  <Th>Rating</Th>
                  <Th>Feedback Text</Th>
                  <Th>Time</Th>
                </Tr>
              </Thead>
              <Tbody>
                {feedbacks.length === 0 ? (
                  <Tr>
                    <Td colSpan={4}>
                      <Text textAlign="center">No feedback available.</Text>
                    </Td>
                  </Tr>
                ) : (
                  feedbacks.map((fb) => (
                    <Tr key={fb.id}>
                      <Td>
                        <Link
                          as={RouterLink}
                          to={`/dashboard/booking/${fb.bookingNumber}`}
                          color="blue.500"
                          textDecoration="underline"
                        >
                          {fb.bookingNumber}
                        </Link>
                      </Td>
                      <Td>{fb.rating}</Td>
                      <Td>{fb.text}</Td>
                      <Td>{fb.time ? new Date(fb.time.seconds * 1000).toLocaleString() : "-"}</Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </Flex>
  );
}
