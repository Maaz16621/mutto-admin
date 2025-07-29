import React, { useEffect, useState, useMemo } from "react";
import { Box, Button, Flex, Heading, Input, Table, Thead, Tbody, Tr, Th, Td, InputGroup, InputLeftElement, IconButton, useToast, Spinner, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, useDisclosure, FormControl, FormLabel, Select, Tooltip, Icon, Tag, Menu, MenuButton, MenuList, MenuItem } from "@chakra-ui/react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useTable, useGlobalFilter, useSortBy, usePagination, useFilters } from "react-table";
import { SearchIcon } from "@chakra-ui/icons";
import { collection, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../../firebase";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody.js";

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [form, setForm] = useState({ customerName: "", service: "", date: "", status: "pending", staff: "", price: "" });
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(firestore, "bookings"));
      const bookingsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBookings(bookingsList);
    } catch (err) {
      toast({ title: "Error fetching bookings", status: "error", description: err.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleSave = async () => {
    if (!form.customerName || !form.service) {
      toast({ title: "Customer Name and Service required", status: "warning", position: "top-right" });
      return;
    }
    setLoading(true);
    try {
      if (selectedBooking) {
        const updateData = { ...form };
        await updateDoc(doc(firestore, "bookings", selectedBooking.id), updateData);
        toast({ title: "Booking updated", position: "top-right" });
      }
      fetchBookings();
      onClose();
      setForm({ customerName: "", service: "", date: "", status: "pending", staff: "", price: "" });
      setSelectedBooking(null);
    } catch (err) {
      toast({ title: "Error saving booking", status: "error", description: err.message, position: "top-right" });
    }
    setLoading(false);
  };

  const openEdit = (booking) => {
    setSelectedBooking(booking);
    setForm(booking
      ? {
          customerName: booking.customerName || "",
          service: booking.service || "",
          date: booking.date?.seconds ? new Date(booking.date.seconds * 1000).toISOString().substring(0, 16) : "",
          status: booking.status || "pending",
          staff: booking.staff || "",
          price: booking.price || "",
        }
      : { customerName: "", service: "", date: "", status: "pending", staff: "", price: "" }
    );
    onOpen();
  };

  const columns = useMemo(() => [
    { Header: "Customer", accessor: "customerName" },
    { Header: "Service", accessor: "service" },
    { Header: "Date", accessor: "date", Cell: ({ value }) => value ? new Date(value.seconds * 1000).toLocaleString() : "-" },
    { Header: "Assigned Staff", accessor: "staff" },
    { Header: "Price", accessor: "price", Cell: ({ value }) => value ? `$${value}`: "-" },
    { Header: "Status", accessor: "status", Cell: ({value}) => <Tag colorScheme={value === 'completed' ? 'green' : value === 'pending' ? 'orange' : 'red'}>{value}</Tag> },
    {
      Header: "Actions",
      id: "actions",
      Cell: ({ row }) => (
        <Menu>
          <MenuButton as={IconButton} aria-label="Options" icon={<BsThreeDotsVertical />} variant="ghost" />
          <MenuList>
            <MenuItem onClick={() => openEdit(row.original)}>Edit</MenuItem>
          </MenuList>
        </Menu>
      ),
    },
  ], []);

  const filteredData = useMemo(() => {
    let data = bookings;
    if (statusFilter) data = data.filter(row => row.status === statusFilter);
    if (globalFilter) {
      const lower = globalFilter.toLowerCase();
      data = data.filter(row =>
        row.customerName?.toLowerCase().includes(lower) ||
        row.service?.toLowerCase().includes(lower) ||
        row.staff?.toLowerCase().includes(lower)
      );
    }
    return data;
  }, [bookings, statusFilter, globalFilter]);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page,
    setGlobalFilter: setTableGlobalFilter,
    state,
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
  } = useTable(
    { columns, data: filteredData, initialState: { pageSize: 10 }, autoResetPage: false },
    useGlobalFilter, useFilters, useSortBy, usePagination
  );

  useEffect(() => {
    setTableGlobalFilter(globalFilter);
  }, [globalFilter, setTableGlobalFilter]);

  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }}>
      <Card overflowX={{ sm: "scroll", xl: "hidden" }} pb="0px">
        <CardHeader p="6px 0px 22px 0px">
          <Flex justify="space-between" align="center">
            <Heading size="md">Bookings</Heading>
          </Flex>
        </CardHeader>
        <CardBody>
          <Flex mb={4} gap={4} flexWrap="wrap" align="center" justify="space-between">
            <InputGroup maxW="250px" boxShadow="sm">
              <InputLeftElement pointerEvents="none"><SearchIcon color="gray.400" /></InputLeftElement>
              <Input placeholder="Search by customer, service, or staff" value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} size="sm" bg="white" borderRadius="md" />
            </InputGroup>
            <FormControl minW="150px" maxW="200px">
              <FormLabel fontSize="xs" mb={1} color="gray.600">Status</FormLabel>
              <Select placeholder="All Statuses" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} size="sm" bg="white" borderRadius="md" boxShadow="sm">
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </FormControl>
          </Flex>
          {loading ? <Flex justify="center" align="center" minH="100px"><Spinner size="lg" /></Flex> : (
            <Table {...getTableProps()} variant="simple">
              <Thead>
                {headerGroups.map(headerGroup => (
                  <Tr {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map(column => (
                      <Th {...column.getHeaderProps(column.getSortByToggleProps())}>
                        {column.render("Header")}
                        {column.isSorted ? (column.isSortedDesc ? " 🔽" : " 🔼") : ""}
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
          )}
          {!loading && pageOptions.length > 1 && (
            <Flex mt={4} align="center" justify="flex-end" gap={2}>
              <Button size="sm" onClick={() => gotoPage(0)} disabled={!canPreviousPage}>&lt;&lt;</Button>
              <Button size="sm" onClick={() => previousPage()} disabled={!canPreviousPage}>&lt;</Button>
              <Box>Page {state.pageIndex + 1} of {pageOptions.length}</Box>
              <Button size="sm" onClick={() => nextPage()} disabled={!canNextPage}>&gt;</Button>
              <Button size="sm" onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>&gt;&gt;</Button>
              <Select size="sm" value={state.pageSize} onChange={e => setPageSize(Number(e.target.value))} w="auto" ml={2}>
                {[10, 20, 30, 40, 50].map(pageSize => <option key={pageSize} value={pageSize}>Show {pageSize}</option>)}
              </Select>
            </Flex>
          )}
        </CardBody>
      </Card>

      {isOpen && (
        <Modal isOpen={isOpen} onClose={onClose} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Edit Booking</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <FormControl mb={3} isRequired>
                <FormLabel>Customer Name</FormLabel>
                <Input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
              </FormControl>
              <FormControl mb={3} isRequired>
                <FormLabel>Service</FormLabel>
                <Input value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Date</FormLabel>
                <Input type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Assigned Staff</FormLabel>
                <Input value={form.staff} onChange={e => setForm(f => ({ ...f, staff: e.target.value }))} />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Price</FormLabel>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Status</FormLabel>
                <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="orange" mr={3} onClick={handleSave} isLoading={loading}>Save</Button>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </Flex>
  );
}