import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  InputGroup,
  InputLeftElement,
  useToast,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  FormControl,
  FormLabel,
  Select,
  Tag,
  TagLabel,
  TagCloseButton,
  Tooltip,
  Icon,
  SimpleGrid,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
} from "@chakra-ui/react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useTable, useGlobalFilter, useSortBy, usePagination } from "react-table";
import { SearchIcon } from "@chakra-ui/icons";
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../../firebase";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody";

export default function CouponManager() {
  const [deleteModal, setDeleteModal] = useState({ open: false, coupon: null });
  const [coupons, setCoupons] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [form, setForm] = useState({
    code: "",
    type: "percentage",
    value: "",
    startDate: "",
    endDate: "",
    usageLimit: "",
    assignedServices: [],
  });
  const [globalFilter, setGlobalFilter] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const [serviceInput, setServiceInput] = useState("");

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(firestore, "coupons"));
      const couponList = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCoupons(couponList);
    } catch (err) {
      toast({ title: "Error fetching coupons", status: "error", description: err.message });
    }
    setLoading(false);
  };

  const fetchServices = async () => {
    try {
      const querySnapshot = await getDocs(collection(firestore, "services"));
      setServices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      toast({ title: "Error fetching services", status: "error", description: err.message });
    }
  };

  useEffect(() => {
    fetchCoupons();
    fetchServices();
  }, []);

  const handleSave = async () => {
    if (!form.code || !form.value || !form.startDate || !form.endDate || !form.usageLimit) {
      toast({ title: "All fields are required", status: "warning", position: "top-right" });
      return;
    }
    setLoading(true);
    try {
      const couponData = {
        ...form,
        value: Number(form.value),
        usageLimit: Number(form.usageLimit),
      };

      if (selectedCoupon) {
        await updateDoc(doc(firestore, "coupons", selectedCoupon.id), couponData);
        toast({ title: "Coupon updated", position: "top-right" });
      } else {
        await addDoc(collection(firestore, "coupons"), {
          ...couponData,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Coupon added", position: "top-right" });
      }
      fetchCoupons();
      onClose();
      setForm({ code: "", type: "percentage", value: "", startDate: "", endDate: "", usageLimit: "", assignedServices: [] });
      setSelectedCoupon(null);
      setServiceInput("");
    } catch (err) {
      toast({ title: "Error saving coupon", status: "error", description: err.message, position: "top-right" });
    }
    setLoading(false);
  };

  const openEdit = (coupon) => {
    setSelectedCoupon(coupon);
    setForm(
      coupon
        ? { ...coupon, value: String(coupon.value), usageLimit: String(coupon.usageLimit), assignedServices: coupon.assignedServices || [] }
        : { code: "", type: "percentage", value: "", startDate: "", endDate: "", usageLimit: "", assignedServices: [] }
    );
    setServiceInput("");
    onOpen();
  };

  const handleDelete = async () => {
    const coupon = deleteModal.coupon;
    if (!coupon) return;
    setLoading(true);
    try {
      await deleteDoc(doc(firestore, "coupons", coupon.id));
      toast({ title: "Coupon deleted", status: "success", position: "top-right" });
      fetchCoupons();
    } catch (err) {
      toast({ title: "Error deleting coupon", description: err.message, status: "error", position: "top-right" });
    }
    setDeleteModal({ open: false, coupon: null });
    setLoading(false);
  };

  const addServiceTag = (serviceId) => {
    if (!form.assignedServices.includes(serviceId)) {
      setForm(f => ({ ...f, assignedServices: [...f.assignedServices, serviceId] }));
    }
    setServiceInput("");
  };

  const removeServiceTag = (serviceId) => {
    setForm(f => ({ ...f, assignedServices: f.assignedServices.filter(id => id !== serviceId) }));
  };

  const columns = useMemo(
    () => [
      { Header: "Code", accessor: "code" },
      { Header: "Type", accessor: "type" },
      { Header: "Value", accessor: "value", Cell: ({ row }) => `${row.original.value}${row.original.type === "percentage" ? "%" : ""}` },
      { Header: "Start Date", accessor: "startDate" },
      { Header: "End Date", accessor: "endDate" },
      { Header: "Usage Limit", accessor: "usageLimit" },
      {
        Header: "Assigned Services",
        accessor: "assignedServices",
        Cell: ({ value }) => value && value.length > 0
          ? value.map(id => services.find(s => s.id === id)?.name || id).join(", ")
          : "All Services",
        disableSortBy: true,
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
              <MenuItem onClick={() => setDeleteModal({ open: true, coupon: row.original })}>Delete</MenuItem>
            </MenuList>
          </Menu>
        ),
      },
    ],
    [services]
  );

  const filteredData = useMemo(() => {
    let data = coupons;
    if (globalFilter) {
      const lower = globalFilter.toLowerCase();
      data = data.filter(row =>
        row.code?.toLowerCase().includes(lower)
      );
    }
    return data;
  }, [coupons, globalFilter]);


  const { getTableProps, getTableBodyProps, headerGroups, prepareRow, page, setGlobalFilter: setTableGlobalFilter, state, canPreviousPage, canNextPage, pageOptions, pageCount, gotoPage, nextPage, previousPage, setPageSize } = useTable(
    { columns, data: filteredData, initialState: { pageSize: 10 }, autoResetPage: false },
    useGlobalFilter,
    useSortBy,
    usePagination
  );

  useEffect(() => {
    setTableGlobalFilter(globalFilter);
  }, [globalFilter, setTableGlobalFilter]);

  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }}>
      <Card overflowX={{ sm: "scroll", xl: "hidden" }} pb="0px">
        <CardHeader p="6px 0px 22px 0px">
          <Flex justify="space-between" align="center">
            <Heading size="md">Coupon Management</Heading>
            <Button colorScheme="orange" onClick={() => openEdit(null)}>
              Add Coupon
            </Button>
          </Flex>
        </CardHeader>
        <CardBody>
          <Flex mb={4} gap={4} flexWrap="wrap" align="center" justify="space-between">
            <InputGroup maxW="250px" boxShadow="sm">
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input placeholder="Search by code" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} size="sm" bg="white" borderRadius="md" />
            </InputGroup>
          </Flex>
          {loading ? (
            <Flex justify="center" align="center" minH="100px">
              <Spinner size="lg" />
            </Flex>
          ) : (
            <Table {...getTableProps()} variant="simple">
              <Thead>
                {headerGroups.map((headerGroup) => (
                  <Tr {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map((column) => (
                      <Th {...column.getHeaderProps(column.getSortByToggleProps())}>
                        {column.render("Header")}
                        {column.isSorted ? (column.isSortedDesc ? " 🔽" : " 🔼") : ""}
                      </Th>
                    ))}
                  </Tr>
                ))}
              </Thead>
              <Tbody {...getTableBodyProps()}>
                {page.map((row) => {
                  prepareRow(row);
                  return (
                    <Tr {...row.getRowProps()}>
                      {row.cells.map((cell) => (
                        <Td {...cell.getCellProps()}>{cell.render("Cell")}</Td>
                      ))}
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          )}
          {!loading && pageOptions.length > 1 && (
            <Flex mt={4} align="center" justify="flex-end" gap={2} flexWrap="wrap">
              <Button size="sm" onClick={() => gotoPage(0)} disabled={!canPreviousPage}>&lt;&lt;</Button>
              <Button size="sm" onClick={() => previousPage()} disabled={!canPreviousPage}>&lt;</Button>
              <Box>Page {state.pageIndex + 1} of {pageOptions.length}</Box>
              <Button size="sm" onClick={() => nextPage()} disabled={!canNextPage}>&gt;</Button>
              <Button size="sm" onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>&gt;&gt;</Button>
              <Select size="sm" value={state.pageSize} onChange={(e) => setPageSize(Number(e.target.value))} w="auto" ml={2}>
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>Show {pageSize}</option>
                ))}
              </Select>
            </Flex>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} isCentered size="2xl">
        <ModalOverlay />
        <ModalContent maxW="700px" minH="600px">
          <ModalHeader>{selectedCoupon ? "Edit Coupon" : "Add Coupon"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto">
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl mb={3} isRequired>
                <FormLabel>Code</FormLabel>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </FormControl>
              <FormControl mb={3} isRequired>
                <FormLabel>Type</FormLabel>
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="percentage">Percentage</option>
                  <option value="flat">Flat</option>
                </Select>
              </FormControl>
              <FormControl mb={3} isRequired>
                <FormLabel>Value</FormLabel>
                <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </FormControl>
              <FormControl mb={3} isRequired>
                <FormLabel>Usage Limit</FormLabel>
                <Input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
              </FormControl>
              <FormControl mb={3} isRequired>
                <FormLabel>Start Date</FormLabel>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </FormControl>
              <FormControl mb={3} isRequired>
                <FormLabel>End Date</FormLabel>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel display="flex" alignItems="center" gap={1}>
                  Assign to Services
                  <Tooltip label="Assign this coupon to one or more services. Leave empty to apply to all services." placement="right" hasArrow>
                    <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                  </Tooltip>
                </FormLabel>
                <Box position="relative">
                  <Input
                    placeholder="Type to search services..."
                    value={serviceInput}
                    onChange={e => setServiceInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && serviceInput) {
                        const match = services.find(s => s.name.toLowerCase() === serviceInput.toLowerCase());
                        if (match) addServiceTag(match.id);
                      }
                    }}
                    mb={2}
                  />
                  <Flex wrap="wrap" gap={2}>
                    {form.assignedServices.map(serviceId => {
                      const service = services.find(s => s.id === serviceId);
                      return (
                        <Tag key={serviceId} colorScheme="orange" borderRadius="full">
                          <TagLabel>{service ? service.name : serviceId}</TagLabel>
                          <TagCloseButton onClick={() => removeServiceTag(serviceId)} />
                        </Tag>
                      );
                    })}
                  </Flex>
                  {serviceInput && (
                    <Box
                      borderWidth={1}
                      borderRadius="md"
                      bg="white"
                      mt={1}
                      maxH="280px"
                      minW="100%"
                      width="100%"
                      overflowY="auto"
                      zIndex={20}
                      position="absolute"
                      boxShadow="lg"
                    >
                      {services.filter(s =>
                        s.name.toLowerCase().includes(serviceInput.toLowerCase()) &&
                        !form.assignedServices.includes(s.id)
                      ).map(s => (
                        <Box
                          key={s.id}
                          px={3}
                          py={2}
                          _hover={{ bg: "orange.50", cursor: "pointer" }}
                          onClick={() => addServiceTag(s.id)}
                        >
                          {s.name}
                        </Box>
                      ))}
                      {services.filter(s =>
                        s.name.toLowerCase().includes(serviceInput.toLowerCase()) &&
                        !form.assignedServices.includes(s.id)
                      ).length === 0 && (
                        <Box px={3} py={2} color="gray.400">No matches</Box>
                      )}
                    </Box>
                  )}
                </Box>
              </FormControl>
            </SimpleGrid>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="orange" mr={3} onClick={handleSave} isLoading={loading}>
              Save
            </Button>
            <Button variant="ghost" onClick={onClose} isDisabled={loading}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, coupon: null })} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete Coupon</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            Are you sure you want to delete the coupon <b>{deleteModal.coupon?.code}</b>?
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="red" mr={3} onClick={handleDelete} isLoading={loading}>
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setDeleteModal({ open: false, coupon: null })} isDisabled={loading}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
}
