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
  Switch,
  Tooltip,
  Icon
} from "@chakra-ui/react";
import "react-quill/dist/quill.snow.css";
import ReactQuill from "react-quill";
import { useTable, useSortBy, usePagination } from "react-table";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { firestore, storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody";
import { SimpleGrid } from "@chakra-ui/react";
export default function ServiceManager() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    description: "",
    categoryId: "",
    cost: "",
    duration: "",
    graceTime: "",
    bufferTime: "",
    active: true,
    iconUrl: ""
  });
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedService, setSelectedService] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Fetch categories for dropdown
  const fetchCategories = async () => {
    try {
      const querySnapshot = await getDocs(collection(firestore, "categories"));
      setCategories(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      toast({ title: "Error fetching categories", status: "error", description: err.message });
    }
  };

  // Fetch services
  const fetchServices = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(firestore, "services"));
      setServices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      toast({ title: "Error fetching services", status: "error", description: err.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
    fetchServices();
  }, []);

  // Add or update service
  const handleSave = async () => {
    if (!form.name || !form.categoryId || !form.cost || !form.duration) {
      toast({ title: "Name, Category, Cost, and Duration are required", status: "warning" });
      return;
    }
    setLoading(true);
    let iconUrl = form.iconUrl;
    try {
      // If a new icon file is selected, upload it
      if (iconFile) {
        const fileExt = iconFile.name.split('.').pop();
        const fileName = `service-icons/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const storageRef = ref(storage, fileName);
        const uploadTask = uploadBytesResumable(storageRef, iconFile);
        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
            },
            (error) => reject(error),
            async () => {
              iconUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
      }
      const data = {
        name: form.name,
        description: form.description,
        categoryId: form.categoryId,
        cost: Number(form.cost),
        duration: Number(form.duration),
        graceTime: form.graceTime ? Number(form.graceTime) : 0,
        bufferTime: form.bufferTime ? Number(form.bufferTime) : 0,
        active: !!form.active,
        iconUrl: iconUrl || "",
        updatedAt: serverTimestamp(),
      };
      if (selectedService) {
        await updateDoc(doc(firestore, "services", selectedService.id), data);
        toast({ title: "Service updated" });
      } else {
        await addDoc(collection(firestore, "services"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Service added" });
      }
      fetchServices();
      onClose();
      setForm({ name: "", description: "", categoryId: "", cost: "", duration: "", graceTime: "", bufferTime: "", active: true, iconUrl: "" });
      setIconFile(null);
      setIconPreview("");
      setUploadProgress(0);
      setSelectedService(null);
    } catch (err) {
      toast({ title: "Error saving service", status: "error", description: err.message });
    }
    setLoading(false);
  };

  // Open modal for add/edit
  const openEdit = (service) => {
    setSelectedService(service);
    setForm(service
      ? {
          name: service.name || "",
          description: service.description || "",
          categoryId: service.categoryId || "",
          cost: service.cost || "",
          duration: service.duration || "",
          graceTime: service.graceTime || "",
          bufferTime: service.bufferTime || "",
          active: service.active !== undefined ? service.active : true,
          iconUrl: service.iconUrl || ""
        }
      : { name: "", description: "", categoryId: "", cost: "", duration: "", graceTime: "", bufferTime: "", active: true, iconUrl: "" }
    );
    setIconFile(null);
    setIconPreview(service && service.iconUrl ? service.iconUrl : "");
    setUploadProgress(0);
    onOpen();
  };

  // Delete service (with modal)
  const [deleteModal, setDeleteModal] = useState({ open: false, service: null });
  const handleDelete = async () => {
    const service = deleteModal.service;
    if (!service) return;
    setLoading(true);
    try {
      await deleteDoc(doc(firestore, "services", service.id));
      toast({ title: "Service deleted" });
      fetchServices();
    } catch (err) {
      toast({ title: "Error deleting service", status: "error", description: err.message });
    }
    setDeleteModal({ open: false, service: null });
    setLoading(false);
  };

  // Table columns
  const columns = useMemo(() => [
    {
      Header: "Icon",
      accessor: "iconUrl",
    Cell: ({ value }) => value ? <img src={value} alt="icon" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6 }} /> : "-",
        disableSortBy: true,
    },
    { Header: "Name", accessor: "name" },
    { Header: "Category", accessor: "categoryId", Cell: ({ value }) => categories.find(c => c.id === value)?.name || value },
    { Header: "Cost", accessor: "cost" },
    { Header: "Duration (min)", accessor: "duration" },
    { Header: "Grace (min)", accessor: "graceTime" },
    { Header: "Buffer (min)", accessor: "bufferTime" },
    { Header: "Active", accessor: "active", Cell: ({ value }) => value ? "Yes" : "No" },
    {
      Header: "Actions",
      id: "actions",
      Cell: ({ row }) => (
        <Flex>
          <Button size="sm" onClick={() => openEdit(row.original)} colorScheme="blue" mr={2}>Edit</Button>
          <Button size="sm" colorScheme="red" onClick={() => setDeleteModal({ open: true, service: row.original })}>Delete</Button>
        </Flex>
      ),
      disableSortBy: true,
    },
  ], [categories]);

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
      data: services,
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
            <Heading size="md">Service Manager</Heading>
            <Button colorScheme="orange" onClick={() => openEdit(null)}>Add Service</Button>
          </Flex>
        </CardHeader>
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
        <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, service: null })} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Delete Service</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              Are you sure you want to delete service <b>{deleteModal.service?.name}</b>? This cannot be undone.<br/>
              <Box mt={2} color="red.500" fontSize="sm">This will permanently remove the service from the system.</Box>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="red" mr={3} onClick={handleDelete} isLoading={loading} loadingText="Deleting...">Delete</Button>
              <Button variant="ghost" onClick={() => setDeleteModal({ open: false, service: null })} isDisabled={loading}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
      {/* Add/Edit Service modal - only render when open */}
      {isOpen && (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="2xl">
          <ModalOverlay />
          <ModalContent maxW="700px" maxH="90vh">
            <ModalHeader>{selectedService ? "Edit Service" : "Add Service"}</ModalHeader>
            <ModalCloseButton />
            <ModalBody overflowY="auto">
              {loading && (
                <Flex position="absolute" top={0} left={0} right={0} bottom={0} align="center" justify="center" zIndex={10} bg="rgba(255,255,255,0.6)">
                  <Spinner size="lg" color="orange.400" thickness="4px" speed="0.65s" />
                </Flex>
              )}
              <Box>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  {/* Service Icon Upload */}
                  <FormControl mb={3}>
                    <FormLabel display="flex" alignItems="center" gap={1}>
                      Service Icon
                      <Tooltip label="Upload an icon for this service. Shown in the app and admin panel." placement="right" hasArrow>
                        <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                      </Tooltip>
                    </FormLabel>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files[0];
                        if (file) {
                          setIconFile(file);
                          setIconPreview(URL.createObjectURL(file));
                        } else {
                          setIconFile(null);
                          setIconPreview(form.iconUrl || "");
                        }
                      }}
                    />
                    {(iconPreview || form.iconUrl) && (
                      <Box mt={2}>
                        <img
                          src={iconPreview || form.iconUrl}
                          alt="Service Icon Preview"
                          style={{ maxWidth: "60px", maxHeight: "60px", borderRadius: 8, border: "1px solid #eee" }}
                        />
                      </Box>
                    )}
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <Box mt={1} fontSize="sm" color="gray.500">Uploading: {uploadProgress}%</Box>
                    )}
                  </FormControl>
                  <FormControl mb={3} isRequired>
                    <FormLabel display="flex" alignItems="center" gap={1}>
                      Service Name
                      <Tooltip label="The name of the service (e.g., Exterior Wash, Full Detailing)." placement="right" hasArrow>
                        <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                      </Tooltip>
                    </FormLabel>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </FormControl>
                  <FormControl mb={3} isRequired>
                    <FormLabel display="flex" alignItems="center" gap={1}>
                      Category
                      <Tooltip label="The category this service belongs to (e.g., Wash, Detailing)." placement="right" hasArrow>
                        <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                      </Tooltip>
                    </FormLabel>
                    <Select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl mb={3} isRequired>
                    <FormLabel display="flex" alignItems="center" gap={1}>
                      Cost
                      <Tooltip label="The price charged for this service (in your local currency)." placement="right" hasArrow>
                        <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                      </Tooltip>
                    </FormLabel>
                    <Input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} min={0} />
                  </FormControl>
                  <FormControl mb={3} isRequired>
                    <FormLabel display="flex" alignItems="center" gap={1}>
                      Duration (minutes)
                      <Tooltip label="How long this service takes to complete (in minutes)." placement="right" hasArrow>
                        <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                      </Tooltip>
                    </FormLabel>
                    <Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} step="60" />
                  </FormControl>
                  <FormControl mb={3}>
                    <FormLabel display="flex" alignItems="center" gap={1}>
                      Grace Time (minutes)
                      <Tooltip label="Extra time allowed after booking before it's considered missed." placement="right" hasArrow>
                        <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                      </Tooltip>
                    </FormLabel>
                    <Input type="number" value={form.graceTime} onChange={e => setForm(f => ({ ...f, graceTime: e.target.value }))} min={0} />
                  </FormControl>
                  <FormControl mb={3}>
                    <FormLabel display="flex" alignItems="center" gap={1}>
                      Buffer Time (minutes)
                      <Tooltip label="Extra time between bookings to prevent overlap." placement="right" hasArrow>
                        <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                      </Tooltip>
                    </FormLabel>
                    <Input type="number" value={form.bufferTime} onChange={e => setForm(f => ({ ...f, bufferTime: e.target.value }))} min={0} />
                  </FormControl>
                  <FormControl mb={3} display="flex" alignItems="center">
                    <FormLabel mb={0} display="flex" alignItems="center" gap={1}>
                      Active
                      <Tooltip label="Toggle to activate or deactivate this service." placement="right" hasArrow>
                        <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                      </Tooltip>
                    </FormLabel>
                    <Switch isChecked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                  </FormControl>
                  <Box gridColumn={{ base: '1', md: '1 / span 2' }}>
                    <FormControl mb={3}>
                      <FormLabel display="flex" alignItems="center" gap={1}>
                        Description
                        <Tooltip label="A detailed description of the service, visible to users." placement="right" hasArrow>
                          <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                        </Tooltip>
                      </FormLabel>
                      <Box bg="white" borderRadius="md" borderWidth={1} borderColor="gray.200" minH="180px">
                        <ReactQuill
                          theme="snow"
                          value={form.description}
                          onChange={val => setForm(f => ({ ...f, description: val }))}
                          style={{ height: "140px" }}
                          modules={{
                            toolbar: [
                              [{ 'header': [1, 2, false] }],
                              ['bold', 'italic', 'underline', 'strike'],
                              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                              ['link', 'clean']
                            ]
                          }}
                        />
                      </Box>
                    </FormControl>
                  </Box>
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
