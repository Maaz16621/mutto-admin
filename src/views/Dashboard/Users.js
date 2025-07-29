
import React, { useEffect, useState, useMemo } from "react";
import { Box, Button, Flex, Heading, Input, Table, Thead, Tbody, Tr, Th, Td, InputGroup, InputLeftElement, IconButton, useToast, Spinner, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, useDisclosure, FormControl, FormLabel, Select, Tooltip, Icon, Tag, Menu, MenuButton, MenuList, MenuItem } from "@chakra-ui/react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useTable, useGlobalFilter, useSortBy, usePagination, useFilters } from "react-table";
import { SearchIcon } from "@chakra-ui/icons";
import { collection, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { firestore } from "../../firebase";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody.js";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState({ fullName: "", email: "", phoneNumber: "", status: "active" });
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(firestore, "users"));
      const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    } catch (err) {
      toast({ title: "Error fetching users", status: "error", description: err.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSave = async () => {
    if (!form.fullName || !form.email) {
      toast({ title: "Full Name and Email required", status: "warning", position: "top-right" });
      return;
    }
    setLoading(true);
    try {
      if (selectedUser) {
        const updateData = { ...form };
        await updateDoc(doc(firestore, "users", selectedUser.id), updateData);
        toast({ title: "User updated", position: "top-right" });
      }
      fetchUsers();
      onClose();
      setForm({ fullName: "", email: "", phoneNumber: "", status: "active" });
      setSelectedUser(null);
    } catch (err) {
      toast({ title: "Error saving user", status: "error", description: err.message, position: "top-right" });
    }
    setLoading(false);
  };

  const openEdit = (user) => {
    setSelectedUser(user);
    setForm(user
      ? {
          fullName: user.fullName || "",
          email: user.email || "",
          phoneNumber: user.phoneNumber || "",
          status: user.status || "active",
        }
      : { fullName: "", email: "", phoneNumber: "", status: "active" }
    );
    onOpen();
  };

  const handleDelete = async () => {
    const user = deleteModal.user;
    if (!user) return;
    setLoading(true);
    try {
      await deleteDoc(doc(firestore, "users", user.id));
      toast({ title: "User deleted", status: "success", position: "top-right" });
      fetchUsers();
    } catch (err) {
      toast({ title: "Error deleting user", description: err.message, status: "error", position: "top-right" });
    }
    setDeleteModal({ open: false, user: null });
    setLoading(false);
  };

  const columns = useMemo(() => [
    { Header: "Full Name", accessor: "fullName" },
    { Header: "Email", accessor: "email" },
    { Header: "Phone Number", accessor: "phoneNumber" },
    { Header: "Status", accessor: "status", Cell: ({value}) => <Tag colorScheme={value === 'active' ? 'green' : 'red'}>{value}</Tag> },
    {
      Header: "Actions",
      id: "actions",
      Cell: ({ row }) => (
        <Menu>
          <MenuButton as={IconButton} aria-label="Options" icon={<BsThreeDotsVertical />} variant="ghost" />
          <MenuList>
            <MenuItem onClick={() => openEdit(row.original)}>Edit</MenuItem>
            <MenuItem onClick={() => setDeleteModal({ open: true, user: row.original })}>Delete</MenuItem>
          </MenuList>
        </Menu>
      ),
    },
  ], []);

  const filteredData = useMemo(() => {
    let data = users;
    if (statusFilter) data = data.filter(row => row.status === statusFilter);
    if (globalFilter) {
      const lower = globalFilter.toLowerCase();
      data = data.filter(row =>
        row.fullName?.toLowerCase().includes(lower) ||
        row.email?.toLowerCase().includes(lower)
      );
    }
    return data;
  }, [users, statusFilter, globalFilter]);

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
            <Heading size="md">Users</Heading>
          </Flex>
        </CardHeader>
        <CardBody>
          <Flex mb={4} gap={4} flexWrap="wrap" align="center" justify="space-between">
            <InputGroup maxW="250px" boxShadow="sm">
              <InputLeftElement pointerEvents="none"><SearchIcon color="gray.400" /></InputLeftElement>
              <Input placeholder="Search by name or email" value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} size="sm" bg="white" borderRadius="md" />
            </InputGroup>
            <FormControl minW="150px" maxW="200px">
              <FormLabel fontSize="xs" mb={1} color="gray.600">Status</FormLabel>
              <Select placeholder="All Statuses" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} size="sm" bg="white" borderRadius="md" boxShadow="sm">
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
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
            <ModalHeader>Edit User</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <FormControl mb={3} isRequired>
                <FormLabel>Full Name</FormLabel>
                <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </FormControl>
              <FormControl mb={3} isRequired>
                <FormLabel>Email</FormLabel>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Phone Number</FormLabel>
                <Input value={form.phoneNumber} onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Status</FormLabel>
                <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
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

      {deleteModal.open && (
        <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, user: null })} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Delete User</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              Are you sure you want to delete user <b>{deleteModal.user?.fullName || deleteModal.user?.email}</b>? This cannot be undone.
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="red" mr={3} onClick={handleDelete} isLoading={loading}>Delete</Button>
              <Button variant="ghost" onClick={() => setDeleteModal({ open: false, user: null })}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </Flex>
  );
}
