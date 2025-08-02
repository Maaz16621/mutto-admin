import React, { useEffect, useState, useMemo } from "react";
import { InputGroup, InputLeftElement, Textarea } from "@chakra-ui/react";
import { SearchIcon, AddIcon, CloseIcon, StarIcon } from "@chakra-ui/icons";
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
  Icon,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  HStack,
  VStack
} from "@chakra-ui/react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useTable, useSortBy, usePagination } from "react-table";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { firestore, storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody";
import { SimpleGrid } from "@chakra-ui/react";
export default function ServiceManager() {
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState("");
  const [subCategories, setSubCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    description: "",
    importantNotes: [],
    whatsIncluded: [],
    subCategoryId: "",
    cost: "",
    duration: "",
    graceTime: "",
    bufferTime: "",
    active: true,
    imageUrls: [],
    mainImageUrl: "",
    relatedServices: []
  });
  const [includedItem, setIncludedItem] = useState("");
  const [noteItem, setNoteItem] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedService, setSelectedService] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const fetchSubCategories = async () => {
    try {
      const querySnapshot = await getDocs(collection(firestore, "subCategories"));
      setSubCategories(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      toast({ title: "Error fetching sub-categories", status: "error", description: err.message });
    }
  };

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
    fetchSubCategories();
    fetchServices();
  }, []);

  const handleImageRemove = (index) => {
    const newImagePreviews = [...imagePreviews];
    newImagePreviews.splice(index, 1);
    setImagePreviews(newImagePreviews);

    const newImageFiles = [...imageFiles];
    newImageFiles.splice(index, 1);
    setImageFiles(newImageFiles);
  };

  const handleSetMainImage = (url) => {
    setForm(f => ({ ...f, mainImageUrl: url }));
  };

  const handleSave = async () => {
    if (!form.name || !form.subCategoryId || !form.cost || !form.duration) {
      toast({ title: "Name, Sub-Category, Cost, and Duration are required", status: "warning" });
      return;
    }
    setLoading(true);
    let imageUrls = form.imageUrls || [];

    if (selectedService && selectedService.imageUrls && imageFiles.length > 0) {
      const deletePromises = selectedService.imageUrls.map(url => {
        const imageRef = ref(storage, url);
        return deleteObject(imageRef);
      });
      await Promise.all(deletePromises);
      imageUrls = [];
    }

    try {
      if (imageFiles.length > 0) {
        const uploadPromises = imageFiles.map(file => {
          const fileExt = file.name.split('.').pop();
          const fileName = `service-images/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          const storageRef = ref(storage, fileName);
          const uploadTask = uploadBytesResumable(storageRef, file);
          return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
              (snapshot) => {
                setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
              },
              (error) => reject(error),
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              }
            );
          });
        });
        const newImageUrls = await Promise.all(uploadPromises);
        imageUrls = [...imageUrls, ...newImageUrls];
      }

      let mainImageUrl = form.mainImageUrl;
      if (!mainImageUrl && imageUrls.length > 0) {
        mainImageUrl = imageUrls[0];
      }

      const data = {
        name: form.name,
        description: form.description,
        importantNotes: form.importantNotes,
        whatsIncluded: form.whatsIncluded,
        subCategoryId: form.subCategoryId,
        cost: Number(form.cost),
        duration: Number(form.duration),
        graceTime: form.graceTime ? Number(form.graceTime) : 0,
        bufferTime: form.bufferTime ? Number(form.bufferTime) : 0,
        active: !!form.active,
        imageUrls: imageUrls,
        mainImageUrl: mainImageUrl,
        updatedAt: serverTimestamp(),
        relatedServices: form.relatedServices || [],
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
      setForm({ name: "", description: "", importantNotes: [], whatsIncluded: [], categoryId: "", cost: "", duration: "", graceTime: "", bufferTime: "", active: true, imageUrls: [], mainImageUrl: "", relatedServices: [] });
      setImageFiles([]);
      setImagePreviews([]);
      setUploadProgress(0);
      setSelectedService(null);
    } catch (err) {
      toast({ title: "Error saving service", status: "error", description: err.message });
    }
    setLoading(false);
  };

  const openEdit = (service) => {
    setSelectedService(service);
    setForm(service
      ? {
          name: service.name || "",
          description: service.description || "",
          importantNotes: service.importantNotes || [],
          whatsIncluded: service.whatsIncluded || [],
          subCategoryId: service.subCategoryId || "",
          cost: service.cost || "",
          duration: service.duration || "",
          graceTime: service.graceTime || "",
          bufferTime: service.bufferTime || "",
          active: service.active !== undefined ? service.active : true,
          imageUrls: service.imageUrls || [],
          mainImageUrl: service.mainImageUrl || "",
          relatedServices: service.relatedServices || [],
        }
      : { name: "", description: "", importantNotes: [], whatsIncluded: [], categoryId: "", cost: "", duration: "", graceTime: "", bufferTime: "", active: true, imageUrls: [], mainImageUrl: "", relatedServices: [] }
    );
    setImageFiles([]);
    setImagePreviews(service && service.imageUrls ? service.imageUrls : []);
    setUploadProgress(0);
    onOpen();
  };

  const [deleteModal, setDeleteModal] = useState({ open: false, service: null });
  const handleDelete = async () => {
    const service = deleteModal.service;
    if (!service) return;
    setLoading(true);
    try {
      if (service.imageUrls && service.imageUrls.length > 0) {
        const deletePromises = service.imageUrls.map(url => {
          const imageRef = ref(storage, url);
          return deleteObject(imageRef);
        });
        await Promise.all(deletePromises);
      }
      await deleteDoc(doc(firestore, "services", service.id));
      toast({ title: "Service deleted" });
      fetchServices();
    } catch (err) {
      toast({ title: "Error deleting service", status: "error", description: err.message });
    }
    setDeleteModal({ open: false, service: null });
    setLoading(false);
  };

  const columns = useMemo(() => [
    {
      Header: "Image",
      accessor: "mainImageUrl",
      Cell: ({ value, row }) => {
        const src = value || (row.original.imageUrls && row.original.imageUrls[0]);
        return src ? <img src={src} alt="service" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6 }} /> : "-";
      },
      disableSortBy: true,
    },
    { Header: "Name", accessor: "name" },
    { Header: "Sub-Category", accessor: "subCategoryId", Cell: ({ value }) => {
      const category = subCategories.find(c => c.id === value);
      return category ? category.name : "Not Assigned";
    }},
    { Header: "Cost", accessor: "cost" },
    { Header: "Duration (min)", accessor: "duration" },
    { Header: "Active", accessor: "active", Cell: ({ value }) => value ? "Yes" : "No" },
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
            <MenuItem onClick={() => setDeleteModal({ open: true, service: row.original })}>Delete</MenuItem>
          </MenuList>
        </Menu>
      ),
      disableSortBy: true,
    },
  ], [subCategories]);

  const filteredServices = useMemo(() => {
    if (!search) return services;
    const q = search.toLowerCase();
    return services.filter(s =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.cost && String(s.cost).includes(q)) ||
      (s.duration && String(s.duration).includes(q)) ||
      (s.subCategoryId && subCategories.find(c => c.id === s.subCategoryId)?.name?.toLowerCase().includes(q))
    );
  }, [search, services]);

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
      data: filteredServices,
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
      <Flex mb={4} gap={4} flexWrap="wrap" align="center" justify="space-between">
        <InputGroup maxW="250px" boxShadow="sm">
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search by name, category, or value"
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
      {deleteModal.open && (
        <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, service: null })} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Delete Service</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              Are you sure you want to delete service <b>{deleteModal.service?.name}</b>? This cannot be undone.<br/>
              <Box mt={2} color="red.500" fontSize="sm">This will permanently remove the service and all its images from the system.</Box>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="red" mr={3} onClick={handleDelete} isLoading={loading} loadingText="Deleting...">Delete</Button>
              <Button variant="ghost" onClick={() => setDeleteModal({ open: false, service: null })} isDisabled={loading}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
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
                  <FormControl mb={3}>
                    <FormLabel>Service Images</FormLabel>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={e => {
                        const files = Array.from(e.target.files);
                        if (files.length > 0) {
                          setImageFiles(files);
                          const previewUrls = files.map(file => URL.createObjectURL(file));
                          setImagePreviews(previewUrls);
                        } else {
                          setImageFiles([]);
                          setImagePreviews(form.imageUrls || []);
                        }
                      }}
                    />
                    <Flex mt={2} wrap="wrap" gap={2}>
                      {imagePreviews.map((preview, index) => (
                        <Box key={index} position="relative">
                          <img
                            src={preview}
                            alt={`Service Image Preview ${index + 1}`}
                            style={{ maxWidth: "60px", maxHeight: "60px", borderRadius: 8, border: form.mainImageUrl === preview ? "2px solid orange" : "1px solid #eee" }}
                          />
                          <IconButton
                            icon={<CloseIcon />}
                            size="xs"
                            position="absolute"
                            top="-5px"
                            right="-5px"
                            onClick={() => handleImageRemove(index)}
                          />
                          <Button size="xs" position="absolute" bottom="-5px" right="-5px" onClick={() => handleSetMainImage(preview)}>
                            <StarIcon color={form.mainImageUrl === preview ? "yellow.400" : "gray.300"} />
                          </Button>
                        </Box>
                      ))}
                    </Flex>
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <Box mt={1} fontSize="sm" color="gray.500">Uploading: {uploadProgress}%</Box>
                    )}
                  </FormControl>
                  <FormControl mb={3} isRequired>
                    <FormLabel>Service Name</FormLabel>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </FormControl>
                  <FormControl mb={3} isRequired>
                    <FormLabel>Sub-Category</FormLabel>
                    <Select value={form.subCategoryId} onChange={e => setForm(f => ({ ...f, subCategoryId: e.target.value }))}>
                      <option value="">Select Sub-Category</option>
                      {subCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl mb={3} isRequired>
                    <FormLabel>Cost</FormLabel>
                    <Input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} min={0} />
                  </FormControl>
                  <FormControl mb={3} isRequired>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} step="60" />
                  </FormControl>
                  <FormControl mb={3}>
                    <FormLabel>Grace Time (minutes)</FormLabel>
                    <Input type="number" value={form.graceTime} onChange={e => setForm(f => ({ ...f, graceTime: e.target.value }))} min={0} />
                  </FormControl>
                  <FormControl mb={3}>
                    <FormLabel>Buffer Time (minutes)</FormLabel>
                    <Input type="number" value={form.bufferTime} onChange={e => setForm(f => ({ ...f, bufferTime: e.target.value }))} min={0} />
                  </FormControl>
                  <FormControl mb={3} display="flex" alignItems="center">
                    <FormLabel mb={0}>Active</FormLabel>
                    <Switch isChecked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                  </FormControl>
                  <Box gridColumn={{ base: '1', md: '1 / span 2' }}>
                    <FormControl mb={3}>
                      <FormLabel>Description</FormLabel>
                      <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </FormControl>
                  </Box>
                  <Box gridColumn={{ base: '1', md: '1 / span 2' }}>
                    <FormControl mb={3}>
                      <FormLabel>Important Notes</FormLabel>
                      <VStack align="start">
                        {form.importantNotes.map((item, index) => (
                          <HStack key={index}>
                            <Input value={item} isReadOnly />
                            <IconButton icon={<CloseIcon />} size="sm" onClick={() => {
                              const newItems = [...form.importantNotes];
                              newItems.splice(index, 1);
                              setForm(f => ({ ...f, importantNotes: newItems }));
                            }}/>
                          </HStack>
                        ))}
                        <HStack>
                          <Input value={noteItem} onChange={e => setNoteItem(e.target.value)} placeholder="Add a note" />
                          <IconButton icon={<AddIcon />} size="sm" onClick={() => {
                            if (noteItem.trim() !== "") {
                              setForm(f => ({ ...f, importantNotes: [...f.importantNotes, noteItem.trim()] }));
                              setNoteItem("");
                            }
                          }}/>
                        </HStack>
                      </VStack>
                    </FormControl>
                  </Box>
                  <Box gridColumn={{ base: '1', md: '1 / span 2' }}>
                    <FormControl mb={3}>
                      <FormLabel>What's Included</FormLabel>
                      <VStack align="start">
                        {form.whatsIncluded.map((item, index) => (
                          <HStack key={index}>
                            <Input value={item} isReadOnly />
                            <IconButton icon={<CloseIcon />} size="sm" onClick={() => {
                              const newItems = [...form.whatsIncluded];
                              newItems.splice(index, 1);
                              setForm(f => ({ ...f, whatsIncluded: newItems }));
                            }}/>
                          </HStack>
                        ))}
                        <HStack>
                          <Input value={includedItem} onChange={e => setIncludedItem(e.target.value)} placeholder="Add an item" />
                          <IconButton icon={<AddIcon />} size="sm" onClick={() => {
                            if (includedItem.trim() !== "") {
                              setForm(f => ({ ...f, whatsIncluded: [...f.whatsIncluded, includedItem.trim()] }));
                              setIncludedItem("");
                            }
                          }}/>
                        </HStack>
                      </VStack>
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