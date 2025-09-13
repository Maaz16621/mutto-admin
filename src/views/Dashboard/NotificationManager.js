import React, { useState, useEffect, useMemo } from 'react';
import { Box, Button, Flex, Heading, Textarea, Select, useToast, Input, Table, Thead, Tbody, Tr, Th, Td, InputGroup, InputLeftElement, IconButton, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, useDisclosure } from '@chakra-ui/react';
import { useTable, useGlobalFilter, useSortBy, usePagination } from "react-table";
import { SearchIcon } from "@chakra-ui/icons";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../../firebase";
import Card from 'components/Card/Card.js';
import CardHeader from 'components/Card/CardHeader.js';
import CardBody from 'components/Card/CardBody.js';

export default function NotificationManager() {
  const [notifications, setNotifications] = useState([]);
  const [notification, setNotification] = useState({ title: '', body: '' });
  const [recipientType, setRecipientType] = useState('users');
  const [loading, setLoading] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const [globalFilter, setGlobalFilter] = useState("");

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(firestore, "notifications"));
      const notificationList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notificationList);
    } catch (err) {
      toast({ title: "Error fetching notifications", status: "error", description: err.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleSend = async () => {
    if (!notification.title || !notification.body) {
      toast({ title: 'Title and message are required', status: 'warning', position: 'top-right' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5001/api/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientType: recipientType,
          title: notification.title,
          body: notification.body,
        }),
      });

      if (response.ok) {
        await addDoc(collection(firestore, "notifications"), {
          title: notification.title,
          body: notification.body,
          recipientType: recipientType,
          createdAt: serverTimestamp(),
        });
        toast({ title: 'Notification sent successfully', status: 'success', position: 'top-right' });
        fetchNotifications();
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send notification');
      }
    } catch (error) {
      toast({ title: 'Error sending notification', status: 'error', description: error.message, position: 'top-right' });
    }
    setLoading(false);
  };

  const columns = useMemo(() => [
    {
      Header: "Title",
      accessor: "title",
    },
    {
      Header: "Message",
      accessor: "body",
    },
    {
      Header: "Recipient Type",
      accessor: "recipientType",
    },
    {
      Header: "Date",
      accessor: "createdAt",
      Cell: ({ value }) => value ? new Date(value.seconds * 1000).toLocaleString() : "-",
    },
  ], []);

  const { getTableProps, getTableBodyProps, headerGroups, prepareRow, page, setGlobalFilter: setTableGlobalFilter, state, canPreviousPage, canNextPage, pageOptions, pageCount, gotoPage, nextPage, previousPage, setPageSize } = useTable(
    { columns, data: notifications, initialState: { pageSize: 10 }, autoResetPage: false },
    useGlobalFilter, useSortBy, usePagination
  );

  useEffect(() => {
    setTableGlobalFilter(globalFilter);
  }, [globalFilter, setTableGlobalFilter]);

  return (
    <Flex direction="column" pt={{ base: '120px', md: '75px' }}>
      <Card>
        <CardHeader p="6px 0px 22px 0px">
          <Flex justify="space-between" align="center">
            <Heading size="md">Notification Manager</Heading>
            <Button colorScheme="orange" onClick={onOpen}>Send New Notification</Button>
          </Flex>
        </CardHeader>
        <CardBody>
          <InputGroup maxW="250px" mb={4}>
            <InputLeftElement pointerEvents="none"><SearchIcon color="gray.400" /></InputLeftElement>
            <Input placeholder="Search notifications" value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} />
          </InputGroup>
          <Table {...getTableProps()} variant="simple">
            <Thead>
              {headerGroups.map(headerGroup => (
                <Tr {...headerGroup.getHeaderGroupProps()}>
                  {headerGroup.headers.map(column => (
                    <Th {...column.getHeaderProps(column.getSortByToggleProps())}>
                      {column.render("Header")}{column.isSorted ? (column.isSortedDesc ? " 🔽" : " 🔼") : ""}
                    </Th>
                  ))}
                </Tr>
              ))}
            </Thead>
            <Tbody {...getTableBodyProps()}>
              {page.map(row => {
                prepareRow(row);
                return (
                  <Tr {...row.getRowProps()}>
                    {row.cells.map(cell => <Td {...cell.getCellProps()}>{cell.render("Cell")}</Td>)}
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Send New Notification</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Flex direction="column" gap={4}>
              <Select value={recipientType} onChange={(e) => setRecipientType(e.target.value)}>
                <option value="users">Users</option>
                <option value="workers">Workers</option>
              </Select>
              <Input
                placeholder="Title"
                value={notification.title}
                onChange={(e) => setNotification({ ...notification, title: e.target.value })}
              />
              <Textarea
                placeholder="Message"
                value={notification.body}
                onChange={(e) => setNotification({ ...notification, body: e.target.value })}
              />
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="orange" mr={3} onClick={handleSend} isLoading={loading}>Send</Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
}
