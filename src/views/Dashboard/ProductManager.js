import React, { useEffect, useState, useMemo } from "react";
import { InputGroup, InputLeftElement } from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
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
  Tooltip,
  Icon,
  Tag,
  TagLabel,
  TagCloseButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton
} from "@chakra-ui/react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useTable, useSortBy, usePagination } from "react-table";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../../firebase";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody";
import { SimpleGrid } from "@chakra-ui/react";

export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    cost: "",
    time: "",
    assignedServices: []
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const [serviceInput, setServiceInput] = useState("");
  const [search, setSearch] = useState("");

  // Fetch services for assignment
  const fetchServices = async () => {
    try {
      const querySnapshot = await getDocs(collection(firestore, "services"));
      setServices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      toast({ title: "Error fetching services", status: "error", description: err.message });
    }
  };

  // Fetch products
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(firestore, "products"));
      setProducts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      toast({ title: "Error fetching products", status: "error", description: err.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchServices();
    fetchProducts();
  }, []);

  // Add or update product
  const handleSave = async () => {
    if (!form.name || !form.cost || !form.time) {
      toast({ title: "Name, Cost, and Time are required", status: "warning" });
      return;
    }
    setLoading(true);
    const data = {
      name: form.name,
      cost: Number(form.cost),
      time: Number(form.time),
      assignedServices: form.assignedServices,
      updatedAt: serverTimestamp(),
    };
    try {
      if (selectedProduct) {
        await updateDoc(doc(firestore, "products", selectedProduct.id), data);
        toast({ title: "Product updated" });
      } else {
        await addDoc(collection(firestore, "products"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Product added" });
      }
      fetchProducts();
      onClose();
      setForm({ name: "", cost: "", time: "", assignedServices: [] });
      setSelectedProduct(null);
      setServiceInput("");
    } catch (err) {
      toast({ title: "Error saving product", status: "error", description: err.message });
    }
    setLoading(false);
  };

  // Open modal for add/edit
  const openEdit = (product) => {
    setSelectedProduct(product);
    setForm(product
      ? {
          name: product.name || "",
          cost: product.cost || "",
          time: product.time || "",
          assignedServices: product.assignedServices || []
        }
      : { name: "", cost: "", time: "", assignedServices: [] }
    );
    setServiceInput("");
    onOpen();
  };

  // Delete product (with modal)
  const [deleteModal, setDeleteModal] = useState({ open: false, product: null });
  const handleDelete = async () => {
    const product = deleteModal.product;
    if (!product) return;
    setLoading(true);
    try {
      await deleteDoc(doc(firestore, "products", product.id));
      toast({ title: "Product deleted" });
      fetchProducts();
    } catch (err) {
      toast({ title: "Error deleting product", status: "error", description: err.message });
    }
    setDeleteModal({ open: false, product: null });
    setLoading(false);
  };

  // Tag-style input for assigning services
  const addServiceTag = (serviceId) => {
    if (!form.assignedServices.includes(serviceId)) {
      setForm(f => ({ ...f, assignedServices: [...f.assignedServices, serviceId] }));
    }
    setServiceInput("");
  };
  const removeServiceTag = (serviceId) => {
    setForm(f => ({ ...f, assignedServices: f.assignedServices.filter(id => id !== serviceId) }));
  };

  // Table columns
  const columns = useMemo(() => [
    { Header: "Name", accessor: "name" },
    { Header: "Cost", accessor: "cost" },
    { Header: "Time (min)", accessor: "time" },
    {
      Header: "Assigned Services",
      accessor: "assignedServices",
      Cell: ({ value }) => value && value.length > 0
        ? value.map(id => services.find(s => s.id === id)?.name || id).join(", ")
        : "-",
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
            <MenuItem onClick={() => setDeleteModal({ open: true, product: row.original })}>Delete</MenuItem>
          </MenuList>
        </Menu>
      ),
      disableSortBy: true,
    },
  ], [services]);

  // Filtered data for search
  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.cost && String(p.cost).includes(q)) ||
      (p.time && String(p.time).includes(q)) ||
      (p.assignedServices && p.assignedServices.some(id => {
        const s = services.find(sv => sv.id === id);
        return s && s.name && s.name.toLowerCase().includes(q);
      }))
    );
  }, [search, products, services]);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page,
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    state
  } = useTable(
    {
      columns,
      data: filteredProducts,
      initialState: { pageSize: 10 },
      autoResetPage: false,
    },
    useSortBy,
    usePagination
  );

  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }}>
      <Card overflowX={{ sm: "scroll", xl: "hidden" }} pb="0px">
      <CardHeader p="6px 0px 22px 0px">
        <Flex justify="space-between" align="center">
          <Heading size="md">Product Manager</Heading>
          <Button colorScheme="orange" onClick={() => openEdit(null)}>Add Product</Button>
        </Flex>
      </CardHeader>
      <Flex mb={4} gap={4} flexWrap="wrap" align="center" justify="space-between">
        <InputGroup maxW="250px" boxShadow="sm">
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search by name, cost, or service"
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="sm"
            bg="white"
            borderRadius="md"
            boxShadow="sm"
          />
        </InputGroup>
      </Flex>
        <CardBody>
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
        <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, product: null })} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Delete Product</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              Are you sure you want to delete product <b>{deleteModal.product?.name}</b>? This cannot be undone.<br/>
              <Box mt={2} color="red.500" fontSize="sm">This will permanently remove the product from the system.</Box>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="red" mr={3} onClick={handleDelete} isLoading={loading} loadingText="Deleting...">Delete</Button>
              <Button variant="ghost" onClick={() => setDeleteModal({ open: false, product: null })} isDisabled={loading}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
      {/* Add/Edit Product modal - only render when open */}
      {isOpen && (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="2xl">
          <ModalOverlay />
          <ModalContent maxW="700px" minH="450px">
            <ModalHeader>{selectedProduct ? "Edit Product" : "Add Product"}</ModalHeader>
            <ModalCloseButton />
            <ModalBody overflowY="auto">
              {loading && (
                <Flex position="absolute" top={0} left={0} right={0} bottom={0} align="center" justify="center" zIndex={10} bg="rgba(255,255,255,0.6)">
                  <Spinner size="lg" color="orange.400" thickness="4px" speed="0.65s" />
                </Flex>
              )}
              <Box>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl mb={3} isRequired>
                    <FormLabel display="flex" alignItems="center" gap={1}>
                      Product Name
                      <Tooltip label="The name of the add-on product (e.g., Air Freshener, Tire Shine)." placement="right" hasArrow>
                        <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                      </Tooltip>
                    </FormLabel>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </FormControl>
                  <FormControl mb={3} isRequired>
                    <FormLabel display="flex" alignItems="center" gap={1}>
                      Cost
                      <Tooltip label="The price charged for this add-on product (in your local currency)." placement="right" hasArrow>
                        <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                      </Tooltip>
                    </FormLabel>
                    <Input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} min={0} />
                  </FormControl>
                  <FormControl mb={3} isRequired>
                    <FormLabel display="flex" alignItems="center" gap={1}>
                      Time (minutes)
                      <Tooltip label="How long this add-on product takes to apply (in minutes)." placement="right" hasArrow>
                        <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                      </Tooltip>
                    </FormLabel>
                    <Input type="number" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} min={0} />
                  </FormControl>
                  <FormControl mb={3}>
                    <FormLabel display="flex" alignItems="center" gap={1}>
                      Assign to Services
                      <Tooltip label="Assign this product to one or more services. Use the input to search and add services as tags." placement="right" hasArrow>
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
                      {/* Service suggestions dropdown */}
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
              </Box>
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