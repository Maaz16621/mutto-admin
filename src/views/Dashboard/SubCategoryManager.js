import React, { useEffect, useState, useMemo } from "react";
import { Box, Button, Flex, Heading, Input, Table, Thead, Tbody, Tr, Th, Td, InputGroup, InputLeftElement, useToast, Spinner, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, useDisclosure, FormControl, FormLabel, Select, Tooltip, Icon, Menu, MenuButton, MenuList, MenuItem, IconButton } from "@chakra-ui/react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useTable, useGlobalFilter, useSortBy, usePagination, useFilters } from "react-table";
import { SearchIcon } from "@chakra-ui/icons";
import { collection, getDocs, setDoc, updateDoc, doc, query, serverTimestamp } from "firebase/firestore";
import { firestore, storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody";
export default function SubCategoryManager() {
  const [deleteModal, setDeleteModal] = useState({ open: false, subCategory: null });
  const [subCategories, setSubCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubCategory, setSelectedSubCategory] = useState(null);
  const [form, setForm] = useState({ name: "", mainCategoryId: "", iconUrl: "" });
  const [iconFile, setIconFile] = useState(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const fetchCategories = async () => {
    try {
      const q = query(collection(firestore, "categories"));
      const querySnapshot = await getDocs(q);
      const categoryList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(categoryList);
    } catch (err) {
      toast({ title: "Error fetching categories", status: "error", description: err.message });
    }
  };

  const fetchSubCategories = async () => {
    setLoading(true);
    try {
      const q = query(collection(firestore, "subCategories"));
      const querySnapshot = await getDocs(q);
      const subCategoryList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSubCategories(subCategoryList);
    } catch (err) {
      toast({ title: "Error fetching sub-categories", status: "error", description: err.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
    fetchSubCategories();
  }, []);

  const handleSave = async () => {
    if (!form.name || !form.mainCategoryId) {
      toast({ title: "Sub-category name and main category are required", status: "warning", position: "top-right" });
      return;
    }
    setLoading(true);
    try {
      let iconUrl = form.iconUrl;
      if (iconFile) {
        try {
          const iconRef = ref(storage, `sub-category-icons/${Date.now()}_${iconFile.name}`);
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
      if (selectedSubCategory) {
        await updateDoc(doc(firestore, "subCategories", selectedSubCategory.id), {
          name: form.name,
          mainCategoryId: form.mainCategoryId,
          iconUrl,
        });
        toast({ title: "Sub-category updated", position: "top-right" });
      } else {
        await setDoc(doc(collection(firestore, "subCategories")), {
          name: form.name,
          mainCategoryId: form.mainCategoryId,
          iconUrl,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Sub-category added", position: "top-right" });
      }
      fetchSubCategories();
      onClose();
      setForm({ name: "", mainCategoryId: "", iconUrl: "" });
      setIconFile(null);
      setSelectedSubCategory(null);
    } catch (err) {
      toast({ title: "Error saving sub-category", status: "error", description: err.message, position: "top-right" });
    }
    setLoading(false);
  };

  const openEdit = (subCategory) => {
    setSelectedSubCategory(subCategory);
    setForm(subCategory
      ? {
          name: subCategory.name || "",
          mainCategoryId: subCategory.mainCategoryId || "",
          iconUrl: subCategory.iconUrl || "",
        }
      : { name: "", mainCategoryId: "", iconUrl: "" }
    );
    setIconFile(null);
    onOpen();
  };

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
        Header: "Main Category",
        accessor: "mainCategoryId",
        Cell: ({ value }) => categories.find(c => c.id === value)?.name || value,
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
            <MenuItem onClick={() => setDeleteModal({ open: true, subCategory: row.original })}>Delete</MenuItem>
          </MenuList>
        </Menu>
      ),
      disableSortBy: true,
      Filter: () => null,
    },
  ], [categories]);

  const handleDelete = async () => {
    const subCategory = deleteModal.subCategory;
    if (!subCategory) return;
    setLoading(true);
    try {
      if (subCategory.iconUrl) {
        try {
          const iconRef = ref(storage, subCategory.iconUrl);
          await deleteObject(iconRef);
        } catch (err) {
          toast({ title: "Warning", description: "Could not delete icon from storage.", status: "warning", position: "top-right" });
        }
      }
      await import("firebase/firestore").then(({ deleteDoc, doc }) => deleteDoc(doc(firestore, "subCategories", subCategory.id)));
      toast({ title: "Sub-category deleted", status: "success", position: "top-right" });
      fetchSubCategories();
    } catch (err) {
      toast({ title: "Error deleting sub-category", description: err.message, status: "error", position: "top-right" });
    }
    setDeleteModal({ open: false, subCategory: null });
    setLoading(false);
  };

  const filteredData = useMemo(() => {
    let data = subCategories;
    if (globalFilter) {
      const lower = globalFilter.toLowerCase();
      data = data.filter(row =>
        row.name?.toLowerCase().includes(lower)
      );
    }
    return data;
  }, [subCategories, globalFilter]);

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

  useEffect(() => {
    setTableGlobalFilter(globalFilter);
  }, [globalFilter, setTableGlobalFilter]);

  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }}>
      <Card overflowX={{ sm: "scroll", xl: "hidden" }} pb="0px">
        <CardHeader p="6px 0px 22px 0px">
          <Flex justify="space-between" align="center">
            <Heading size="md">Sub-Category Manager</Heading>
            <Button colorScheme="orange" onClick={() => openEdit(null)}>Add Sub-Category</Button>
          </Flex>
        </CardHeader>
        <CardBody>
          <Flex mb={4} gap={4} flexWrap="wrap" align="center" justify="space-between">
            <InputGroup maxW="250px" boxShadow="sm">
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search by name"
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                size="sm"
                bg="white"
                borderRadius="md"
                boxShadow="sm"
              />
            </InputGroup>
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
          <ModalHeader>{selectedSubCategory ? "Edit Sub-Category" : "Add Sub-Category"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto">
            {loading && (
              <Flex position="absolute" top={0} left={0} right={0} bottom={0} align="center" justify="center" zIndex={10} bg="rgba(255,255,255,0.6)">
                <Spinner size="lg" color="orange.400" thickness="4px" speed="0.65s" />
              </Flex>
            )}
            <FormControl mb={3} isRequired>
              <FormLabel>Main Category</FormLabel>
              <Select value={form.mainCategoryId} onChange={e => setForm(f => ({ ...f, mainCategoryId: e.target.value }))}>
                <option value="">Select Main Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </Select>
            </FormControl>
            <FormControl mb={3} isRequired>
              <FormLabel>Name</FormLabel>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </FormControl>
            <FormControl mb={3}>
              <FormLabel>Icon Image</FormLabel>
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
      
      <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, subCategory: null })} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete Sub-Category</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            Are you sure you want to delete sub-category <b>{deleteModal.subCategory?.name}</b>? This cannot be undone.
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="red" mr={3} onClick={handleDelete} isLoading={loading} loadingText="Deleting...">Delete</Button>
            <Button variant="ghost" onClick={() => setDeleteModal({ open: false, subCategory: null })} isDisabled={loading}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
}