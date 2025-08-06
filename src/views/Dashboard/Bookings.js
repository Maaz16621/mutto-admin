import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Text, Box, Button, Flex, Heading, Input, Table, Thead, Tbody, Tr, Th, Td, InputGroup, InputLeftElement, IconButton, useToast, Spinner, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, useDisclosure, FormControl, FormLabel, Select, Tooltip, Icon, Tag, Menu, MenuButton, MenuList, MenuItem, CheckboxGroup, Checkbox, Stack, List, ListItem } from "@chakra-ui/react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useTable, useGlobalFilter, useSortBy, usePagination, useFilters } from "react-table";
import { SearchIcon } from "@chakra-ui/icons";
import { collection, getDocs, getDoc, updateDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../../firebase";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody.js";

const GOOGLE_MAPS_API_KEY = "AIzaSyCj-gMHtSUc7TG4nHLfzTcckVYR0kWiJAk";

const calculateDistance = (coords1, coords2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(coords2.lat - coords1.lat);
  const dLon = toRad(coords2.lng - coords1.lng);
  const lat1 = toRad(coords1.lat);
  const lat2 = toRad(coords2.lat);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
};

const generateTimeSlots = (date, companySettings, workerDetails, serviceDetails) => {
  const slots = [];
  const dayOfWeek = new Date(date).toLocaleString('en-us', { weekday: 'long' }).toLowerCase();

  // Check company off-dates
  if (companySettings?.offDates?.includes(date)) {
    return [];
  }

  // Check worker off-dates
  if (workerDetails?.offDates?.includes(date)) {
    return [];
  }

  const companyWorkingHours = companySettings?.dailyWorkingHours?.[dayOfWeek];
  const workerWorkingHours = workerDetails?.dailyWorkingHours?.[dayOfWeek];

  if (!companyWorkingHours?.enabled || !workerWorkingHours?.enabled) {
    return [];
  }

  const startHour = Math.max(parseInt(companyWorkingHours.start.split(':')[0]), parseInt(workerWorkingHours.start.split(':')[0]));
  const startMinute = Math.max(parseInt(companyWorkingHours.start.split(':')[1]), parseInt(workerWorkingHours.start.split(':')[1]));
  const endHour = Math.min(parseInt(companyWorkingHours.end.split(':')[0]), parseInt(workerWorkingHours.end.split(':')[0]));
  const endMinute = Math.min(parseInt(companyWorkingHours.end.split(':')[1]), parseInt(workerWorkingHours.end.split(':')[1]));

  const serviceDuration = serviceDetails?.duration || 60; // Default to 60 minutes if not found
  const bufferTime = serviceDetails?.bufferTime || 0; // Default to 0 minutes if not found
  const totalDuration = serviceDuration + bufferTime;

  let currentHour = startHour;
  let currentMinute = startMinute;

  while (currentHour * 60 + currentMinute < endHour * 60 + endMinute) {
    const slotStart = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    
    currentMinute += totalDuration;
    if (currentMinute >= 60) {
      currentHour += Math.floor(currentMinute / 60);
      currentMinute %= 60;
    }

    const slotEnd = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    if (currentHour * 60 + currentMinute <= endHour * 60 + endMinute) {
      slots.push(`${slotStart} to ${slotEnd}`);
    }
  }
  return slots;
};

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewBooking, setViewBooking] = useState(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const toast = useToast();

  const [appSettings, setAppSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [services, setServices] = useState([]);
  const [addons, setAddons] = useState([]);

  const [newBooking, setNewBooking] = useState({
    user: null,
    phone: '',
    email: '',
    address: '',
    addressCoordinates: null,
    service: null,
    selectedWorker: null,
    vehicle: '',
    addons: [],
    paymentMethod: 'cash',
    selectedDate: '',
    selectedTime: '',
  });

  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
  const addressInputRef = useRef(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(firestore, "bookings"));
      const bookingsList = await Promise.all(querySnapshot.docs.map(async (bookingDoc) => {
        const booking = { id: bookingDoc.id, ...bookingDoc.data() };
        if (!booking.userId || !booking.serviceId || !booking.workerId) {
            return {
                ...booking,
                customerName: 'N/A',
                serviceName: 'N/A',
                workerName: 'N/A',
                userDetails: {},
                serviceDetails: {},
                workerDetails: {},
            }
        }
        const userDocRef = doc(firestore, "users", booking.userId);
        const serviceDocRef = doc(firestore, "services", booking.serviceId);
        const workerDocRef = doc(firestore, "workers", booking.workerId);

        const [userDoc, serviceDoc, workerDoc] = await Promise.all([
            getDoc(userDocRef),
            getDoc(serviceDocRef),
            getDoc(workerDocRef)
        ]);

        return {
          ...booking,
          customerName: userDoc.data()?.username || 'N/A',
          serviceName: serviceDoc.data()?.name || 'N/A',
          workerName: workerDoc.data()?.userName || 'N/A',
          userDetails: userDoc.data(),
          serviceDetails: serviceDoc.data(),
          workerDetails: workerDoc.data(),
        };
      }));
      setBookings(bookingsList);
    } catch (err) {
      console.error("Error fetching bookings: ", err);
      toast({ title: "Error fetching bookings", status: "error", description: err.message });
    }
    setLoading(false);
  };

  const fetchInitialData = async () => {
    const fetchAppSettings = async () => {
      try {
        const appSettingsDoc = await getDoc(doc(firestore, "settings", "appSettings"));
        if (appSettingsDoc.exists()) {
          setAppSettings(appSettingsDoc.data());
        }
      } catch (error) {
        console.error("Error fetching app settings:", error);
      }
    };

    const fetchUsers = async () => {
      const querySnapshot = await getDocs(collection(firestore, "users"));
      setUsers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    const fetchWorkers = async () => {
      const querySnapshot = await getDocs(collection(firestore, "workers"));
      setWorkers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    const fetchServices = async () => {
      const querySnapshot = await getDocs(collection(firestore, "services"));
      setServices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    const fetchAddons = async () => {
      const querySnapshot = await getDocs(collection(firestore, "products"));
      setAddons(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    await Promise.all([fetchAppSettings(), fetchUsers(), fetchWorkers(), fetchServices(), fetchAddons()]);
  };

  useEffect(() => {
    fetchBookings();
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (isCreateOpen && window.google && window.google.maps && window.google.maps.places && addressInputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, { types: ['address'] });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry && place.geometry.location) {
          setNewBooking(prev => ({
            ...prev,
            address: place.formatted_address,
            addressCoordinates: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
          }));
        }
      });
    }
  }, [isCreateOpen]);

  const viewDisclosure = useDisclosure();
  const isViewOpen = viewDisclosure.isOpen;
  const onViewOpen = viewDisclosure.onOpen;
  const onViewClose = viewDisclosure.onClose;

  const handleCancel = async (bookingId) => {
    setLoading(true);
    try {
      await updateDoc(doc(firestore, "bookings", bookingId), { status: "cancelled" });
      toast({ title: "Booking cancelled", status: "success" });
      fetchBookings();
      onViewClose();
    } catch (err) {
      toast({ title: "Error cancelling booking", status: "error", description: err.message });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await addDoc(collection(firestore, "bookings"), {
        userId: newBooking.user?.id || null,
        customerName: newBooking.user?.username || userSearchTerm, // Use userSearchTerm for new users
        phone: newBooking.phone,
        email: newBooking.email,
        address: newBooking.address,
        addressCoordinates: newBooking.addressCoordinates,
        serviceId: newBooking.service?.id || null,
        serviceName: newBooking.service?.name || null,
        workerId: newBooking.selectedWorker?.id || null,
        workerName: newBooking.selectedWorker?.userName || null,
        vehicle: newBooking.vehicle,
        addons: newBooking.addons,
        paymentMethod: newBooking.paymentMethod,
        selectedDate: newBooking.selectedDate,
        selectedTime: newBooking.selectedTime,
        createdAt: serverTimestamp(),
        status: 'pending',
      });
      toast({ title: "Booking created", status: "success" });
      fetchBookings();
      onCreateClose();
    } catch (err) {
      toast({ title: "Error creating booking", status: "error", description: err.message });
    }
    setLoading(false);
  };

  const openView = useCallback((booking) => {
    setViewBooking(booking);
    onViewOpen();
  }, [onViewOpen]);

  const columns = useMemo(() => [
    { Header: "Customer", accessor: "customerName" },
    { Header: "Service", accessor: "serviceName" },
    { Header: "Booking Date", accessor: d => `${d.selectedDate} ${d.selectedTime}`, id: 'bookingDate' },
    { Header: "Assigned Staff", accessor: "workerName" },
    { Header: "Status", accessor: "status", Cell: ({value}) => <Tag colorScheme={value === 'completed' ? 'green' : value === 'pending' ? 'orange' : value === 'confirmed' ? 'blue' : 'red'}>{value}</Tag> },
    {
      Header: "Actions",
      id: "actions",
      Cell: ({ row }) => (
        <Menu>
          <MenuButton as={IconButton} aria-label="Options" icon={<BsThreeDotsVertical />} variant="ghost" />
          <MenuList>
            <MenuItem onClick={() => openView(row.original)}>View</MenuItem>
          </MenuList>
        </Menu>
      ),
    },
  ], [openView]);

  const filteredData = useMemo(() => {
    let data = bookings;
    if (statusFilter) data = data.filter(row => row.status === statusFilter);
    if (globalFilter) {
      const lower = globalFilter.toLowerCase();
      data = data.filter(row =>
        row.customerName?.toLowerCase().includes(lower) ||
        row.service?.toLowerCase().includes(lower) ||
        row.staff?.toLowerCase().includes(lower)
      );
    }
    return data;
  }, [bookings, statusFilter, globalFilter]);

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

  const eligibleWorkersForServiceAndLocation = useMemo(() => {
    if (!newBooking.service || !newBooking.addressCoordinates) return [];

    const serviceId = newBooking.service.id;

    return workers.filter(worker => {
      // Check if worker provides the service
      if (!worker.assignedServices || !worker.assignedServices.includes(serviceId)) {
        return false;
      }

      // Check if worker covers the service area
      if (!worker.serviceArea || !worker.serviceArea.geometry || !worker.serviceArea.geometry.coordinates) {
        return false;
      }
      const workerCoords = { lat: worker.serviceArea.geometry.coordinates[1], lng: worker.serviceArea.geometry.coordinates[0] };
      const distance = calculateDistance(workerCoords, newBooking.addressCoordinates);
      return distance <= worker.serviceArea.properties.radius;
    });
  }, [newBooking.service, newBooking.addressCoordinates, workers]);

  useEffect(() => {
    if (eligibleWorkersForServiceAndLocation.length > 0) {
      setNewBooking(prev => ({ ...prev, selectedWorker: eligibleWorkersForServiceAndLocation[0] }));
    } else {
      setNewBooking(prev => ({ ...prev, selectedWorker: null }));
    }
  }, [eligibleWorkersForServiceAndLocation]);

  const availableServices = useMemo(() => {
    if (!newBooking.addressCoordinates) return [];

    const serviceIdsFromWorkers = workers.filter(worker => {
      if (!worker.serviceArea || !worker.serviceArea.geometry || !worker.serviceArea.geometry.coordinates) return false;
      const workerCoords = { lat: worker.serviceArea.geometry.coordinates[1], lng: worker.serviceArea.geometry.coordinates[0] };
      const distance = calculateDistance(workerCoords, newBooking.addressCoordinates);
      return distance <= worker.serviceArea.properties.radius;
    }).flatMap(worker => worker.assignedServices);

    return services.filter(service => serviceIdsFromWorkers.includes(service.id));
  }, [newBooking.addressCoordinates, workers, services]);

  const availableAddons = useMemo(() => {
    if (!newBooking.service) return [];
    const service = services.find(s => s.id === newBooking.service.id);
    if (!service || !service.relatedServices) return [];
    return addons.filter(addon => service.relatedServices.includes(addon.id));
  }, [newBooking.service, services, addons]);

  const userAddresses = useMemo(() => {
    if (newBooking.user && newBooking.user.addresses) {
      return Object.keys(newBooking.user.addresses).map(key => ({ id: key, ...newBooking.user.addresses[key] }));
    }
    return [];
  }, [newBooking.user]);

  const userVehicles = useMemo(() => {
    if (newBooking.user && newBooking.user.vehicles) {
      return Object.values(newBooking.user.vehicles);
    }
    return [];
  }, [newBooking.user]);

  const availableTimeSlots = useMemo(() => {
    if (!newBooking.selectedDate || !newBooking.selectedWorker || !newBooking.service || !appSettings) return [];
    return generateTimeSlots(
      newBooking.selectedDate,
      appSettings,
      newBooking.selectedWorker,
      newBooking.service
    );
  }, [newBooking.selectedDate, newBooking.selectedWorker, newBooking.service, appSettings]);

  const filteredUsers = useMemo(() => {
    if (!userSearchTerm) return [];
    return users.filter(user =>
      user.username.toLowerCase().includes(userSearchTerm.toLowerCase())
    );
  }, [userSearchTerm, users]);

  const handleUserSelect = (user) => {
    setNewBooking(prev => {
      const defaultAddressObj = user.defaultAddress ? Object.values(user.addresses || {}).find(addr => addr.id === user.defaultAddress) : null;
      const defaultVehicleObj = user.defaultVehicle ? Object.values(user.vehicles || {}).find(veh => veh.id === user.defaultVehicle) : null;

      return {
        ...prev,
        user,
        phone: user?.phone || '',
        email: user?.email || '',
        address: defaultAddressObj?.address || '',
        addressCoordinates: defaultAddressObj ? { lat: defaultAddressObj.latitude, lng: defaultAddressObj.longitude } : null,
        vehicle: defaultVehicleObj?.name || '',
      };
    });
    setUserSearchTerm(user.username);
    setShowUserSuggestions(false);
  };

  const handleAddressSelect = (addressObj) => {
    setNewBooking(prev => ({
      ...prev,
      address: addressObj.address,
      addressCoordinates: { lat: addressObj.latitude, lng: addressObj.longitude },
    }));
  };

  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }}>
      <Card overflowX={{ sm: "scroll", xl: "hidden" }} pb="0px">
        <CardHeader p="6px 0px 22px 0px">
          <Flex justify="space-between" align="center">
            <Heading size="md">Bookings</Heading>
            <Button colorScheme="blue" onClick={onCreateOpen}>Create Booking</Button>
          </Flex>
        </CardHeader>
        <CardBody>
          <Flex mb={4} gap={4} flexWrap="wrap" align="center" justify="space-between">
            <InputGroup maxW="250px" boxShadow="sm">
              <InputLeftElement pointerEvents="none"><SearchIcon color="gray.400" /></InputLeftElement>
              <Input placeholder="Search by customer, service, or staff" value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} size="sm" bg="white" borderRadius="md" />
            </InputGroup>
            <FormControl minW="150px" maxW="200px">
              <FormLabel fontSize="xs" mb={1} color="gray.600">Status</FormLabel>
              <Select placeholder="All Statuses" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} size="sm" bg="white" borderRadius="md" boxShadow="sm">
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
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

      {isViewOpen && viewBooking && (
        <Modal isOpen={isViewOpen} onClose={onViewClose} isCentered scrollBehavior="inside">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Booking Details</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Box>
                <Heading size="md">User Details</Heading>
                <Text>Name: {viewBooking.userDetails?.username}</Text>
                <Text>Email: {viewBooking.userDetails?.email}</Text>

                <Heading size="md" mt={4}>Vehicle Details</Heading>
                <Text>Company: {viewBooking.selectedVehicle?.company}</Text>
                <Text>Model: {viewBooking.selectedVehicle?.model}</Text>
                <Text>Year: {viewBooking.selectedVehicle?.modelYear}</Text>
                <Text>Color: {viewBooking.selectedVehicle?.color}</Text>
                <Text>Plate: {viewBooking.selectedVehicle?.plateNumberPart1}-{viewBooking.selectedVehicle?.plateNumberPart2}</Text>

                <Heading size="md" mt={4}>Address Details</Heading>
                <Text>Name: {viewBooking.selectedAddress?.name}</Text>
                <Text>Address: {viewBooking.selectedAddress?.address}</Text>

                <Heading size="md" mt={4}>Service Details</Heading>
                <Text>Name: {viewBooking.serviceDetails?.name}</Text>
                <Text>Price: {viewBooking.serviceDetails?.cost}</Text>

                <Heading size="md" mt={4}>Worker Details</Heading>
                <Text>Name: {viewBooking.workerDetails?.userName}</Text>
                <Text>Email: {viewBooking.workerDetails?.email}</Text>

                <Heading size="md" mt={4}>Booking Information</Heading>
                <Text>Status: {viewBooking.status}</Text>
                <Text>Date & Time: {viewBooking.selectedDate} {viewBooking.selectedTime}</Text>

                {viewBooking.addons && viewBooking.addons.length > 0 && (
                  <>
                    <Heading size="md" mt={4}>Addons</Heading>
                    {viewBooking.addons.map((addon, index) => (
                      <Text key={index}>{addon.name} - ${addon.price}</Text>
                    ))}
                  </>
                )}
              </Box>
            </ModalBody>
            <ModalFooter>
              {viewBooking.status !== 'cancelled' && (
                <Button colorScheme="red" mr={3} onClick={() => handleCancel(viewBooking.id)} isLoading={loading}>
                  Cancel Booking
                </Button>
              )}
              <Button variant="ghost" onClick={onViewClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      {isCreateOpen && (
        <Modal isOpen={isCreateOpen} onClose={onCreateClose} isCentered scrollBehavior="inside">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Create Booking</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <FormControl>
                <FormLabel>User</FormLabel>
                <Input
                  placeholder="Search or enter user name"
                  value={userSearchTerm}
                  onChange={(e) => {
                    setUserSearchTerm(e.target.value);
                    setNewBooking(prev => ({ ...prev, user: null, phone: '', email: '', address: '', addressCoordinates: null, vehicle: '' })); // Clear selected user and related fields if typing
                    setShowUserSuggestions(true);
                  }}
                  onFocus={() => setShowUserSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowUserSuggestions(false), 100)}
                />
                {showUserSuggestions && filteredUsers.length > 0 && (
                  <Box border="1px" borderColor="gray.200" borderRadius="md" mt={1} position="absolute" zIndex="10" bg="white" width="calc(100% - 2rem)">
                    <List spacing={1}>
                      {filteredUsers.map(user => (
                        <ListItem
                          key={user.id}
                          p={2}
                          _hover={{ bg: "gray.100", cursor: "pointer" }}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleUserSelect(user)}
                        >
                          {user.username}
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </FormControl>
              <FormControl mt={4}>
                <FormLabel>Phone</FormLabel>
                <Input value={newBooking.phone} onChange={(e) => setNewBooking({ ...newBooking, phone: e.target.value })} isDisabled={!!newBooking.user} />
              </FormControl>
              <FormControl mt={4}>
                <FormLabel>Email</FormLabel>
                <Input value={newBooking.email} onChange={(e) => setNewBooking({ ...newBooking, email: e.target.value })} isDisabled={!!newBooking.user} />
              </FormControl>
              <FormControl mt={4}>
                <FormLabel>Address</FormLabel>
                <Input ref={addressInputRef} placeholder="Enter address" value={newBooking.address} onChange={(e) => setNewBooking({ ...newBooking, address: e.target.value, addressCoordinates: null })} />
                {newBooking.user && userAddresses.length > 0 && (
                  <Select placeholder="Select saved address" mt={2} value={newBooking.address} onChange={(e) => {
                    const selectedAddress = userAddresses.find(addr => addr.address === e.target.value);
                    handleAddressSelect(selectedAddress);
                  }}>
                    {userAddresses.map(addr => <option key={addr.id} value={addr.address}>{addr.name}: {addr.address}</option>)}
                  </Select>
                )}
                {newBooking.addressCoordinates && (
                  <Box mt={2}>
                    <img
                      src={`https://maps.googleapis.com/maps/api/staticmap?center=${newBooking.addressCoordinates.lat},${newBooking.addressCoordinates.lng}&zoom=14&size=300x200&markers=color:red%7C${newBooking.addressCoordinates.lat},${newBooking.addressCoordinates.lng}&key=${GOOGLE_MAPS_API_KEY}`}
                      alt="Map of selected address"
                      style={{ maxWidth: "100%", height: "auto" }}
                    />
                  </Box>
                )}
              </FormControl>
              <FormControl mt={4}>
                <FormLabel>Service</FormLabel>
                <Select placeholder="Select service" onChange={(e) => setNewBooking({ ...newBooking, service: services.find(s => s.id === e.target.value) })}>
                  {availableServices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
                </Select>
              </FormControl>
              <FormControl mt={4}>
                <FormLabel>Date</FormLabel>
                <Input
                  type="date"
                  value={newBooking.selectedDate}
                  onChange={(e) => setNewBooking({ ...newBooking, selectedDate: e.target.value })}
                />
              </FormControl>
              <FormControl mt={4}>
                <FormLabel>Time</FormLabel>
                <Select
                  placeholder="Select time slot"
                  value={newBooking.selectedTime}
                  onChange={(e) => setNewBooking({ ...newBooking, selectedTime: e.target.value })}
                >
                  {availableTimeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl mt={4}>
                <FormLabel>Vehicle</FormLabel>
                {newBooking.user && userVehicles.length > 0 ? (
                  <Select placeholder="Select vehicle" value={newBooking.vehicle} onChange={(e) => setNewBooking({ ...newBooking, vehicle: e.target.value })}>
                    {userVehicles.map(vehicle => <option key={vehicle.id} value={vehicle.name}>{vehicle.name}</option>)}
                  </Select>
                ) : (
                  <Input placeholder="Enter vehicle details" value={newBooking.vehicle} onChange={(e) => setNewBooking({ ...newBooking, vehicle: e.target.value })} />
                )}
              </FormControl>
              <FormControl mt={4}>
                <FormLabel>Addons</FormLabel>
                <CheckboxGroup onChange={(values) => setNewBooking({ ...newBooking, addons: values })}>
                  <Stack direction="column">
                    {availableAddons.map(addon => <Checkbox key={addon.id} value={addon.id}>{addon.name}</Checkbox>)}
                  </Stack>
                </CheckboxGroup>
              </FormControl>
              <FormControl mt={4}>
                <FormLabel>Payment Method</FormLabel>
                <Input value={newBooking.paymentMethod} isReadOnly />
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="blue" mr={3} onClick={handleSave} isLoading={loading}>
                Save
              </Button>
              <Button variant="ghost" onClick={onCreateClose}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </Flex>
  );
}
