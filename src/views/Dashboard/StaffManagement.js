
import React, { useEffect, useState, useMemo } from "react";
import { Box, Button, Flex, Heading, Input, Table, Thead, Tbody, Tr, Th, Td, InputGroup, InputLeftElement, IconButton, useToast, Spinner, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, useDisclosure, FormControl, FormLabel, Select, Tooltip, Icon, Checkbox, VStack, Menu, MenuButton, MenuList, MenuItem, Tag } from "@chakra-ui/react";
import { BsThreeDotsVertical } from "react-icons/bs";

import { useTable, useGlobalFilter, useSortBy, usePagination, useFilters } from "react-table";
import { SearchIcon } from "@chakra-ui/icons";
import { collection, getDocs, addDoc, updateDoc, doc, query, where, serverTimestamp, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { auth } from "../../firebase";
import { firestore } from "../../firebase";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody";

const API_BASE_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:5001' : 'https://api.yourdomain.com';
export default function StaffManagement() {
  console.log("StaffManagement component rendering...");
  const [deleteModal, setDeleteModal] = useState({ open: false, staff: null });
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [form, setForm] = useState({ userName: "", email: "", password: "", status: "active", permissions: [] });

  const handlePermissionChange = (permission, isChecked) => {
    setForm(prevForm => {
      const newPermissions = isChecked
        ? [...prevForm.permissions, permission]
        : prevForm.permissions.filter(p => p !== permission);
      return { ...prevForm, permissions: newPermissions };
    });
  };
  const [globalFilter, setGlobalFilter] = useState("");
  
  const [statusFilter, setStatusFilter] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();




  // Fetch staff (excluding admin)
  const fetchStaff = async () => {
    console.log("fetchStaff called.");
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(firestore, "staff"));
      const staffList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStaff(staffList);
      console.log("Staff fetched successfully:", staffList);
    } catch (err) {
      console.error("Error fetching staff:", err);
      toast({ title: "Error fetching staff", status: "error", description: err.message });
    }
    setLoading(false);
    console.log("Loading set to false.");
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Add or update staff
  const handleSave = async () => {
    if (!form.userName || !form.email || (!selectedStaff && !form.password)) {
      toast({ title: "User Name, Email, and Password required", status: "warning", position: "top-right" });
      return;
    }
    if (!selectedStaff && form.permissions.length === 0) {
      toast({ title: "Please select at least one permission.", status: "warning", position: "top-right" });
      return;
    }
    setLoading(true);
    try {
      if (selectedStaff) {
        // Edit staff (no password change)
        const updateData = { ...form };
        delete updateData.password;
        await updateDoc(doc(firestore, "staff", selectedStaff.id), updateData);
        toast({ title: "Staff updated", position: "top-right" });
      } else {
        // Add staff: create user in Firebase Auth, then Firestore (with auth.uid as doc id)
        const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
        const user = userCredential.user;
        await setDoc(doc(firestore, "staff", user.uid), {
          userName: form.userName,
          email: form.email,
          status: form.status,
          permissions: form.permissions,
          lastLogin: null,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Staff added", position: "top-right" });
      }
      fetchStaff();
      onClose();
      setForm({ userName: "", email: "", password: "", role: "staff", status: "active" });
      setSelectedStaff(null);
    } catch (err) {
      toast({ title: "Error saving staff", status: "error", description: err.message, position: "top-right" });
    }
    setLoading(false);
  };

  // Open modal for add/edit
  const openEdit = (staff) => {
    setSelectedStaff(staff);
    setForm(staff
      ? {
          userName: staff.userName || "",
          email: staff.email || "",
          password: "",
          status: staff.status || "active",
          permissions: staff.permissions || [],
        }
      : { userName: "", email: "", password: "", status: "active", permissions: [] }
    );
    onOpen();
  };

  // Toggle status (active/suspended)
  const handleToggleStatus = async (staff) => {
    try {
      await updateDoc(doc(firestore, "staff", staff.id), { status: staff.status === "active" ? "suspended" : "active" });
      toast({ title: `Staff ${staff.status === "active" ? "suspended" : "activated"}`, position: "top-right" });
      fetchStaff();
    } catch (err) {
      toast({ title: "Error updating status", status: "error", description: err.message, position: "top-right" });
    }
  };

  // DataTable columns
  const columns = useMemo(() => [
    {
      Header: "User Name",
      accessor: "userName",
      Filter: () => null,
    },
    {
      Header: "Email",
      accessor: "email",
      Filter: () => null,
    },
    {
      Header: "Permissions",
      accessor: "permissions",
      Cell: ({ value }) => (
        <Flex wrap="wrap" gap={1}>
          {(value || []).map((permission, index) => (
            <Tag size="sm" key={index} colorScheme="orange">
              {permission.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Tag>
          ))}
        </Flex>
      ),
      Filter: () => null,
    },
    {
      Header: "Status",
      accessor: "status",
      Filter: () => null,
      filter: "includes",
    },
    {
      Header: "Last Login",
      accessor: "lastLogin",
      Cell: ({ value }) => value ? new Date(value.seconds * 1000).toLocaleString() : "-",
      Filter: () => null,
    },
    {
      Header: "Created At",
      accessor: "createdAt",
      Cell: ({ value }) => value ? new Date(value.seconds * 1000).toLocaleString() : "-",
      Filter: () => null,
    },
    {
      Header: "Actions",
      id: "actions",
      Cell: ({ row }) => (
        <Menu>
          <MenuButton
            as={IconButton}
            aria-label="Options"
            icon={<BsThreeDotsVertical />}
            variant="ghost"
          />
          <MenuList>
            <MenuItem onClick={() => openEdit(row.original)}>Edit</MenuItem>
            <MenuItem onClick={() => setDeleteModal({ open: true, staff: row.original })}>Delete</MenuItem>
            <MenuItem onClick={() => handleToggleStatus(row.original)}>{row.original.status === "active" ? "Suspend" : "Activate"}</MenuItem>
          </MenuList>
        </Menu>
      ),
      disableSortBy: true,
      Filter: () => null,
    },
  ], [statusFilter]);
  // Delete staff (using backend API for Auth, then Firestore)
  const handleDelete = async () => {
    const staff = deleteModal.staff;
    if (!staff) return;
    setLoading(true);
    try {
      // Call backend API to delete user from Auth
      const res = await fetch(`${API_BASE_URL}/api/deleteUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: staff.id })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user from Auth');
      }
      // If Auth delete succeeded, delete from Firestore
      try {
        await import("firebase/firestore").then(({ deleteDoc, doc }) => deleteDoc(doc(firestore, "staff", staff.id)));
      } catch (err) {
        toast({ title: "Error deleting from Firestore", description: err.message, status: "error", position: "top-right" });
        setLoading(false);
        return;
      }
      toast({ title: "Staff deleted", status: "success", position: "top-right" });
      fetchStaff();
    } catch (err) {
      toast({ title: "Error deleting staff", description: err.message, status: "error", position: "top-right" });
    }
    setDeleteModal({ open: false, staff: null });
    setLoading(false);
  };

  // Filtering logic
  const filteredData = useMemo(() => {
    let data = staff;
    if (statusFilter) data = data.filter(row => row.status === statusFilter);
    if (globalFilter) {
      const lower = globalFilter.toLowerCase();
      data = data.filter(row =>
        row.userName?.toLowerCase().includes(lower) ||
        row.email?.toLowerCase().includes(lower)
      );
    }
    return data;
  }, [staff, statusFilter, globalFilter]);

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
    {
      columns,
      data: filteredData,
      initialState: { pageSize: 10 },
      autoResetPage: false,
    },
    useGlobalFilter,
    useFilters,
    useSortBy,
    usePagination
  );

  // Sync search input with react-table
  useEffect(() => {
    setTableGlobalFilter(globalFilter);
  }, [globalFilter, setTableGlobalFilter]);

  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }}>
      <Card overflowX={{ sm: "scroll", xl: "hidden" }} pb="0px">
        <CardHeader p="6px 0px 22px 0px">
          <Flex justify="space-between" align="center">
            <Heading size="md">Staff Management</Heading>
            <Button colorScheme="orange" onClick={() => openEdit(null)}>Add Staff</Button>
          </Flex>
        </CardHeader>
        <CardBody>
          <Flex mb={4} gap={4} flexWrap="wrap" align="center" justify="space-between">
            <InputGroup maxW="250px" boxShadow="sm">
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search by name or email"
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                size="sm"
                bg="white"
                borderRadius="md"
                boxShadow="sm"
              />
            </InputGroup>
            <Flex gap={2} align="center">
              
              <FormControl minW="150px" maxW="200px">
                <FormLabel fontSize="xs" mb={1} color="gray.600">Status</FormLabel>
                <Select placeholder="All Statuses" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} size="sm" bg="white" borderRadius="md" boxShadow="sm">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </Select>
              </FormControl>
            </Flex>
          </Flex>
          {loading && <Flex justify="center" align="center" minH="100px"><Spinner size="lg" /></Flex>}
          {!loading && (
            <Table {...getTableProps()} variant="simple">
              <Thead>
                {headerGroups.map(headerGroup => (
                  <Tr {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map(column => (
                      <Th {...column.getHeaderProps(column.getSortByToggleProps())}>
                        {column.render("Header")}
                        {column.isSorted ? (column.isSortedDesc ? " 🔽" : " 🔼") : ""}
                        {column.Filter && <Box mt={2}>{column.render("Filter")}</Box>}
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
                      {row.cells.map(cell => (
                        <Td {...cell.getCellProps()}>{cell.render("Cell")}</Td>
                      ))}
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          )}
          {/* Pagination Controls */}
          {!loading && pageOptions.length > 1 && (
            <Flex mt={4} align="center" justify="flex-end" gap={2} flexWrap="wrap">
              <Button size="sm" onClick={() => gotoPage(0)} disabled={!canPreviousPage}>&lt;&lt;</Button>
              <Button size="sm" onClick={() => previousPage()} disabled={!canPreviousPage}>&lt;</Button>
              <Box>
                Page {state.pageIndex + 1} of {pageOptions.length}
              </Box>
              <Button size="sm" onClick={() => nextPage()} disabled={!canNextPage}>&gt;</Button>
              <Button size="sm" onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>&gt;&gt;</Button>
              <Select
                size="sm"
                value={state.pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                w="auto"
                ml={2}
              >
                {[10, 20, 30, 40, 50].map(pageSize => (
                  <option key={pageSize} value={pageSize}>
                    Show {pageSize}
                  </option>
                ))}
              </Select>
            </Flex>
          )}
        </CardBody>
      </Card>
      {/* Delete confirmation modal - only render when open */}
      {deleteModal.open && (
        <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, staff: null })} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Delete Staff</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              Are you sure you want to delete staff <b>{deleteModal.staff?.userName || deleteModal.staff?.email}</b>? This cannot be undone.<br/>
              <Box mt={2} color="red.500" fontSize="sm">This will remove the staff from Firestore. Deleting from Firebase Auth requires admin privileges or the user to be signed in as themselves.</Box>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="red" mr={3} onClick={handleDelete} isLoading={loading} loadingText="Deleting...">Delete</Button>
              <Button variant="ghost" onClick={() => setDeleteModal({ open: false, staff: null })} isDisabled={loading}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
      {/* Add/Edit Staff modal - only render when open */}
      {isOpen && (
        <Modal isOpen={isOpen} onClose={onClose} isCentered>
          <ModalOverlay />
          <ModalContent maxH="90vh">
            <ModalHeader>{selectedStaff ? "Edit Staff" : "Add Staff"}</ModalHeader>
            <ModalCloseButton />
            <ModalBody overflowY="auto">
              {loading && (
                <Flex position="absolute" top={0} left={0} right={0} bottom={0} align="center" justify="center" zIndex={10} bg="rgba(255,255,255,0.6)">
                  <Spinner size="lg" color="orange.400" thickness="4px" speed="0.65s" />
                </Flex>
              )}
              <FormControl mb={3} isRequired>
                <FormLabel display="flex" alignItems="center" gap={1}>
                  User Name
                  <Tooltip label="The staff member's display name." placement="right" hasArrow>
                    <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                  </Tooltip>
                </FormLabel>
                <Input value={form.userName} onChange={e => setForm(f => ({ ...f, userName: e.target.value }))} />
              </FormControl>
              <FormControl mb={3} isRequired>
                <FormLabel display="flex" alignItems="center" gap={1}>
                  Email
                  <Tooltip label="The staff member's email address." placement="right" hasArrow>
                    <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                  </Tooltip>
                </FormLabel>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} isDisabled={!!selectedStaff} />
              </FormControl>
              {!selectedStaff && (
                <FormControl mb={3} isRequired>
                  <FormLabel display="flex" alignItems="center" gap={1}>
                    Password
                    <Tooltip label="Initial password for the staff member (required for new staff)." placement="right" hasArrow>
                      <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                    </Tooltip>
                  </FormLabel>
                  <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </FormControl>
              )}
              <FormControl mb={3}>
                <FormLabel>Permissions</FormLabel>
                <VStack align="start">
                  <Checkbox isChecked={form.permissions.includes("dashboard")} onChange={e => handlePermissionChange("dashboard", e.target.checked)}>Dashboard</Checkbox>
                  <Checkbox isChecked={form.permissions.includes("staff-management")} onChange={e => handlePermissionChange("staff-management", e.target.checked)}>Staff Management</Checkbox>
                  <Checkbox isChecked={form.permissions.includes("category-manager")} onChange={e => handlePermissionChange("category-manager", e.target.checked)}>Category Manager</Checkbox>
                  <Checkbox isChecked={form.permissions.includes("service-manager")} onChange={e => handlePermissionChange("service-manager", e.target.checked)}>Service Manager</Checkbox>
                  <Checkbox isChecked={form.permissions.includes("product-library")} onChange={e => handlePermissionChange("product-library", e.target.checked)}>Addon Products</Checkbox>
                  <Checkbox isChecked={form.permissions.includes("coupon-manager")} onChange={e => handlePermissionChange("coupon-manager", e.target.checked)}>Coupon Management</Checkbox>
                  <Checkbox isChecked={form.permissions.includes("discount-manager")} onChange={e => handlePermissionChange("discount-manager", e.target.checked)}>Discount Management</Checkbox>
                  <Checkbox isChecked={form.permissions.includes("worker-management")} onChange={e => handlePermissionChange("worker-management", e.target.checked)}>Worker Management</Checkbox>
                  <Checkbox isChecked={form.permissions.includes("ads-manager")} onChange={e => handlePermissionChange("ads-manager", e.target.checked)}>Ads Manager</Checkbox>
                  <Checkbox isChecked={form.permissions.includes("settings")} onChange={e => handlePermissionChange("settings", e.target.checked)}>Settings</Checkbox>
                  <Checkbox isChecked={form.permissions.includes("sub-category-manager")} onChange={e => handlePermissionChange("sub-category-manager", e.target.checked)}>Sub-Category Manager</Checkbox>
                  <Checkbox isChecked={form.permissions.includes("feedback")} onChange={e => handlePermissionChange("feedback", e.target.checked)}>Feedback</Checkbox>
                </VStack>
              </FormControl>
              <FormControl mb={3}>
                <FormLabel display="flex" alignItems="center" gap={1}>
                  Status
                  <Tooltip label="Current status of the staff member (active or suspended)." placement="right" hasArrow>
                    <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                  </Tooltip>
                </FormLabel>
                <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </Select>
              </FormControl>
              {selectedStaff && (
                <>
                  <FormControl mb={3} isReadOnly>
                    <FormLabel display="flex" alignItems="center" gap={1}>
                      Last Login
                      <Tooltip label="The last time this staff member logged in." placement="right" hasArrow>
                        <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                      </Tooltip>
                    </FormLabel>
                    <Input value={selectedStaff.lastLogin ? new Date(selectedStaff.lastLogin.seconds * 1000).toLocaleString() : "-"} isReadOnly />
                  </FormControl>
                  <FormControl mb={3} isReadOnly>
                    <FormLabel display="flex" alignItems="center" gap={1}>
                      Created At
                      <Tooltip label="The date and time this staff member was created." placement="right" hasArrow>
                        <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                      </Tooltip>
                    </FormLabel>
                    <Input value={selectedStaff.createdAt ? new Date(selectedStaff.createdAt.seconds * 1000).toLocaleString() : "-"} isReadOnly />
                  </FormControl>
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="orange" mr={3} onClick={handleSave} isLoading={loading} loadingText="Saving...">
                Save
              </Button>
              <Button variant="ghost" onClick={onClose} isDisabled={loading}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
      
    </Flex>
  );
}