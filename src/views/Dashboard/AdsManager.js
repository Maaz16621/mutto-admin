import React, { useEffect, useState, useMemo } from "react";
import { InputGroup, InputLeftElement, Tag, TagLabel, TagCloseButton } from "@chakra-ui/react";
import { SearchIcon, ChevronDownIcon } from "@chakra-ui/icons";
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
  Checkbox,
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
  IconButton
} from "@chakra-ui/react";
import "react-quill/dist/quill.snow.css";
import ReactQuill from "react-quill";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useTable, useSortBy, usePagination } from "react-table";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { firestore, storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody";
import { SimpleGrid } from "@chakra-ui/react";

export default function AdsManager() {
  const [ads, setAds] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    link: "",
    audienceNationality: [], // Changed to array
    active: true,
    imageUrl: "",
    language: "en", // New language field
  });
  const [adImageFile, setAdImageFile] = useState(null);
  const [adImagePreview, setAdImagePreview] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedAd, setSelectedAd] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
const countries = [
  { label: 'Select your Nationality', value: '' },
  { label: 'Afghanistan', value: 'Afghanistan' },
  { label: 'Albania', value: 'Albania' },
  { label: 'Algeria', value: 'Algeria' },
  { label: 'Andorra', value: 'Andorra' },
  { label: 'Angola', value: 'Angola' },
  { label: 'Antigua and Barbuda', value: 'Antigua and Barbuda' },
  { label: 'Argentina', value: 'Argentina' },
  { label: 'Armenia', value: 'Armenia' },
  { label: 'Australia', value: 'Australia' },
  { label: 'Austria', value: 'Austria' },
  { label: 'Azerbaijan', value: 'Azerbaijan' },
  { label: 'Bahamas', value: 'Bahamas' },
  { label: 'Bahrain', value: 'Bahrain' },
  { label: 'Bangladesh', value: 'Bangladesh' },
  { label: 'Barbados', value: 'Barbados' },
  { label: 'Belarus', value: 'Belarus' },
  { label: 'Belgium', value: 'Belgium' },
  { label: 'Belize', value: 'Belize' },
  { label: 'Benin', value: 'Benin' },
  { label: 'Bhutan', value: 'Bhutan' },
  { label: 'Bolivia', value: 'Bolivia' },
  { label: 'Bosnia and Herzegovina', value: 'Bosnia and Herzegovina' },
  { label: 'Botswana', value: 'Botswana' },
  { label: 'Brazil', value: 'Brazil' },
  { label: 'Brunei', value: 'Brunei' },
  { label: 'Bulgaria', value: 'Bulgaria' },
  { label: 'Burkina Faso', value: 'Burkina Faso' },
  { label: 'Burundi', value: 'Burundi' },
  { label: 'Cabo Verde', value: 'Cabo Verde' },
  { label: 'Cambodia', value: 'Cambodia' },
  { label: 'Cameroon', value: 'Cameroon' },
  { label: 'Canada', value: 'Canada' },
  { label: 'Central African Republic', value: 'Central African Republic' },
  { label: 'Chad', value: 'Chad' },
  { label: 'Chile', value: 'Chile' },
  { label: 'China', value: 'China' },
  { label: 'Colombia', value: 'Colombia' },
  { label: 'Comoros', value: 'Comoros' },
  { label: 'Congo (Congo-Brazzaville)', value: 'Congo (Congo-Brazzaville)' },
  { label: 'Costa Rica', value: 'Costa Rica' },
  { label: 'Croatia', value: 'Croatia' },
  { label: 'Cuba', value: 'Cuba' },
  { label: 'Cyprus', value: 'Cyprus' },
  { label: 'Czechia (Czech Republic)', value: 'Czechia (Czech Republic)' },
  { label: 'Democratic Republic of the Congo', value: 'Democratic Republic of the Congo' },
  { label: 'Denmark', value: 'Denmark' },
  { label: 'Djibouti', value: 'Djibouti' },
  { label: 'Dominica', value: 'Dominica' },
  { label: 'Dominican Republic', value: 'Dominican Republic' },
  { label: 'Ecuador', value: 'Ecuador' },
  { label: 'Egypt', value: 'Egypt' },
  { label: 'El Salvador', value: 'El Salvador' },
  { label: 'Equatorial Guinea', value: 'Equatorial Guinea' },
  { label: 'Eritrea', value: 'Eritrea' },
  { label: 'Estonia', value: 'Estonia' },
  { label: 'Eswatini (formerly Swaziland)', value: 'Eswatini (formerly Swaziland)' },
  { label: 'Ethiopia', value: 'Ethiopia' },
  { label: 'Fiji', value: 'Fiji' },
  { label: 'Finland', value: 'Finland' },
  { label: 'France', value: 'France' },
  { label: 'Gabon', value: 'Gabon' },
  { label: 'Gambia', value: 'Gambia' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Germany', value: 'Germany' },
  { label: 'Ghana', value: 'Ghana' },
  { label: 'Greece', value: 'Greece' },
  { label: 'Grenada', value: 'Grenada' },
  { label: 'Guatemala', value: 'Guatemala' },
  { label: 'Guinea', value: 'Guinea' },
  { label: 'Guinea-Bissau', value: 'Guinea-Bissau' },
  { label: 'Guyana', value: 'Guyana' },
  { label: 'Haiti', value: 'Haiti' },
  { label: 'Honduras', value: 'Honduras' },
  { label: 'Hungary', value: 'Hungary' },
  { label: 'Iceland', value: 'Iceland' },
  { label: 'India', value: 'India' },
  { label: 'Indonesia', value: 'Indonesia' },
  { label: 'Iran', value: 'Iran' },
  { label: 'Iraq', value: 'Iraq' },
  { label: 'Ireland', value: 'Ireland' },
  { label: 'Israel', value: 'Israel' },
  { label: 'Italy', value: 'Italy' },
  { label: 'Jamaica', value: 'Jamaica' },
  { label: 'Japan', value: 'Japan' },
  { label: 'Jordan', value: 'Jordan' },
  { label: 'Kazakhstan', value: 'Kazakhstan' },
  { label: 'Kenya', value: 'Kenya' },
  { label: 'Kiribati', value: 'Kiribati' },
  { label: 'Kuwait', value: 'Kuwait' },
  { label: 'Kyrgyzstan', value: 'Kyrgyzstan' },
  { label: 'Laos', value: 'Laos' },
  { label: 'Latvia', value: 'Latvia' },
  { label: 'Lebanon', value: 'Lebanon' },
  { label: 'Lesotho', value: 'Lesotho' },
  { label: 'Liberia', value: 'Liberia' },
  { label: 'Libya', value: 'Libya' },
  { label: 'Liechtenstein', value: 'Liechtenstein' },
  { label: 'Lithuania', value: 'Lithuania' },
  { label: 'Luxembourg', value: 'Luxembourg' },
  { label: 'Madagascar', value: 'Madagascar' },
  { label: 'Malawi', value: 'Malawi' },
  { label: 'Malaysia', value: 'Malaysia' },
  { label: 'Maldives', value: 'Maldives' },
  { label: 'Mali', value: 'Mali' },
  { label: 'Malta', value: 'Malta' },
  { label: 'Marshall Islands', value: 'Marshall Islands' },
  { label: 'Mauritania', value: 'Mauritania' },
  { label: 'Mauritius', value: 'Mauritius' },
  { label: 'Mexico', value: 'Mexico' },
  { label: 'Micronesia', value: 'Micronesia' },
  { label: 'Moldova', value: 'Moldova' },
  { label: 'Monaco', value: 'Monaco' },
  { label: 'Mongolia', value: 'Mongolia' },
  { label: 'Montenegro', value: 'Montenegro' },
  { label: 'Morocco', value: 'Morocco' },
  { label: 'Mozambique', value: 'Mozambique' },
  { label: 'Myanmar (formerly Burma)', value: 'Myanmar (formerly Burma)' },
  { label: 'Namibia', value: 'Namibia' },
  { label: 'Nauru', value: 'Nauru' },
  { label: 'Nepal', value: 'Nepal' },
  { label: 'Netherlands', value: 'Netherlands' },
  { label: 'New Zealand', value: 'New Zealand' },
  { label: 'Nicaragua', value: 'Nicaragua' },
  { label: 'Niger', value: 'Niger' },
  { label: 'Nigeria', value: 'Nigeria' },
  { label: 'North Korea', value: 'North Korea' },
  { label: 'North Macedonia (formerly Macedonia)', value: 'North Macedonia (formerly Macedonia)' },
  { label: 'Norway', value: 'Norway' },
  { label: 'Oman', value: 'Oman' },
  { label: 'Pakistan', value: 'Pakistan' },
  { label: 'Palau', value: 'Palau' },
  { label: 'Palestine State', value: 'Palestine State' },
  { label: 'Panama', value: 'Panama' },
  { label: 'Papua New Guinea', value: 'Papua New Guinea' },
  { label: 'Paraguay', value: 'Paraguay' },
  { label: 'Peru', value: 'Peru' },
  { label: 'Philippines', value: 'Philippines' },
  { label: 'Poland', value: 'Poland' },
  { label: 'Portugal', value: 'Portugal' },
  { label: 'Qatar', value: 'Qatar' },
  { label: 'Romania', value: 'Romania' },
  { label: 'Russia', value: 'Russia' },
  { label: 'Rwanda', value: 'Rwanda' },
  { label: 'Saint Kitts and Nevis', value: 'Saint Kitts and Nevis' },
  { label: 'Saint Lucia', value: 'Saint Lucia' },
  { label: 'Saint Vincent and the Grenadines', value: 'Saint Vincent and the Grenadines' },
  { label: 'Samoa', value: 'Samoa' },
  { label: 'San Marino', value: 'San Marino' },
  { label: 'Sao Tome and Principe', value: 'Sao Tome and Principe' },
  { label: 'Saudi Arabia', value: 'Saudi Arabia' },
  { label: 'Senegal', value: 'Senegal' },
  { label: 'Serbia', value: 'Serbia' },
  { label: 'Seychelles', value: 'Seychelles' },
  { label: 'Sierra Leone', value: 'Sierra Leone' },
  { label: 'Singapore', value: 'Singapore' },
  { label: 'Slovakia', value: 'Slovakia' },
  { label: 'Slovenia', value: 'Slovenia' },
  { label: 'Solomon Islands', value: 'Solomon Islands' },
  { label: 'Somalia', value: 'Somalia' },
  { label: 'South Africa', value: 'South Africa' },
  { label: 'South Korea', value: 'South Korea' },
  { label: 'South Sudan', value: 'South Sudan' },
  { label: 'Spain', value: 'Spain' },
  { label: 'Sri Lanka', value: 'Sri Lanka' },
  { label: 'Sudan', value: 'Sudan' },
  { label: 'Suriname', value: 'Suriname' },
  { label: 'Sweden', value: 'Sweden' },
  { label: 'Switzerland', value: 'Switzerland' },
  { label: 'Syria', value: 'Syria' },
  { label: 'Taiwan', value: 'Taiwan' },
  { label: 'Tajikistan', value: 'Tajikistan' },
  { label: 'Tanzania', value: 'Tanzania' },
  { label: 'Thailand', value: 'Thailand' },
  { label: 'Timor-Leste', value: 'Timor-Leste' },
  { label: 'Togo', value: 'Togo' },
  { label: 'Tonga', value: 'Tonga' },
  { label: 'Trinidad and Tobago', value: 'Trinidad and Tobago' },
  { label: 'Tunisia', value: 'Tunisia' },
  { label: 'Turkey', value: 'Turkey' },
  { label: 'Turkmenistan', value: 'Turkmenistan' },
  { label: 'Tuvalu', value: 'Tuvalu' },
  { label: 'Uganda', value: 'Uganda' },
  { label: 'Ukraine', value: 'Ukraine' },
  { label: 'United Arab Emirates', value: 'United Arab Emirates' },
  { label: 'United Kingdom', value: 'United Kingdom' },
  { label: 'United States', value: 'United States' },
  { label: 'Uruguay', value: 'Uruguay' },
  { label: 'Uzbekistan', value: 'Uzbekistan' },
  { label: 'Vanuatu', value: 'Vanuatu' },
  { label: 'Vatican City', value: 'Vatican City' },
  { label: 'Venezuela', value: 'Venezuela' },
  { label: 'Vietnam', value: 'Vietnam' },
  { label: 'Yemen', value: 'Yemen' },
  { label: 'Zambia', value: 'Zambia' },
  { label: 'Zimbabwe', value: 'Zimbabwe' },
];
  const fetchAds = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(firestore, "ads"));
      setAds(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      toast({ title: "Error fetching ads", status: "error", description: err.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAds();
  }, []);

  const handleSave = async () => {
    if (!form.title) {
      toast({ title: "Title is required", status: "warning" });
      return;
    }
    setLoading(true);
    let imageUrl = form.imageUrl;
    try {
      if (adImageFile) {
        const fileExt = adImageFile.name.split('.').pop();
        const fileName = `ad-images/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const storageRef = ref(storage, fileName);
        const uploadTask = uploadBytesResumable(storageRef, adImageFile);
        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
            },
            (error) => reject(error),
            async () => {
              imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
      }
      const data = {
        title: form.title,
        link: form.link,
        audienceNationality: form.audienceNationality,
        active: !!form.active,
        imageUrl: imageUrl || "",
        language: form.language, // Save language
        updatedAt: serverTimestamp(),
      };
      if (selectedAd) {
        await updateDoc(doc(firestore, "ads", selectedAd.id), data);
        toast({ title: "Ad updated" });
      } else {
        await addDoc(collection(firestore, "ads"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Ad added" });
      }
      fetchAds();
      onClose();
      setForm({ title: "", link: "", audienceNationality: [], active: true, imageUrl: "", language: "en" });
      setAdImageFile(null);
      setAdImagePreview("");
      setUploadProgress(0);
      setSelectedAd(null);
    } catch (err) {
      toast({ title: "Error saving ad", status: "error", description: err.message });
    }
    setLoading(false);
  };

  const openEdit = (ad) => {
    setSelectedAd(ad);
    setForm(ad
      ? {
          title: ad.title || "",
          link: ad.link || "",
          audienceNationality: ad.audienceNationality || [],
          active: ad.active !== undefined ? ad.active : true,
          imageUrl: ad.imageUrl || "",
          language: ad.language || "en", // Populate language
        }
      : { title: "", link: "", audienceNationality: [], active: true, imageUrl: "", language: "en" } // Default language for new ad
    );
    setAdImageFile(null);
    setAdImagePreview(ad && ad.imageUrl ? ad.imageUrl : "");
    setUploadProgress(0);
    onOpen();
  };

  const [deleteModal, setDeleteModal] = useState({ open: false, ad: null });
  const handleDelete = async () => {
    const ad = deleteModal.ad;
    if (!ad) return;
    setLoading(true);
    try {
      await deleteDoc(doc(firestore, "ads", ad.id));
      toast({ title: "Ad deleted" });
      fetchAds();
    } catch (err) {
      toast({ title: "Error deleting ad", status: "error", description: err.message });
    }
    setDeleteModal({ open: false, ad: null });
    setLoading(false);
  };

  const columns = useMemo(() => [
    {
      Header: "Image",
      accessor: "imageUrl",
      Cell: ({ value }) => value ? <img src={value} alt="ad" style={{ width: 100, height: 'auto', objectFit: 'cover', borderRadius: 6 }} /> : "-",
      disableSortBy: true,
    },
    { Header: "Title", accessor: "title" },
    { Header: "Link", accessor: "link", Cell: ({ value }) => value ? <a href={value} target="_blank" rel="noopener noreferrer">{value}</a> : "-" },
    { Header: "Audience", accessor: "audienceNationality", Cell: ({ value }) => (value && Array.isArray(value) ? value.join(", ") : "-") },
    { Header: "Language", accessor: "language" },
    { Header: "Impressions", accessor: "impression" },
    { Header: "Clicks", accessor: "clicks" },
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
            <MenuItem onClick={() => setDeleteModal({ open: true, ad: row.original })}>Delete</MenuItem>
          </MenuList>
        </Menu>
      ),
      disableSortBy: true,
    },
  ], []);

  const filteredAds = useMemo(() => {
    if (!search) return ads;
    const q = search.toLowerCase();
    return ads.filter(ad =>
      (ad.title && ad.title.toLowerCase().includes(q)) ||
      (ad.audienceNationality && ad.audienceNationality.toLowerCase().includes(q))
    );
  }, [search, ads]);

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
      data: filteredAds,
      initialState: { pageSize: 10 },
      autoResetPage: false,
    },
    useSortBy,
    usePagination
  );


  const handleNationalityChange = (nationality) => {
    setForm(prevForm => {
      const currentNationalities = prevForm.audienceNationality || [];
      if (currentNationalities.includes(nationality)) {
        return { ...prevForm, audienceNationality: currentNationalities.filter(n => n !== nationality) };
      } else {
        return { ...prevForm, audienceNationality: [...currentNationalities, nationality] };
      }
    });
  };

  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }}>
      <Card overflowX={{ sm: "scroll", xl: "hidden" }} pb="0px">
        <CardHeader p="6px 0px 22px 0px">
          <Flex justify="space-between" align="center">
            <Heading size="md">Ads Manager</Heading>
            <Button colorScheme="orange" onClick={() => openEdit(null)}>Add Ad</Button>
          </Flex>
        </CardHeader>
        <Flex mb={4} gap={4} flexWrap="wrap" align="center" justify="space-between">
          <InputGroup maxW="250px" boxShadow="sm">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search by title or audience"
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
        <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, ad: null })} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Delete Ad</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              Are you sure you want to delete ad <b>{deleteModal.ad?.title}</b>? This cannot be undone.
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="red" mr={3} onClick={handleDelete} isLoading={loading} loadingText="Deleting...">Delete</Button>
              <Button variant="ghost" onClick={() => setDeleteModal({ open: false, ad: null })} isDisabled={loading}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
      {isOpen && (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="xl">
          <ModalOverlay />
          <ModalContent maxW="600px">
            <ModalHeader>{selectedAd ? "Edit Ad" : "Add Ad"}</ModalHeader>
            <ModalCloseButton />
            <ModalBody overflowY="auto">
              {loading && (
                <Flex position="absolute" top={0} left={0} right={0} bottom={0} align="center" justify="center" zIndex={10} bg="rgba(255,255,255,0.6)">
                  <Spinner size="lg" color="orange.400" thickness="4px" speed="0.65s" />
                </Flex>
              )}
              <Box>
                <SimpleGrid columns={1} spacing={4}>
                  <FormControl mb={3}>
                    <FormLabel>Ad Image</FormLabel>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files[0];
                        if (file) {
                          setAdImageFile(file);
                          setAdImagePreview(URL.createObjectURL(file));
                        } else {
                          setAdImageFile(null);
                          setAdImagePreview(form.imageUrl || "");
                        }
                      }}
                    />
                    {(adImagePreview || form.imageUrl) && (
                      <Box mt={2}>
                        <img
                          src={adImagePreview || form.imageUrl}
                          alt="Ad Preview"
                          style={{ maxWidth: "100px", maxHeight: "100px", borderRadius: 8, border: "1px solid #eee" }}
                        />
                      </Box>
                    )}
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <Box mt={1} fontSize="sm" color="gray.500">Uploading: {uploadProgress}%</Box>
                    )}
                  </FormControl>
                  <FormControl mb={3} isRequired>
                    <FormLabel>Title</FormLabel>
                    <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  </FormControl>
                  <FormControl mb={3}>
                    <FormLabel>Link (Optional)</FormLabel>
                    <Input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} />
                  </FormControl>
               
                  <FormControl mb={3}>
                    <FormLabel>Audience Nationality</FormLabel>
                    <Menu closeOnSelect={false}>
                      <MenuButton as={Button} rightIcon={<ChevronDownIcon />} width="100%" textAlign="left">
                        {form.audienceNationality.length > 0
                          ? form.audienceNationality.map(nat => <Tag size="sm" key={nat} mr={1}>{nat}</Tag>)
                          : "Select nationalities"}
                      </MenuButton>
                      <MenuList>
                        {countries.slice(1).map(country => (
                          <MenuItem key={country.value} onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              isChecked={form.audienceNationality.includes(country.value)}
                              onChange={() => handleNationalityChange(country.value)}
                            >
                              {country.label}
                            </Checkbox>
                          </MenuItem>
                        ))}
                      </MenuList>
                    </Menu>
                  </FormControl>
                  <FormControl mb={3}>
                    <FormLabel>Language</FormLabel>
                    <Select placeholder="Select language" value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                      <option value="en">English</option>
                      <option value="ar">Arabic</option>
                      <option value="ru">Russian</option>
                      <option value="hi">Hindi</option>
                      <option value="no">Norwegian</option>
                    </Select>
                  </FormControl>
                  <FormControl mb={3} display="flex" alignItems="center">
                    <FormLabel mb={0}>Active</FormLabel>
                    <Switch isChecked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
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
