import React, { useEffect, useState, useMemo } from "react";
import { Box, Button, Flex, Heading, Input, Table, Thead, Tbody, Tr, Th, Td, InputGroup, InputLeftElement, IconButton, useToast, Spinner, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, useDisclosure, FormControl, FormLabel, Select, Tooltip, Icon, Switch, Tag, TagLabel, TagCloseButton, SimpleGrid, VStack, Menu, MenuButton, MenuList, MenuItem, Checkbox, Text } from "@chakra-ui/react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { MapContainer, TileLayer, Polygon, FeatureGroup, Circle } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';

import { useTable, useGlobalFilter, useSortBy, usePagination, useFilters } from "react-table";
import { SearchIcon } from "@chakra-ui/icons";
import { collection, getDocs, addDoc, updateDoc, doc, query, where, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { firestore } from "../../firebase";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody";

const API_BASE_URL = process.env.NODE_ENV === 'development' ? 'https://mutto-api--mutto-84d97.asia-east1.hosted.app' : 'https://mutto-api--mutto-84d97.asia-east1.hosted.app';

export default function WorkerManagement() {
  const [deleteModal, setDeleteModal] = useState({ open: false, worker: null });
  const [workers, setWorkers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [form, setForm] = useState({ userName: "", email: "", password: "", phoneNumber: "", assignedServices: [], autoAccept: false, status: "active" });
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Location modal state and handlers
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationUrl, setLocationUrl] = useState("");
  const [selectedWorkerForLocation, setSelectedWorkerForLocation] = useState(null);

  // State for the map modal
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [selectedWorkerForArea, setSelectedWorkerForArea] = useState(null);
  const [serviceArea, setServiceArea] = useState(null);
  const [companySettings, setCompanySettings] = useState(null);
  const [newOffDate, setNewOffDate] = useState("");

  const openLocationModal = (worker) => {
    setSelectedWorkerForLocation(worker);
    if (worker.location && worker.location.latitude && worker.location.longitude) {
      const url = `https://www.google.com/maps?q=${worker.location.latitude},${worker.location.longitude}&z=15&output=embed`;
      setLocationUrl(url);
    } else {
      setLocationUrl("");
    }
    setLocationModalOpen(true);
  };

  const closeLocationModal = () => {
    setLocationModalOpen(false);
    setLocationUrl("");
    setSelectedWorkerForLocation(null);
  };

  // Map modal handlers
  const openMapModal = (worker) => {
    setSelectedWorkerForArea(worker);
    if (worker.serviceArea) {
      let areaToDisplay = { ...worker.serviceArea };
      // Convert polygon coordinates back to the format Leaflet expects
      if (areaToDisplay.geometry.type === 'Polygon') {
        areaToDisplay.geometry.coordinates = [areaToDisplay.geometry.coordinates.map(p => [p.lng, p.lat])];
      }
      setServiceArea(areaToDisplay);
    } else {
      setServiceArea(null);
    }
    setMapModalOpen(true);
  };

  const closeMapModal = () => {
    setMapModalOpen(false);
    setSelectedWorkerForArea(null);
    setServiceArea(null);
  };

  const handleSaveArea = async () => {
    if (!selectedWorkerForArea || !serviceArea) return;

    // Deep copy the object to avoid state mutation before saving
    let areaToSave = JSON.parse(JSON.stringify(serviceArea));

    // Convert polygon coordinates to a Firestore-compatible format
    if (areaToSave.geometry.type === 'Polygon') {
      areaToSave.geometry.coordinates = areaToSave.geometry.coordinates[0].map(p => ({ lat: p[1], lng: p[0] }));
    }

    setLoading(true);
    try {
      await updateDoc(doc(firestore, "workers", selectedWorkerForArea.id), { serviceArea: areaToSave });
      toast({ title: "Service area updated", position: "top-right" });
      fetchWorkers(); // Refetch to get the latest data
      closeMapModal();
    } catch (err) {
      toast({ title: "Error saving service area", status: "error", description: err.message, position: "top-right" });
    }
    setLoading(false);
  };

  const onCreated = (e) => {
    const { layerType, layer } = e;
    const shape = layer.toGeoJSON();
    // For circles, leaflet-draw doesn't store radius in GeoJSON, so we add it manually.
    if (layerType === 'circle') {
      shape.properties.radius = layer.getRadius();
    }
    setServiceArea(shape);
  };

  const onEdited = (e) => {
    e.layers.eachLayer(layer => {
      const shape = layer.toGeoJSON();
      // For circles, we need to manually add the radius as it's not in the GeoJSON.
      if (layer.getRadius) {
        shape.properties.radius = layer.getRadius();
      }
      setServiceArea(shape);
    });
  };

  const onDeleted = () => {
    setServiceArea(null);
  };

  const handleAddOffDate = () => {
    if (newOffDate && !form.offDates.includes(newOffDate)) {
      setForm(f => ({ ...f, offDates: [...f.offDates, newOffDate] }));
      setNewOffDate("");
    }
  };

  const handleRemoveOffDate = (dateToRemove) => {
    setForm(f => ({ ...f, offDates: f.offDates.filter(date => date !== dateToRemove) }));
  };

  const fetchCompanySettings = async () => {
    try {
      const settingsDocRef = doc(firestore, "settings", "appSettings");
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        setCompanySettings(docSnap.data());
      } else {
        toast({ title: "Company settings not found", status: "warning" });
      }
    } catch (err) {
      toast({ title: "Error fetching company settings", status: "error", description: err.message });
    }
  };

  // Fetch workers
  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const q = query(collection(firestore, "workers"));
      const querySnapshot = await getDocs(q);
      const workerList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWorkers(workerList);
    } catch (err) {
      toast({ title: "Error fetching workers", status: "error", description: err.message });
    }
    setLoading(false);
  };

  // Fetch services for assignment
  const fetchServices = async () => {
    try {
      const querySnapshot = await getDocs(collection(firestore, "services"));
      setServices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      toast({ title: "Error fetching services", status: "error", description: err.message });
    }
  };

  useEffect(() => {
    fetchWorkers();
    fetchServices();
    fetchCompanySettings();
  }, []);

  // Add or update worker
  const handleSave = async () => {
    if (!form.userName || !form.email || (!selectedWorker && !form.password) || !form.phoneNumber) {
      toast({ title: "User Name, Email, Password, and Phone Number are required", status: "warning", position: "top-right" });
      return;
    }
    setLoading(true);
    try {
      if (selectedWorker) {
        // Edit worker (no password change)
        const updateData = { ...form };
        delete updateData.password;
        await updateDoc(doc(firestore, "workers", selectedWorker.id), updateData);
        toast({ title: "Worker updated", position: "top-right" });
      } else {
        // Add worker: create user in Firebase Auth, then Firestore (with auth.uid as doc id)
        const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
        const user = userCredential.user;
        await setDoc(doc(firestore, "workers", user.uid), {
          userName: form.userName,
          email: form.email,
          phoneNumber: form.phoneNumber,
          assignedServices: form.assignedServices,
          autoAccept: form.autoAccept,
          status: form.status,
          dailyWorkingHours: form.dailyWorkingHours,
          offDates: form.offDates,
          lastLogin: null,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Worker added", position: "top-right" });
      }
      fetchWorkers();
      onClose();
      const defaultHours = companySettings?.dailyWorkingHours || {};
      setForm({ userName: "", email: "", password: "", phoneNumber: "", assignedServices: [], autoAccept: false, status: "active", dailyWorkingHours: defaultHours, offDates: [] });
      setSelectedWorker(null);
    } catch (err) {
      toast({ title: "Error saving worker", status: "error", description: err.message, position: "top-right" });
    }
    setLoading(false);
  };

  // Open modal for add/edit
  const openEdit = (worker) => {
    setSelectedWorker(worker);

    const defaultHours = companySettings?.dailyWorkingHours || {};

    setForm(worker
      ? {
          userName: worker.userName || "",
          email: worker.email || "",
          password: "",
          phoneNumber: worker.phoneNumber || "",
          assignedServices: worker.assignedServices || [],
          autoAccept: worker.autoAccept || false,
          status: worker.status || "active",
          dailyWorkingHours: worker.dailyWorkingHours || defaultHours,
          offDates: worker.offDates || [],
        }
      : { 
          userName: "", 
          email: "", 
          password: "", 
          phoneNumber: "", 
          assignedServices: [], 
          autoAccept: false, 
          status: "active", 
          dailyWorkingHours: defaultHours, 
          offDates: [] 
        }
    );
    onOpen();
  };

  // Toggle status (active/suspended)
  const handleToggleStatus = async (worker) => {
    try {
      await updateDoc(doc(firestore, "workers", worker.id), { status: worker.status === "active" ? "suspended" : "active" });
      toast({ title: `Worker ${worker.status === "active" ? "suspended" : "activated"}`, position: "top-right" });
      fetchWorkers();
    } catch (err) {
      toast({ title: "Error updating status", status: "error", description: err.message, position: "top-right" });
    }
  };

  // DataTable columns
  const columns = useMemo(() => [
    {
      Header: "User Name",
      accessor: "userName",
    },
    {
      Header: "Email",
      accessor: "email",
    },
    {
      Header: "Phone Number",
      accessor: "phoneNumber",
    },
    {
      Header: "Auto Accept",
      accessor: "autoAccept",
      Cell: ({ value }) => value ? "Yes" : "No",
    },
    {
      Header: "Status",
      accessor: "status",
    },
    {
      Header: "Last Login",
      accessor: "lastLogin",
      Cell: ({ value }) => value ? new Date(value.seconds * 1000).toLocaleString() : "-",
    },
    {
      Header: "Created At",
      accessor: "createdAt",
      Cell: ({ value }) => value ? new Date(value.seconds * 1000).toLocaleString() : "-",
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
            <MenuItem onClick={() => setDeleteModal({ open: true, worker: row.original })}>Delete</MenuItem>
            <MenuItem onClick={() => handleToggleStatus(row.original)}>{row.original.status === "active" ? "Suspend" : "Activate"}</MenuItem>
            <MenuItem onClick={() => openLocationModal(row.original)}>Check Location</MenuItem>
            <MenuItem onClick={() => openMapModal(row.original)}>Set Area</MenuItem>
          </MenuList>
        </Menu>
      ),
    },
  ], []);

  // Delete worker
  const handleDelete = async () => {
    const worker = deleteModal.worker;
    if (!worker) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/deleteUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: worker.id })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user from Auth');
      }
      await import("firebase/firestore").then(({ deleteDoc, doc }) => deleteDoc(doc(firestore, "workers", worker.id)));
      toast({ title: "Worker deleted", status: "success", position: "top-right" });
      fetchWorkers();
    } catch (err) {
      toast({ title: "Error deleting worker", description: err.message, status: "error", position: "top-right" });
    }
    setDeleteModal({ open: false, worker: null });
    setLoading(false);
  };

  // Filtering logic
  const filteredData = useMemo(() => {
    let data = workers;
    if (statusFilter) data = data.filter(row => row.status === statusFilter);
    if (globalFilter) {
      const lower = globalFilter.toLowerCase();
      data = data.filter(row =>
        row.userName?.toLowerCase().includes(lower) ||
        row.email?.toLowerCase().includes(lower) ||
        row.phoneNumber?.toLowerCase().includes(lower)
      );
    }
    return data;
  }, [workers, statusFilter, globalFilter]);

  const { getTableProps, getTableBodyProps, headerGroups, prepareRow, page, setGlobalFilter: setTableGlobalFilter, state, canPreviousPage, canNextPage, pageOptions, pageCount, gotoPage, nextPage, previousPage, setPageSize } = useTable(
    { columns, data: filteredData, initialState: { pageSize: 10 }, autoResetPage: false },
    useGlobalFilter, useFilters, useSortBy, usePagination
  );

  useEffect(() => {
    setTableGlobalFilter(globalFilter);
  }, [globalFilter, setTableGlobalFilter]);

  const [serviceInput, setServiceInput] = useState("");
  const addServiceTag = (serviceId) => {
    if (!form.assignedServices.includes(serviceId)) {
      setForm(f => ({ ...f, assignedServices: [...f.assignedServices, serviceId] }));
    }
  };
  const removeServiceTag = (serviceId) => {
    setForm(f => ({ ...f, assignedServices: f.assignedServices.filter(id => id !== serviceId) }));
  };

  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }}>
      <Card pb="0px">
        <CardHeader p="6px 0px 22px 0px">
          <Flex justify="space-between" align="center">
            <Heading size="md">Worker Management</Heading>
            <Button colorScheme="orange" onClick={() => openEdit(null)}>Add Worker</Button>
          </Flex>
        </CardHeader>
        <CardBody>
          <Flex mb={4} gap={4} flexWrap="wrap" align="center" justify="space-between">
            <InputGroup maxW="250px" boxShadow="sm">
              <InputLeftElement pointerEvents="none"><SearchIcon color="gray.400" /></InputLeftElement>
              <Input placeholder="Search by name, email or phone" value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} size="sm" bg="white" borderRadius="md" boxShadow="sm" />
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
            <Box overflowX="auto">
              <Table {...getTableProps()} variant="simple">
                <Thead>
                  {headerGroups.map(headerGroup => (
                    <Tr {...headerGroup.getHeaderGroupProps()}>
                      {headerGroup.headers.map(column => (
                        <Th {...column.getHeaderProps(column.getSortByToggleProps())}>
                          {column.render("Header")}{column.isSorted ? (column.isSortedDesc ? " 🔽" : " 🔼") : ""}
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
            </Box>
          )}
        </CardBody>
      </Card>

      {/* Location Modal */}
      {locationModalOpen && (
        <Modal isOpen={locationModalOpen} onClose={closeLocationModal} size="xl" isCentered>
          <ModalOverlay />
          <ModalContent maxW="800px" h="600px">
            <ModalHeader>Worker Location</ModalHeader>
            <ModalCloseButton />
            <ModalBody p={0} h="100%">
              {locationUrl ? (
                <iframe title="Worker Location" src={locationUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              ) : (
                <Flex justify="center" align="center" h="100%"><Box>No location data available for this worker.</Box></Flex>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>
      )}

      {/* Map Modal for setting service area */}
      {mapModalOpen && (
        <Modal isOpen={mapModalOpen} onClose={closeMapModal} size="xl" isCentered>
          <ModalOverlay />
          <ModalContent maxW="800px" h="600px">
            <ModalHeader>Set Worker Service Area</ModalHeader>
            <ModalCloseButton />
            <ModalBody p={0} h="100%">
              <VStack h="100%" spacing={0}>
                <Box flexGrow={1} w="100%">
                  <MapContainer center={[24.3506, 53.9396]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <FeatureGroup>
                      <EditControl
                        position="topright"
                        onCreated={onCreated}
                        onEdited={onEdited}
                        onDeleted={onDeleted}
                        draw={{
                          rectangle: false,
                          polyline: false,
                          marker: false,
                          circlemarker: false,
                        }}
                      />
                      {serviceArea && serviceArea.geometry.type === 'Polygon' && (
                        <Polygon positions={serviceArea.geometry.coordinates[0].map(p => [p[1], p[0]])} />
                      )}
                      {serviceArea && serviceArea.geometry.type === 'Point' && (
                        <Circle center={[serviceArea.geometry.coordinates[1], serviceArea.geometry.coordinates[0]]} radius={serviceArea.properties.radius} />
                      )}
                    </FeatureGroup>
                  </MapContainer>
                </Box>
                <Flex p={4} justify="flex-end" w="100%">
                  <Button onClick={handleSaveArea} colorScheme="orange" isLoading={loading}>Save Area</Button>
                </Flex>
              </VStack>
            </ModalBody>
          </ModalContent>
        </Modal>
      )}

      {/* Delete confirmation modal */}
      {deleteModal.open && (
        <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, worker: null })} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Delete Worker</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              Are you sure you want to delete worker <b>{deleteModal.worker?.userName || deleteModal.worker?.email}</b>? This cannot be undone.
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="red" mr={3} onClick={handleDelete} isLoading={loading}>Delete</Button>
              <Button variant="ghost" onClick={() => setDeleteModal({ open: false, worker: null })}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      {/* Add/Edit Worker modal */}
      {isOpen && (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
          <ModalOverlay />
          <ModalContent maxH="90vh" overflowY="auto" maxW="900px">
            <ModalHeader>{selectedWorker ? "Edit Worker" : "Add Worker"}</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isRequired><FormLabel>User Name</FormLabel><Input value={form.userName} onChange={e => setForm(f => ({ ...f, userName: e.target.value }))} /></FormControl>
                <FormControl isRequired><FormLabel>Email</FormLabel><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} isDisabled={!!selectedWorker} /></FormControl>
                {!selectedWorker && <FormControl isRequired><FormLabel>Password</FormLabel><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></FormControl>}
                <FormControl isRequired><FormLabel>Phone Number</FormLabel><Input value={form.phoneNumber} onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} /></FormControl>
                <FormControl><FormLabel>Assign Services</FormLabel><Box position="relative"><Input placeholder="Type to search services..." value={serviceInput} onChange={e => setServiceInput(e.target.value)} mb={2} /><Flex wrap="wrap" gap={2}>{form.assignedServices.map(serviceId => { const service = services.find(s => s.id === serviceId); return (<Tag key={serviceId} colorScheme="orange" borderRadius="full"><TagLabel>{service ? service.name : serviceId}</TagLabel><TagCloseButton onClick={() => removeServiceTag(serviceId)} /></Tag>);})}</Flex>{serviceInput && <Box borderWidth={1} borderRadius="md" bg="white" mt={1} maxH="150px" overflowY="auto" zIndex={20} position="absolute" w="100%" boxShadow="lg">{services.filter(s => s.name.toLowerCase().includes(serviceInput.toLowerCase()) && !form.assignedServices.includes(s.id)).map(s => (<Box key={s.id} px={3} py={2} _hover={{ bg: "orange.50", cursor: "pointer" }} onClick={() => {addServiceTag(s.id); setServiceInput("");}}>{s.name}</Box>))}</Box>}</Box></FormControl>
                <FormControl display="flex" alignItems="center"><FormLabel htmlFor="autoAccept" mb="0">Auto Accept</FormLabel><Switch id="autoAccept" isChecked={form.autoAccept} onChange={e => setForm(f => ({ ...f, autoAccept: e.target.checked }))} /></FormControl>
                <FormControl><FormLabel>Status</FormLabel><Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}><option value="active">Active</option><option value="suspended">Suspended</option></Select></FormControl>
              </SimpleGrid>
              <Heading size="md" mt={6} mb={4}>Working Hours</Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {Object.entries(form.dailyWorkingHours).map(([day, hours]) => {
                  const companyDay = companySettings?.dailyWorkingHours?.[day];

                  const timeToMinutes = (timeStr) => {
                    if (!timeStr) return 0;
                    const [h, m] = timeStr.split(':').map(Number);
                    return h * 60 + m;
                  };

                  return (
                    <FormControl key={day} display="flex" alignItems="center">
                      <FormLabel htmlFor={day} mb="0" minW="90px" textTransform="capitalize">
                        {day}
                      </FormLabel>
                      <Input
                        type="time"
                        id={day}
                        value={hours.start}
                        onChange={(e) => {
                          let newStart = e.target.value;
                          const companyStartTime = companyDay?.start;
                          const workerEndTime = hours.end;

                          if (companyStartTime && timeToMinutes(newStart) < timeToMinutes(companyStartTime)) {
                            newStart = companyStartTime;
                            toast({ title: `Start time cannot be earlier than company's opening time (${newStart})`, status: "warning", duration: 3000, isClosable: true });
                          } else if (workerEndTime && timeToMinutes(newStart) > timeToMinutes(workerEndTime)) {
                            newStart = workerEndTime;
                            toast({ title: `Start time cannot be after the end time`, status: "warning", duration: 3000, isClosable: true });
                          }

                          const newHours = { ...form.dailyWorkingHours, [day]: { ...hours, start: newStart } };
                          setForm({ ...form, dailyWorkingHours: newHours });
                        }}
                        isDisabled={!hours.enabled || !companyDay?.enabled}
                        mr={2}
                      />
                      <Text mr={2}>-</Text>
                      <Input
                        type="time"
                        value={hours.end}
                        onChange={(e) => {
                          let newEnd = e.target.value;
                          const companyEndTime = companyDay?.end;
                          const workerStartTime = hours.start;

                          if (companyEndTime && timeToMinutes(newEnd) > timeToMinutes(companyEndTime)) {
                            newEnd = companyEndTime;
                            toast({ title: `End time cannot be later than company's closing time (${newEnd})`, status: "warning", duration: 3000, isClosable: true });
                          } else if (workerStartTime && timeToMinutes(newEnd) < timeToMinutes(workerStartTime)) {
                            newEnd = workerStartTime;
                            toast({ title: `End time cannot be before the start time`, status: "warning", duration: 3000, isClosable: true });
                          }

                          const newHours = { ...form.dailyWorkingHours, [day]: { ...hours, end: newEnd } };
                          setForm({ ...form, dailyWorkingHours: newHours });
                        }}
                        isDisabled={!hours.enabled || !companyDay?.enabled}
                        mr={2}
                      />
                      <Checkbox
                        isChecked={hours.enabled}
                        onChange={(e) => {
                          const newHours = { ...form.dailyWorkingHours, [day]: { ...hours, enabled: e.target.checked } };
                          setForm({ ...form, dailyWorkingHours: newHours });
                        }}
                        isDisabled={!companyDay?.enabled}
                      />
                    </FormControl>
                  );
                })}
              </SimpleGrid>
              <Heading size="md" mt={6} mb={4}>Days Off</Heading>
              <FormControl>
                <FormLabel>Add Specific Off Date</FormLabel>
                <Flex>
                  <Input
                    type="date"
                    value={newOffDate}
                    onChange={(e) => setNewOffDate(e.target.value)}
                    mr={2}
                  />
                  <Button onClick={handleAddOffDate} colorScheme="orange">Add</Button>
                </Flex>
              </FormControl>
              <Box mt={4}>
                <FormLabel>Current Off Dates</FormLabel>
                <Flex wrap="wrap" gap={2}>
                  {form.offDates.map((date) => (
                    <Tag size="md" key={date} borderRadius="full" variant="solid" colorScheme="red">
                      <TagLabel>{date}</TagLabel>
                      <TagCloseButton onClick={() => handleRemoveOffDate(date)} />
                    </Tag>
                  ))}
                </Flex>
              </Box>
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