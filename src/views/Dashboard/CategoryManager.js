import React, { useEffect, useState, useMemo } from "react";
import { Box, Button, Flex, Heading, Input, Table, Thead, Tbody, Tr, Th, Td, InputGroup, InputLeftElement, useToast, Spinner, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, useDisclosure, FormControl, FormLabel, Select, Tooltip, Icon } from "@chakra-ui/react";
import { useTable, useGlobalFilter, useSortBy, usePagination, useFilters } from "react-table";
import { SearchIcon } from "@chakra-ui/icons";
import { collection, getDocs, setDoc, updateDoc, doc, query, serverTimestamp } from "firebase/firestore";
import { firestore, storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody";
export default function CategoryManager() {
  const [deleteModal, setDeleteModal] = useState({ open: false, category: null });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", iconUrl: "" });
  const [iconFile, setIconFile] = useState(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Fetch categories
  const fetchCategories = async () => {
    setLoading(true);
    try {
      const q = query(collection(firestore, "categories"));
      const querySnapshot = await getDocs(q);
      const categoryList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(categoryList);
    } catch (err) {
      toast({ title: "Error fetching categories", status: "error", description: err.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Add or update category
  const handleSave = async () => {
    if (!form.name) {
      toast({ title: "Category name required", status: "warning", position: "top-right" });
      return;
    }
    setLoading(true);
    try {
      let iconUrl = form.iconUrl;
      if (iconFile) {
        try {
          const iconRef = ref(storage, `category-icons/${Date.now()}_${iconFile.name}`);
          await uploadBytes(iconRef, iconFile);
          iconUrl = await getDownloadURL(iconRef);
        } catch (uploadErr) {
          toast({
            title: "Icon upload failed",
            status: "error",
            description: uploadErr.message || "Could not upload icon. Please check your Firebase Storage setup.",
            position: "top-right",
            duration: 8000,
            isClosable: true,
          });
          setLoading(false);
          return;
        }
      }
      if (selectedCategory) {
        // Edit category
        await updateDoc(doc(firestore, "categories", selectedCategory.id), {
          name: form.name,
          description: form.description,
          iconUrl,
        });
        toast({ title: "Category updated", position: "top-right" });
      } else {
        // Add category with Firestore auto-generated unique ID
        const docRef = await setDoc(doc(collection(firestore, "categories")), {
          name: form.name,
          description: form.description,
          iconUrl,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Category added", position: "top-right" });
      }
      fetchCategories();
      onClose();
      setForm({ name: "", description: "", iconUrl: "" });
      setIconFile(null);
      setSelectedCategory(null);
    } catch (err) {
      toast({ title: "Error saving category", status: "error", description: err.message, position: "top-right" });
    }
    setLoading(false);
  };

  // Open modal for add/edit
  const openEdit = (category) => {
    setSelectedCategory(category);
    setForm(category
      ? {
          name: category.name || "",
          description: category.description || "",
          iconUrl: category.iconUrl || "",
        }
      : { name: "", description: "", iconUrl: "" }
    );
    setIconFile(null);
    onOpen();
  };

  // DataTable columns
  const columns = useMemo(() => [
    {
      Header: "Icon",
      accessor: "iconUrl",
      Cell: ({ value }) => value ? <img src={value} alt="icon" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6 }} /> : "-",
      disableSortBy: true,
      Filter: () => null,
    },
    {
      Header: "Name",
      accessor: "name",
      Filter: () => null,
    },
    {
      Header: "Description",
      accessor: "description",
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
        <Flex>
          <Button size="sm" onClick={() => openEdit(row.original)} colorScheme="blue" mr={2}>Edit</Button>
          <Button size="sm" colorScheme="red" onClick={() => setDeleteModal({ open: true, category: row.original })}>Delete</Button>
        </Flex>
      ),
      disableSortBy: true,
      Filter: () => null,
    },
  ], []);

  // Delete category (with icon)
  const handleDelete = async () => {
    const category = deleteModal.category;
    if (!category) return;
    setLoading(true);
    try {
      // Delete icon from storage if exists
      if (category.iconUrl) {
        try {
          const iconRef = ref(storage, category.iconUrl);
          await deleteObject(iconRef);
        } catch (err) {
          // Ignore storage error, show toast
          toast({ title: "Warning", description: "Could not delete icon from storage.", status: "warning", position: "top-right" });
        }
      }
      // Delete Firestore doc
      await import("firebase/firestore").then(({ deleteDoc, doc }) => deleteDoc(doc(firestore, "categories", category.id)));
      toast({ title: "Category deleted", status: "success", position: "top-right" });
      fetchCategories();
    } catch (err) {
      toast({ title: "Error deleting category", description: err.message, status: "error", position: "top-right" });
    }
    setDeleteModal({ open: false, category: null });
    setLoading(false);
  };

  // Filtering logic
  const filteredData = useMemo(() => {
    let data = categories;
    if (globalFilter) {
      const lower = globalFilter.toLowerCase();
      data = data.filter(row =>
        row.name?.toLowerCase().includes(lower) ||
        row.description?.toLowerCase().includes(lower)
      );
    }
    return data;
  }, [categories, globalFilter]);

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
            <Heading size="md">Category Manager</Heading>
            <Button colorScheme="orange" onClick={() => openEdit(null)}>Add Category</Button>
          </Flex>
        </CardHeader>
        <CardBody>
          <Flex mb={4} gap={4} flexWrap="wrap" align="center" justify="space-between">
            <InputGroup maxW="250px" boxShadow="sm">
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search by name or description"
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                size="sm"
                bg="white"
                borderRadius="md"
                boxShadow="sm"
              />
            </InputGroup>
            {/* No status filter needed */}
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
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent maxH="90vh">
          <ModalHeader>{selectedCategory ? "Edit Category" : "Add Category"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto">
            {loading && (
              <Flex position="absolute" top={0} left={0} right={0} bottom={0} align="center" justify="center" zIndex={10} bg="rgba(255,255,255,0.6)">
                <Spinner size="lg" color="orange.400" thickness="4px" speed="0.65s" />
              </Flex>
            )}
            <FormControl mb={3} isRequired>
              <FormLabel display="flex" alignItems="center" gap={1}>
                Name
                <Tooltip label="The name of the category (e.g., Wash, Detailing)." placement="right" hasArrow>
                  <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                </Tooltip>
              </FormLabel>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </FormControl>
            <FormControl mb={3}>
              <FormLabel display="flex" alignItems="center" gap={1}>
                Description
                <Tooltip label="A short description of the category." placement="right" hasArrow>
                  <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                </Tooltip>
              </FormLabel>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </FormControl>
            <FormControl mb={3}>
              <FormLabel display="flex" alignItems="center" gap={1}>
                Icon Image
                <Tooltip label="Upload an icon image for this category (optional)." placement="right" hasArrow>
                  <span><Icon viewBox="0 0 20 20" color="gray.400" boxSize={4}><path fill="currentColor" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14.5A6.5 6.5 0 1 0 10 17.5 6.5 6.5 0 0 0 10 3.5zm.75 10.25h-1.5v-1.5h1.5v1.5zm0-2.75h-1.5V7h1.5v4z"/></Icon></span>
                </Tooltip>
              </FormLabel>
              <Input type="file" accept="image/*" onChange={e => setIconFile(e.target.files[0])} />
              {form.iconUrl && !iconFile && (
                <Box mt={2}><img src={form.iconUrl} alt="icon" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} /></Box>
              )}
              {iconFile && (
                <Box mt={2}><span>{iconFile.name}</span></Box>
              )}
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="orange" mr={3} onClick={handleSave} isLoading={loading} loadingText="Saving...">
              Save
            </Button>
            <Button variant="ghost" onClick={onClose} isDisabled={loading}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, category: null })} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete Category</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            Are you sure you want to delete category <b>{deleteModal.category?.name}</b>? This cannot be undone.
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="red" mr={3} onClick={handleDelete} isLoading={loading} loadingText="Deleting...">Delete</Button>
            <Button variant="ghost" onClick={() => setDeleteModal({ open: false, category: null })} isDisabled={loading}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
}


