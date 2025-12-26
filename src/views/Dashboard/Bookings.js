import React, { useEffect, useState, useMemo, useCallback, useRef, forwardRef } from "react";
import { Text, Box, Button, Flex, Heading, Input, Table, Thead, Tbody, Tr, Th, Td, InputGroup, InputLeftElement, IconButton, useToast, Spinner, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, useDisclosure, FormControl, FormLabel, Select, Tooltip, Icon, Tag, Menu, MenuButton, MenuList, MenuItem, CheckboxGroup, Checkbox, Stack, List, ListItem } from "@chakra-ui/react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { BsThreeDotsVertical } from "react-icons/bs";
import { VscChevronDown, VscChevronRight } from "react-icons/vsc";
import { useTable, useGlobalFilter, useSortBy, usePagination, useFilters, useGroupBy, useExpanded } from "react-table";
import { SearchIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { collection, getDocs, getDoc, updateDoc, doc, addDoc, serverTimestamp, query, where, orderBy } from "firebase/firestore";
import { firestore } from "../../firebase";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody.js";
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';                                                          
import GooglePlacesAutocomplete, { geocodeByAddress, getLatLng } from 'react-google-places-autocomplete';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import InvoiceTemplate from 'components/Invoice/InvoiceTemplate';
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const calculateDistance = (coords1, coords2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters

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

const CustomDatePickerInput = forwardRef(({
  value,
  onClick,
  onChange,
  placeholder
}, ref) => (
  <Input
    onClick={onClick}
    value={value}
    onChange={onChange}
    ref={ref}
    placeholder={placeholder}
    size="sm"
    bg="white"
    borderRadius="md"
    boxShadow="sm"
  />
));

const formatTimeToAMPM = (hour, minute) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${formattedHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`;
};

const containerStyle = {
  width: '100%',
  height: '300px'
};

const center = {
  lat: 25.2048,
  lng: 55.2708
};

const generateTimeSlots = (
  date,
  companySettings,
  workerDetails,
  serviceDetails,
  existingBookings = [],
  selectedAddonIds = [],
  allAddons = []
) => {
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

  // Calculate total duration: service + buffer + selected addons
  let serviceDuration = serviceDetails?.duration || 60;
  const bufferTime = serviceDetails?.bufferTime || 0;
  // Add selected addons duration
  if (selectedAddonIds && selectedAddonIds.length > 0) {
    selectedAddonIds.forEach(addonId => {
      const addonObj = allAddons.find(a => a.id === addonId);
      if (addonObj && addonObj.time) {
        serviceDuration += Number(addonObj.time);
      }
    });
  }
  const totalDuration = serviceDuration + bufferTime;

  let currentHour = startHour;
  let currentMinute = startMinute;

  const parseTimeStrToMinutes = (timeStr) => {
    const [time, period] = timeStr.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0; // Midnight
    return h * 60 + m;
  };

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentHourUAE = parseInt(now.toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: 'Asia/Dubai' }));
  const currentMinuteUAE = parseInt(now.toLocaleString('en-US', { minute: '2-digit', timeZone: 'Asia/Dubai' }));

  while (currentHour * 60 + currentMinute < endHour * 60 + endMinute) {
    let slotStartHour = currentHour;
    let slotStartMinute = currentMinute;

    // Add driving time if previous booking exists for worker
    const previousBooking = existingBookings
      .filter(b => b.selectedTime)
      .sort((a, b) => {
        // Sort by end time
        const aEnd = parseTimeStrToMinutes(a.selectedTime.split(' to ')[1]);
        const bEnd = parseTimeStrToMinutes(b.selectedTime.split(' to ')[1]);
        return aEnd - bEnd;
      })
      .reverse()
      .find(b => {
        const bookingEnd = parseTimeStrToMinutes(b.selectedTime.split(' to ')[1]);
        const slotStart = slotStartHour * 60 + slotStartMinute;
        return bookingEnd <= slotStart;
      });

    let drivingTime = 0;
    if (previousBooking) {
      drivingTime = 15; // 15 minutes driving time
      slotStartMinute += drivingTime;
      if (slotStartMinute >= 60) {
        slotStartHour += Math.floor(slotStartMinute / 60);
        slotStartMinute %= 60;
      }
    }

    // Check if the selected date is today and if the slot start time has already passed
    if (date === today) {
      const slotStartInMinutes = slotStartHour * 60 + slotStartMinute;
      const currentInMinutesUAE = currentHourUAE * 60 + currentMinuteUAE;
      if (slotStartInMinutes <= currentInMinutesUAE) {
        currentMinute += totalDuration;
        if (currentMinute >= 60) {
          currentHour += Math.floor(currentMinute / 60);
          currentMinute %= 60;
        }
        continue;
      }
    }

    currentMinute += totalDuration;
    let slotEndHour = currentHour;
    let slotEndMinute = currentMinute;

    if (slotEndMinute >= 60) {
      slotEndHour += Math.floor(slotEndMinute / 60);
      slotEndMinute %= 60;
    }

    // Check if the potential slot overlaps with any existing booking
    const isOverlapping = existingBookings.some(booking => {
      const [bookingStartTimeStr, bookingEndTimeStr] = booking.selectedTime.split(' to ');
      const existingBookingStartInMinutes = parseTimeStrToMinutes(bookingStartTimeStr);
      const existingBookingEndInMinutes = parseTimeStrToMinutes(bookingEndTimeStr);

      const potentialSlotStartInMinutes = slotStartHour * 60 + slotStartMinute;
      const potentialSlotEndInMinutes = slotEndHour * 60 + slotEndMinute;

      // Overlap condition: (start1 < end2) && (end1 > start2)
      const overlap = (
        potentialSlotStartInMinutes < existingBookingEndInMinutes &&
        potentialSlotEndInMinutes > existingBookingStartInMinutes
      );
      return overlap;
    });

    if (!isOverlapping && (slotEndHour * 60 + slotEndMinute <= endHour * 60 + endMinute)) {
      slots.push(`${formatTimeToAMPM(slotStartHour, slotStartMinute)} to ${formatTimeToAMPM(slotEndHour, slotEndMinute)}`);
    }

    currentHour = slotEndHour;
    currentMinute = slotEndMinute;
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
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [services, setServices] = useState([]);
  const [addons, setAddons] = useState([]);

  const [newBooking, setNewBooking] = useState({
    user: null,
    phone: '',
    email: '',
    selectedAddress: {},
    service: null,
    selectedWorker: null,
    vehicle: {},
    addons: [],
    paymentMethod: 'cash',
    selectedDate: '',
    selectedTime: '',
  });
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState('');
  const [selectedSavedVehicleId, setSelectedSavedVehicleId] = useState('');
 
  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCloseOriginal } = useDisclosure();
  const { isOpen: isReportModalOpen, onOpen: onOpenReportModal, onClose: onCloseReportModal } = useDisclosure();

  const [reportStartDate, setReportStartDate] = useState(null);
  const [reportEndDate, setReportEndDate] = useState(null);
  const [selectedReportServices, setSelectedReportServices] = useState([]);
  const [selectedReportWorkers, setSelectedReportWorkers] = useState([]);
  const [selectedReportStatuses, setSelectedReportStatuses] = useState([]);
  const onCreateClose = () => {
    onCloseOriginal();
    setNewBooking({
      user: null,
      phone: '',
      email: '',
      selectedAddress: {},
      service: null,
      selectedWorker: null,
      vehicle: {},
      addons: [],
      paymentMethod: 'cash',
      selectedDate: '',
      selectedTime: '',
    });
    setSelectedSavedAddressId('');
    setSelectedSavedVehicleId('');
    setCurrentFormStep(1);
    setUserSearchTerm('');
  };
  const addressInputRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapContainerRef = useRef(null); // New ref for the map container
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [currentFormStep, setCurrentFormStep] = useState(1);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places', 'geometry'],
  });

  const fetchBookings = async () => {
    setLoading(true);
    try {
            const q = query(collection(firestore, "bookings"), orderBy("selectedDate", "desc"));
      const querySnapshot = await getDocs(q);
      const bookingsList = await Promise.all(querySnapshot.docs.map(async (bookingDoc) => {
        const booking = { id: bookingDoc.id, ...bookingDoc.data() };

        let customerName = booking.customerName || 'N/A';
        let serviceName = booking.serviceName || 'N/A';
        let workerName = booking.workerName || 'N/A';
        let userDetails = {};
        let serviceDetails = {};
        let workerDetails = {};

        if (booking.userId) {
            const userDocRef = doc(firestore, "users", booking.userId);
            const userDoc = await getDoc(userDocRef);
            userDetails = userDoc.data() || {};
            customerName = userDetails.fullName || customerName;
        }

        if (booking.serviceId) {
            const serviceDocRef = doc(firestore, "services", booking.serviceId);
            const serviceDoc = await getDoc(serviceDocRef);
            serviceDetails = serviceDoc.data() || {};
            serviceName = serviceDetails.name || serviceName;
        }

        if (booking.workerId) {
            const workerDocRef = doc(firestore, "workers", booking.workerId);
            const workerDoc = await getDoc(workerDocRef);
            workerDetails = workerDoc.data() || {};
            workerName = workerDetails.fullName || workerDetails.userName || workerName;
        }

        return {
          ...booking,
          customerName,
          serviceName,
          workerName,
          userDetails,
          serviceDetails,
          workerDetails,
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
        customerName: newBooking.user?.fullName || userSearchTerm,
        phone: newBooking.phone,
        email: newBooking.email,
        selectedAddress: {
          id: newBooking.selectedAddress.id,
          address: newBooking.selectedAddress.address,
          latitude: newBooking.selectedAddress.latitude,
          longitude: newBooking.selectedAddress.longitude,
          name: newBooking.selectedAddress.name,
          type: newBooking.selectedAddress.type,
        },
        serviceId: newBooking.service?.id || null,
        serviceName: newBooking.service?.name || null,
        serviceMainImageUrl: newBooking.service?.mainImageUrl || null,
        mainCategoryName: newBooking.service?.mainCategoryName || null,
        subCategoryName: newBooking.service?.subCategoryName || null,
        workerId: newBooking.selectedWorker?.id || null,
        workerName: newBooking.selectedWorker?.fullName || newBooking.selectedWorker?.userName || null,
        vehicle: {
          id: newBooking.vehicle?.id,
          company: newBooking.vehicle?.company,
          model: newBooking.vehicle?.model,
          modelYear: newBooking.vehicle?.modelYear,
          color: newBooking.vehicle?.color,
          plateNumberPart1: newBooking.vehicle?.plateNumberPart1,
          plateNumberPart2: newBooking.vehicle?.plateNumberPart2,
          userId: newBooking.user?.id || null,
        },
        addons: Array.isArray(newBooking.addons) ? newBooking.addons : [],
        paymentMethod: newBooking.paymentMethod,
        selectedDate: newBooking.selectedDate,
        selectedTime: newBooking.selectedTime,
        totalAmount: '', // Set this as needed
        status: 'confirmed',
        createdAt: serverTimestamp(),
      });
      toast({ title: "Booking created", status: "success" });
      fetchBookings();
      onCreateClose();
    } catch (err) {
      toast({ title: "Error creating booking", status: "error", description: err.message });
    }
    setLoading(false);
  };

  const openView = useCallback(async (booking) => {
    let detailedAddons = [];
    let addonsByVehicle = null;

    const addonsData = booking.addons;

    if (typeof addonsData === 'object' && addonsData !== null && !Array.isArray(addonsData)) {
        // --- NEW FORMAT ---
        // The object contains vehicle IDs mapped to arrays of addon *objects*.
        // The details are already here, no need to fetch.
        addonsByVehicle = addonsData;
        detailedAddons = Object.values(addonsData).flat();

    } else if (Array.isArray(addonsData) && addonsData.length > 0) {
        // --- OLD FORMATS ---
        if (typeof addonsData[0] === 'string') {
            // Array of addon IDs, so we need to fetch details.
            try {
                const addonDetailsPromises = addonsData.map(addonId => {
                    if (typeof addonId === 'string' && addonId.trim() !== '') {
                        return getDoc(doc(firestore, "products", addonId));
                    }
                    return null;
                }).filter(Boolean);

                const addonDocs = await Promise.all(addonDetailsPromises);
                detailedAddons = addonDocs.filter(doc => doc && doc.exists()).map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error("Error fetching addon details for old format:", error);
                toast({ title: "Error fetching addon details", status: "error", description: error.message });
                detailedAddons = []; // Reset on error
            }
        } else if (typeof addonsData[0] === 'object' && addonsData[0] !== null) {
            // Array of addon objects, details are already here.
            detailedAddons = addonsData;
        }
    }

    setViewBooking({
        ...booking,
        detailedAddons: detailedAddons || [],
        addonsByVehicle
    });
    onViewOpen();
  }, [onViewOpen, toast]);

  const columns = useMemo(() => [
    { Header: "Customer", accessor: "customerName" },
    { Header: "Service", accessor: "serviceName" },
    {
      Header: "Booking Date",
      accessor: 'selectedDate',
      id: 'bookingDate',
      Cell: ({ row, cell }) => {
        return row.original ? `${row.original.selectedDate} ${row.original.selectedTime}` : '';
      },
      aggregate: 'count',
      Aggregated: ({ value }) => `${value} bookings`,
    },
    { Header: "Assigned Staff", accessor: "workerName" },
    { Header: "Status", accessor: "status",       Cell: ({value}) => <Tag colorScheme={value === 'Completed' ? 'green' : value === 'pending' ? 'orange' : value === 'confirmed' ? 'blue' : 'red'}>{value}</Tag>,
      Aggregated: ({ cell }) => {
        if (!cell.subRows) {
          return null; // Handle cases where subRows might not be available
        }
        const uniqueStatuses = [...new Set(cell.subRows.map(row => row.original.status))];
        if (uniqueStatuses.length === 1) {
          return <Tag colorScheme={uniqueStatuses[0] === 'Completed' ? 'green' : uniqueStatuses[0] === 'pending' ? 'orange' : uniqueStatuses[0] === 'confirmed' ? 'blue' : 'red'}>{uniqueStatuses[0]}</Tag>;
        }
        return <Tag>Mixed ({uniqueStatuses.length})</Tag>;
      },
    },
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
      Aggregated: () => null,
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
    state: { groupBy, expanded, pageIndex, pageSize },
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    toggleAllRowsExpanded,
  } = useTable(
    { columns, data: filteredData, initialState: { pageSize: 10, groupBy: ['bookingDate'], autoResetExpanded: false, expanded: true }, autoResetPage: false },
    useGlobalFilter, useFilters, useGroupBy, useSortBy, useExpanded, usePagination
  );

  useEffect(() => {
    setTableGlobalFilter(globalFilter);
    // Set all rows to expanded after data is loaded
    if (bookings.length > 0) {
      toggleAllRowsExpanded(true);
    }
  }, [globalFilter, setTableGlobalFilter, bookings, toggleAllRowsExpanded]);

 const eligibleWorkersForServiceAndLocation = useMemo(() => {
  if (!newBooking.service || !newBooking.selectedAddress?.latitude || !newBooking.selectedAddress?.longitude) {
    return [];
  }

  const serviceId = newBooking.service.id;

  return workers.filter(worker => {
    // Must provide the service
    if (!Array.isArray(worker.assignedServices) || !worker.assignedServices.includes(serviceId)) {
      return false;
    }

    // Must have service areas
    if (!Array.isArray(worker.serviceArea) || worker.serviceArea.length === 0) {
      return false;
    }

    const customerLat = newBooking.selectedAddress.latitude;
    const customerLng = newBooking.selectedAddress.longitude;
    const customerLatLng = new window.google.maps.LatLng(customerLat, customerLng);

    // Check all service areas for a match
    return worker.serviceArea.some(area => {
      try {
        const geo = JSON.parse(area.geometry);
        if (!geo?.type || !geo?.coordinates) return false;

        if (geo.type === "Point") {
          // Handle circular area
          const [lng, lat] = geo.coordinates;
          const radius = geo.properties?.radius || 0;
          const distance = calculateDistance(
            { lat, lng },
            { lat: customerLat, lng: customerLng }
          );
          return distance <= radius;
        }

        if (geo.type === "Polygon") {
          // Handle polygon area
          const polygonCoords = geo.coordinates[0].map(([lng, lat]) => new window.google.maps.LatLng(lat, lng));
          const polygon = new window.google.maps.Polygon({ paths: polygonCoords });
          return window.google.maps.geometry.poly.containsLocation(customerLatLng, polygon);
        }

        return false;
      } catch (err) {
        console.warn("Invalid geometry for worker", worker.userName, err);
        return false;
      }
    });
  });
}, [newBooking.service, newBooking.selectedAddress, workers]);


  useEffect(() => {
    if (eligibleWorkersForServiceAndLocation.length > 0) {
      setNewBooking(prev => ({ ...prev, selectedWorker: eligibleWorkersForServiceAndLocation[0] }));
    } else {
      setNewBooking(prev => ({ ...prev, selectedWorker: null }));
    }
  }, [eligibleWorkersForServiceAndLocation]);

const availableServices = useMemo(() => {
  if (!newBooking.selectedAddress?.latitude || !newBooking.selectedAddress?.longitude || !isLoaded) {
    return [];
  }

  const eligibleWorkerServiceIds = new Set();
  const customerLat = newBooking.selectedAddress.latitude;
  const customerLng = newBooking.selectedAddress.longitude;
  const customerLatLng = new window.google.maps.LatLng(customerLat, customerLng);

  workers.forEach(worker => {
    if (!Array.isArray(worker.serviceArea)) return;

    const isWithinAnyArea = worker.serviceArea.some(area => {
      try {
        const geo = JSON.parse(area.geometry);
        if (geo.type === "Point") {
          const [lng, lat] = geo.coordinates;
          const radius = geo.properties?.radius || 0;
          const distance = calculateDistance({ lat, lng }, { lat: customerLat, lng: customerLng });
          return distance <= radius;
        }
        if (geo.type === "Polygon") {
          const polygonCoords = geo.coordinates[0].map(([lng, lat]) => new window.google.maps.LatLng(lat, lng));
          const polygon = new window.google.maps.Polygon({ paths: polygonCoords });
          return window.google.maps.geometry.poly.containsLocation(customerLatLng, polygon);
        }
        return false;
      } catch {
        return false;
      }
    });

    if (isWithinAnyArea && Array.isArray(worker.assignedServices)) {
      worker.assignedServices.forEach(sid => eligibleWorkerServiceIds.add(sid));
    }
  });

  return services.filter(s => eligibleWorkerServiceIds.has(s.id));
}, [newBooking.selectedAddress, workers, services, isLoaded]);

  const availableAddons = useMemo(() => {
    if (!newBooking.selectedWorker) return [];
    const assignedServiceIds = Array.isArray(newBooking.selectedWorker.assignedServices)
      ? newBooking.selectedWorker.assignedServices
      : [];
    // Show addons where addon.assignedServices includes any of the worker's assignedServices
    return addons.filter(addon =>
      Array.isArray(addon.assignedServices) &&
      addon.assignedServices.some(sid => assignedServiceIds.includes(sid))
    );
  }, [newBooking.selectedWorker, addons]);

  const userAddresses = useMemo(() => {
    if (newBooking.user && newBooking.user.addresses) {
      if (Array.isArray(newBooking.user.addresses)) {
        return newBooking.user.addresses.map(addr => ({ id: addr.id, ...addr }));
      } else if (typeof newBooking.user.addresses === 'object' && newBooking.user.addresses !== null) {
        return Object.keys(newBooking.user.addresses).map(key => ({ id: key, ...newBooking.user.addresses[key] }));
      }
    }
    return [];
  }, [newBooking.user?.addresses]);

  const userVehicles = useMemo(() => {
    if (newBooking.user && newBooking.user.vehicles) {
      const vehiclesArray = (Array.isArray(newBooking.user.vehicles) ? newBooking.user.vehicles : Object.values(newBooking.user.vehicles)).map(vehicle => ({
        ...vehicle,
        name: `${vehicle.company || ''} ${vehicle.model || ''} (${vehicle.modelYear || ''})`.trim()
      }));
      return vehiclesArray;
    }
    return [];
  }, [newBooking.user]);

  const availableTimeSlots = useMemo(() => {
    if (!newBooking.selectedDate || !newBooking.selectedWorker || !newBooking.service || !appSettings) return [];

    const workerBookingsOnSelectedDate = bookings.filter(booking =>
      booking.workerId === newBooking.selectedWorker.id &&
      booking.selectedDate === newBooking.selectedDate &&
      (booking.status === 'pending' || booking.status === 'confirmed')
    );

    return generateTimeSlots(
      newBooking.selectedDate,
      appSettings,
      newBooking.selectedWorker,
      newBooking.service,
      workerBookingsOnSelectedDate,
      newBooking.addons, // Pass selected addon IDs
      addons // Pass all addons for duration lookup
    );
  }, [newBooking.selectedDate, newBooking.selectedWorker, newBooking.service, appSettings, bookings, newBooking.addons, addons]);

  const filteredUsers = useMemo(() => {
    if (!userSearchTerm) return [];
    return users.filter(user =>
      user.fullName && user.fullName.toLowerCase().includes(userSearchTerm.toLowerCase())
    );
  }, [userSearchTerm, users]);

  const handleUserSelect = async (user) => {
    const defaultVehicleObj = user.defaultVehicle ? Object.values(user.vehicles || {}).find(veh => veh.id === user.defaultVehicle) : null;

    setNewBooking(prev => ({
      ...prev,
      user,
      phone: user?.phone || '',
      email: user?.email || '',
      selectedAddress: {},
      vehicle: defaultVehicleObj || {},
    }));
    setUserSearchTerm(user.fullName || '');
    setShowUserSuggestions(false);
    setSelectedSavedAddressId('');
    setSelectedSavedVehicleId(user.defaultVehicle || ''); // Set default vehicle ID

    // Fetch addresses and vehicles for the selected user
    try {
      const [addressesSnapshot, vehiclesQuerySnapshot] = await Promise.all([
        getDocs(collection(firestore, "users", user.id, "addresses")),
        getDocs(query(collection(firestore, "vehicles"), where("userId", "==", user.id)))
      ]);

      const fetchedAddresses = addressesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const fetchedVehicles = vehiclesQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setNewBooking(prev => {
        const updatedBooking = {
          ...prev,
          user: {
            ...prev.user,
            addresses: fetchedAddresses,
            vehicles: fetchedVehicles,
          }
        };
        return updatedBooking;
      });
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast({ title: "Error fetching user data", status: "error", description: error.message });
    }
  };

  const handleAddressSelect = (addressObj) => {
    setNewBooking(prev => ({
      ...prev,
      selectedAddress: addressObj,
    }));
  };

  const fetchReportData = async () => {
    setReportLoading(true);
    try {
      let bookingsRef = collection(firestore, "bookings");
      let q = query(bookingsRef);

      // Apply date range filter (only filter applied in Firestore query)
      if (reportStartDate && reportEndDate) {
        const startDate = new Date(reportStartDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(reportEndDate);
        endDate.setHours(23, 59, 59, 999);
        q = query(q, where("selectedDate", ">=", startDate.toISOString().split('T')[0]), where("selectedDate", "<=", endDate.toISOString().split('T')[0]));
      } else {
        // If no date range, fetch all bookings (potentially large)
        // Consider adding a warning or a default date range if this is too broad
      }

      const querySnapshot = await getDocs(q);
      let reportBookings = await Promise.all(querySnapshot.docs.map(async (bookingDoc) => {
        const booking = { id: bookingDoc.id, ...bookingDoc.data() };

        // Fetch related data for detailed report
        if (booking.userId) {
          const userDoc = await getDoc(doc(firestore, "users", booking.userId));
          booking.userDetails = userDoc.data() || {};
        }
        if (booking.serviceId) {
          const serviceDoc = await getDoc(doc(firestore, "services", booking.serviceId));
          booking.serviceDetails = serviceDoc.data() || {};
        }
        if (booking.workerId) {
          const workerDoc = await getDoc(doc(firestore, "workers", booking.workerId));
          booking.workerDetails = workerDoc.data() || {};
        }
        // Fetch addon details if any
        const getAddonIds = (addons) => {
            if (Array.isArray(addons)) {
                return addons; // Old format
            }
            if (typeof addons === 'object' && addons !== null && Object.keys(addons).length > 0) {
                // New format: { vehicleId: ["addon1", "addon2"], ... }
                return Object.values(addons).flat();
            }
            return []; // No addons or unknown format
        };

        const addonIds = getAddonIds(booking.addons);

        if (addonIds.length > 0) {
          const addonDetailsPromises = addonIds.map(addonId => getDoc(doc(firestore, "products", addonId)));
          const addonDocs = await Promise.all(addonDetailsPromises);
          booking.addonDetails = addonDocs.map(doc => doc.data());
        }

        return booking;
      }));

      // Perform all other filtering client-side
      if (selectedReportServices.length > 0) {
        reportBookings = reportBookings.filter(booking => selectedReportServices.includes(booking.serviceId));
      }
      if (selectedReportWorkers.length > 0) {
        reportBookings = reportBookings.filter(booking => selectedReportWorkers.includes(booking.workerId));
      }
      if (selectedReportStatuses.length > 0) {
        reportBookings = reportBookings.filter(booking => selectedReportStatuses.includes(booking.status));
      }

      console.log("Generated Report Data:", reportBookings);
      // Store reportBookings in a state variable to be used for download
      setReportData(reportBookings);

    } catch (err) {
      console.error("Error generating report:", err);
      toast({ title: "Error generating report", status: "error", description: err.message });
    }
    setReportLoading(false);
  };

  const exportToCsv = (dataToExport, filename = 'report.csv') => {
    const headers = [
      "Booking ID",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Payment Method",
      "Booking Date",
      "Booking Time",
      "Service Name",
      "Service Cost",
      "Service Duration",
      "Service Description",
      "Service Important Notes",
      "Service What's Included",
      "Status",
      "Total Amount",
      "Tip Amount",
      "Tip Payment Method",
      "Worker Name",
      "Worker Email",
      "Worker Phone",
      "Address Name",
      "Address Street",
      "Address Latitude",
      "Address Longitude",
      "Address Type",
      "Vehicle Company",
      "Vehicle Model",
      "Vehicle Year",
      "Vehicle Color",
      "Vehicle Plate Part 1",
      "Vehicle Plate Part 2",
      "Addons"
    ];

    const csvRows = dataToExport.map(booking => {
      const row = [
        booking.id || '',
        booking.customerName || booking.userDetails?.fullName || '',
        booking.email || booking.userDetails?.email || '',
        `'${booking.phone || booking.userDetails?.phone || ''}'`,
        booking.paymentMethod || '',
        booking.selectedDate || '',
        booking.selectedTime || '',
        booking.serviceName || booking.serviceDetails?.name || '',
        booking.serviceDetails?.cost || '',
        booking.serviceDetails?.duration || '',
        booking.serviceDetails?.description || '',
        (booking.serviceDetails?.importantNotes || []).join('; '),
        (booking.serviceDetails?.whatsIncluded || []).join('; '),
        booking.status || '',
        booking.totalAmount || '',
        booking.tipAmount || '',
        booking.tipPaymentMethod || '',
        booking.workerName || booking.workerDetails?.fullName || booking.workerDetails?.userName || '',
        booking.workerDetails?.email || '',
        booking.workerDetails?.phone || '',
        booking.selectedAddress?.name || '',
        booking.selectedAddress?.address || '',
        booking.selectedAddress?.latitude || '',
        booking.selectedAddress?.longitude || '',
        booking.selectedAddress?.type || '',
        booking.vehicle?.company || '',
        booking.vehicle?.model || '',
        booking.vehicle?.modelYear || '',
        booking.vehicle?.color || '',
        booking.vehicle?.plateNumberPart1 || '',
        booking.vehicle?.plateNumberPart2 || '',
        (booking.addonDetails || []).map(addon => `${addon.name} (${addon.price})`).join('; '),
      ];
      return row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.map(header => `"${header}"`).join(','), ...csvRows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateInvoice = () => {
    const invoiceElement = document.getElementById('invoice-template');
    if (invoiceElement) {
      html2canvas(invoiceElement)
        .then((canvas) => {
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF();
          const imgProps= pdf.getImageProperties(imgData);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`invoice-${viewBooking.id}.pdf`);
        });
    }
  };


  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }}>
      <div id="invoice-container" style={{ position: 'absolute', left: '-9999px' }} >
        {viewBooking && <InvoiceTemplate booking={viewBooking} />}
      </div>
      <style>
        {`
          .react-datepicker-wrapper {
            width: 100%;
          }
        `}
      </style>
      <Card overflowX={{ sm: "scroll", xl: "hidden" }} pb="15px">
        <CardHeader p="6px 0px 22px 0px">
          <Flex justify="space-between" align="center">
            <Heading size="md">Bookings</Heading>
            <Flex>
                <Button colorScheme="purple" onClick={onOpenReportModal} mr={4}>Generate Report</Button>
                <Button colorScheme="blue" onClick={onCreateOpen}>Create Booking</Button>
            </Flex>
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
                <option value="Completed">Completed</option>
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
                {page.map((row, i) => {
                  prepareRow(row);
                  return (
                    <Tr {...row.getRowProps()}>
                      {row.cells.map(cell => {
                        return (
                          <Td {...cell.getCellProps()}>
                            {cell.isGrouped ? (
                              <Flex align="center" {...row.getToggleRowExpandedProps()} style={{ cursor: 'pointer', width: '100%' }}>
                                <Icon as={row.isExpanded ? VscChevronDown : VscChevronRight} mr={2} />
                                <Text fontWeight="bold">{cell.value}</Text>
                                <Tag colorScheme="red" ml={2}>{row.subRows.length}</Tag>
                              </Flex>
                            ) : cell.isAggregated ? (
                              cell.render('Aggregated')
                            ) : cell.isPlaceholder && cell.column.id !== 'bookingDate' ? null : (
                              cell.render('Cell')
                            )}
                          </Td>
                        );
                      })}
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
              <Box>Page {pageIndex + 1} of {pageOptions.length}</Box>
              <Button size="sm" onClick={() => nextPage()} disabled={!canNextPage}>&gt;</Button>
              <Button size="sm" onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>&gt;&gt;</Button>
              <Select size="sm" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} w="auto" ml={2}>
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
                <Text>Name: {viewBooking.userDetails?.fullName || viewBooking.customerName}</Text>
                <Text>Email: {viewBooking.userDetails?.email || viewBooking.email}</Text>
                  <Text>Phone: {viewBooking.userDetails?.phone || viewBooking.phone}</Text>

                <Heading size="md" mt={4}>Vehicle Details</Heading>
                {viewBooking.vehicles && Array.isArray(viewBooking.vehicles) && viewBooking.vehicles.length > 0 ? (
                    viewBooking.vehicles.map((v, index) => (
                        <Box key={index} mt={index > 0 ? 3 : 0} p={2} borderWidth="1px" borderRadius="md">
                            <Text fontWeight="bold">Vehicle {index + 1}</Text>
                            <Text>Company: {v.company}</Text>
                            <Text>Model: {v.model}</Text>
                            <Text>Year: {v.modelYear}</Text>
                            <Text>Color: {v.color}</Text>
                            <Text>Plate: {v.plateNumberPart1}-{v.plateNumberPart2}</Text>
                        </Box>
                    ))
                ) : viewBooking.vehicle?.company ? (
                    <Box>
                        <Text>Company: {viewBooking.vehicle.company}</Text>
                        <Text>Model: {viewBooking.vehicle.model}</Text>
                        <Text>Year: {viewBooking.vehicle.modelYear}</Text>
                        <Text>Color: {viewBooking.vehicle.color}</Text>
                        <Text>Plate: {viewBooking.vehicle.plateNumberPart1}-{viewBooking.vehicle.plateNumberPart2}</Text>
                    </Box>
                ) : (
                    <Text>No vehicle details available.</Text>
                )}

                <Heading size="md" mt={4}>Address Details</Heading>
                <Text>Name: {viewBooking.selectedAddress?.name}</Text>
                <Text>Address: {viewBooking.selectedAddress?.address}</Text>

                <Heading size="md" mt={4}>Service Details</Heading>
                <Text>Name: {viewBooking.serviceDetails?.name}</Text>
                <Text>Price: {viewBooking.serviceDetails?.cost}</Text>

                <Heading size="md" mt={4}>Worker Details</Heading>
                <Text>Name: {viewBooking.workerDetails?.fullName || viewBooking.workerDetails?.userName}</Text>
                <Text>Email: {viewBooking.workerDetails?.email}</Text>

                <Heading size="md" mt={4}>Booking Information</Heading>
                <Text>Status: {viewBooking.status}</Text>
                <Text>Date & Time: {viewBooking.selectedDate} {viewBooking.selectedTime}</Text>

                {viewBooking.tipAmount && (
                  <>
                    <Heading size="md" mt={4}>Tip Information</Heading>
                    <Text>Tip Amount: {viewBooking.tipAmount}</Text>
                    {viewBooking.tipPaymentMethod && <Text>Tip Payment Method: {viewBooking.tipPaymentMethod}</Text>}
                  </>
                )}

                {(viewBooking.detailedAddons && viewBooking.detailedAddons.length > 0) && (
                  <>
                    <Heading size="md" mt={4}>Addons</Heading>
                    {viewBooking.addonsByVehicle ? (
                        // New format: addons grouped by vehicle
                        Object.keys(viewBooking.addonsByVehicle).map((vehicleId) => {
                            const vehicle = (viewBooking.vehicles && Array.isArray(viewBooking.vehicles))
                                ? viewBooking.vehicles.find(v => v.id === vehicleId)
                                : (viewBooking.vehicle?.id === vehicleId ? viewBooking.vehicle : null);

                            const addonsForVehicle = viewBooking.addonsByVehicle[vehicleId];
                            
                            if (addonsForVehicle && addonsForVehicle.length > 0) {
                                return (
                                    <Box key={vehicleId} mt={2} p={2} borderWidth="1px" borderRadius="md">
                                        <Text fontWeight="bold">Vehicle: {vehicle?.company} {vehicle?.model} ({vehicle?.plateNumberPart1}-{vehicle?.plateNumberPart2})</Text>
                                        {addonsForVehicle.map((addon, index) => (
                                            <Text key={index}>{addon.name} - AED{addon.cost}</Text>
                                        ))}
                                    </Box>
                                );
                            }
                            return null;
                        })
                    ) : (
                        // Old format: flat list of addons
                        viewBooking.detailedAddons.map((addon, index) => (
                            <Text key={index}>- {addon.name} - ${addon.price}</Text>
                        ))
                    )}
                  </>
                )}
                {(!viewBooking.detailedAddons || viewBooking.detailedAddons.length === 0) && (
                    <Text mt={4}>No addons selected for this booking.</Text>
                )}
              </Box>
            </ModalBody>
            <ModalFooter>
              {!['cancelled', 'completed', 'under progress'].includes(viewBooking.status.toLowerCase()) && (
                <Button colorScheme="red" mr={3} onClick={() => handleCancel(viewBooking.id)} isLoading={loading}>
                  Cancel Booking
                </Button>
              )}
              {viewBooking.status !== 'cancelled' && (
                <Button colorScheme="blue" mr={3} onClick={handleGenerateInvoice}>
                  Generate Invoice
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
              {currentFormStep === 1 && (
                <>
                  <FormControl>
                    <FormLabel>User</FormLabel>
                    <Input
                      placeholder="Search or enter full name"
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
                              {user.fullName || user.email}
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
                    {(newBooking.user && userAddresses.length > 0) || selectedSavedAddressId === 'new_address' ? (
                      <Select placeholder="Select saved address" mt={2} value={selectedSavedAddressId} onChange={(e) => {
                        const selectedId = e.target.value;
                        setSelectedSavedAddressId(selectedId);
                        if (selectedId === 'new_address') {
                          setNewBooking(prev => ({ ...prev, address: '', addressCoordinates: null }));
                        } else {
                          const selectedAddress = userAddresses.find(addr => addr.id === selectedId);
                          handleAddressSelect(selectedAddress);
                        }
                      }}>
                        {userAddresses.map(addr => <option key={addr.id} value={addr.id}>{addr.name}: {addr.address}</option>)}
                        <option value="new_address">Add New Address</option>
                      </Select>
                    ) : null}
                    {(!newBooking.user || userAddresses.length === 0 || selectedSavedAddressId === 'new_address') && isLoaded && (
                      <GooglePlacesAutocomplete
                        apiKey={GOOGLE_MAPS_API_KEY}
                        selectProps={{
                          placeholder: "Enter address",
                          value: newBooking.selectedAddress.address ? { label: newBooking.selectedAddress.address, value: newBooking.selectedAddress.address } : null,
                          onChange: (selected) => {
                            if (selected) {
                              geocodeByAddress(selected.label)
                                .then(results => getLatLng(results[0]))
                                .then(({ lat, lng }) => {
                                  const newPosition = { lat, lng };
                                  setNewBooking(prev => ({
                                    ...prev,
                                    selectedAddress: {
                                      id: `temp-${Date.now()}`,
                                      address: selected.label,
                                      latitude: lat,
                                      longitude: lng,
                                      name: "New Address", // Default name for new address
                                      type: "Others", // Default type for new address
                                    },
                                  }));
                                  if (mapRef.current) {
                                    mapRef.current.panTo(newPosition);
                                    mapRef.current.setZoom(16);
                                  }
                                })
                                .catch(error => console.error('Error', error));
                            } else {
                              setNewBooking(prev => ({ ...prev, selectedAddress: {} }));
                            }
                          },
                          styles: {
                            container: (provided) => ({ ...provided, marginTop: '8px' }),
                          },
                        }}
                        autocompletionRequest={{
                          componentRestrictions: { country: ['ae'] },
                        }}
                      />
                    )}
                    <Box mt={2} style={containerStyle}>
                        {isLoaded && (
                          <GoogleMap
                            mapContainerStyle={containerStyle}
                            center={newBooking.selectedAddress.latitude && newBooking.selectedAddress.longitude ? { lat: newBooking.selectedAddress.latitude, lng: newBooking.selectedAddress.longitude } : center}
                            zoom={14}
                            onLoad={map => mapRef.current = map}
                            onUnmount={() => mapRef.current = null}
                            onClick={(e) => {
                              const newPosition = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                              const geocoder = new window.google.maps.Geocoder();
                              geocoder.geocode({ location: e.latLng }, (results, status) => {
                                if (status === 'OK' && results[0]) {
                                  setNewBooking(prev => ({
                                    ...prev,
                                    selectedAddress: {
                                      id: `temp-${Date.now()}`,
                                      address: results[0].formatted_address,
                                      latitude: newPosition.lat,
                                      longitude: newPosition.lng,
                                      name: "New Address", // Default name for new address
                                      type: "Others", // Default type for new address
                                    },
                                  }));
                                }
                              });
                            }}
                          >
                            {newBooking.selectedAddress.latitude && newBooking.selectedAddress.longitude && (
                              <Marker
                                position={{ lat: newBooking.selectedAddress.latitude, lng: newBooking.selectedAddress.longitude }}
                                draggable={true}
                                onDragEnd={(e) => {
                                  const newPosition = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                                  const geocoder = new window.google.maps.Geocoder();
                                  geocoder.geocode({ location: e.latLng }, (results, status) => {
                                    if (status === 'OK' && results[0]) {
                                      setNewBooking(prev => ({
                                        ...prev,
                                        selectedAddress: {
                                          id: `temp-${Date.now()}`,
                                          address: results[0].formatted_address,
                                          latitude: newPosition.lat,
                                          longitude: newPosition.lng,
                                          name: "New Address", // Default name for new address
                                          type: "Others", // Default type for new address
                                        },
                                      }));
                                    }
                                  });
                                }}
                              />
                            )}
                          </GoogleMap>
                        )}
                      </Box>
                    
                  </FormControl>
                </>
              )}
              {currentFormStep === 2 && (
                <>
                  <FormControl mt={4}>
                    <FormLabel>Service</FormLabel>
                    <Select placeholder="Select service" onChange={(e) => setNewBooking({ ...newBooking, service: services.find(s => s.id === e.target.value) })}>
                      {availableServices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
                    </Select>
                  </FormControl>
                  <FormControl mt={4}>
                    <FormLabel>Addons</FormLabel>
                    <CheckboxGroup
                      value={newBooking.addons}
                      onChange={(values) => setNewBooking({ ...newBooking, addons: values })}
                    >
                      <Stack direction="column">
                        {availableAddons.map(addon => (
                          <Checkbox key={addon.id} value={addon.id}>
                            {addon.name} {addon.time ? `(+${addon.time} min)` : ""}
                          </Checkbox>
                        ))}
                      </Stack>
                    </CheckboxGroup>
                  </FormControl>
                  <FormControl mt={4} w="100%">
                    <FormLabel>Date</FormLabel>
                    <DatePicker
                        selected={newBooking.selectedDate ? new Date(newBooking.selectedDate) : null}
                        onChange={(date) => setNewBooking({ ...newBooking, selectedDate: date ? date.toISOString().split('T')[0] : '' })}
                        dateFormat="yyyy-MM-dd"
                        minDate={new Date()}
                        excludeDates={[
                          ...(appSettings?.offDates || []).map(dateString => new Date(dateString)),
                          ...(newBooking.selectedWorker?.offDates || []).map(dateString => new Date(dateString))
                        ]}
                        placeholderText="Select a date"
                        customInput={<CustomDatePickerInput />}
                      />
                  </FormControl>
                  <FormControl mt={4}>
                    <FormLabel>Time</FormLabel>
                    {newBooking.selectedDate && newBooking.selectedWorker && newBooking.service && appSettings && (
                      availableTimeSlots.length > 0 ? (
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
                      ) : (
                        <Text color="red.500" fontSize="sm">No time slots available for the selected date. This might be a company or worker off-date, or all slots are booked.</Text>
                      )
                    )}
                  </FormControl>
                  <FormControl mt={4}>
                    <FormLabel>Vehicle</FormLabel>
                    {newBooking.user && userVehicles.length > 0 && (
                      <Select placeholder="Select saved vehicle" mt={2} value={selectedSavedVehicleId} onChange={(e) => {
                        const selectedId = e.target.value;
                        setSelectedSavedVehicleId(selectedId);
                        if (selectedId === 'new_vehicle') {
                          setNewBooking(prev => ({ ...prev, vehicle: {} })); // Set to empty object for new vehicle
                        } else {
                          const vehicle = userVehicles.find(veh => veh.id === selectedId);
                          setNewBooking(prev => ({ ...prev, vehicle: vehicle || {} })); // Set entire vehicle object
                        }
                      }}>
                        {userVehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}
                        <option value="new_vehicle">Add New Vehicle</option>
                      </Select>
                    )}
                    {(!newBooking.user || selectedSavedVehicleId === 'new_vehicle') && (
                      <Box mt={newBooking.user && userVehicles.length > 0 ? 2 : 0}>
                        <FormControl mt={2}>
                          <FormLabel>Company</FormLabel>
                          <Input value={newBooking.vehicle.company || ''} onChange={(e) => setNewBooking(prev => ({ ...prev, vehicle: { ...prev.vehicle, company: e.target.value } }))} placeholder="e.g., Toyota" />
                        </FormControl>
                        <FormControl mt={2}>
                          <FormLabel>Model</FormLabel>
                          <Input value={newBooking.vehicle.model || ''} onChange={(e) => setNewBooking(prev => ({ ...prev, vehicle: { ...prev.vehicle, model: e.target.value } }))} placeholder="e.g., Camry" />
                        </FormControl>
                        <FormControl mt={2}>
                          <FormLabel>Year</FormLabel>
                          <Input value={newBooking.vehicle.modelYear || ''} onChange={(e) => setNewBooking(prev => ({ ...prev, vehicle: { ...prev.vehicle, modelYear: e.target.value } }))} placeholder="e.g., 2020" />
                        </FormControl>
                        <FormControl mt={2}>
                          <FormLabel>Color</FormLabel>
                          <Input value={newBooking.vehicle.color || ''} onChange={(e) => setNewBooking(prev => ({ ...prev, vehicle: { ...prev.vehicle, color: e.target.value } }))} placeholder="e.g., Black" />
                        </FormControl>
                        <FormControl mt={2}>
                          <FormLabel>Plate Number Part 1</FormLabel>
                          <Input value={newBooking.vehicle.plateNumberPart1 || ''} onChange={(e) => setNewBooking(prev => ({ ...prev, vehicle: { ...prev.vehicle, plateNumberPart1: e.target.value } }))} placeholder="e.g., A" />
                        </FormControl>
                        <FormControl mt={2}>
                          <FormLabel>Plate Number Part 2</FormLabel>
                          <Input value={newBooking.vehicle.plateNumberPart2 || ''} onChange={(e) => setNewBooking(prev => ({ ...prev, vehicle: { ...prev.vehicle, plateNumberPart2: e.target.value } }))} placeholder="e.g., 12345" />
                        </FormControl>
                      </Box>
                    )}
                  </FormControl>
                  <FormControl mt={4}>
                    <FormLabel>Payment Method</FormLabel>
                    <Input value={newBooking.paymentMethod} isReadOnly />
                  </FormControl>
                </>
              )}
            </ModalBody>
         
          <ModalFooter>
              {currentFormStep === 1 && (
                <Button
                  colorScheme="blue"
                  mr={3}
                  onClick={() => newBooking.selectedAddress.latitude && newBooking.selectedAddress.longitude && setCurrentFormStep(2)}
                  isDisabled={!(newBooking.selectedAddress.latitude && newBooking.selectedAddress.longitude)}
                >
                  Next
                </Button>
              )}
              {currentFormStep === 2 && (
                <>
                  <Button variant="ghost" mr={3} onClick={() => setCurrentFormStep(1)}>
                    Back
                  </Button>
                  <Button colorScheme="blue" mr={3} onClick={handleSave} isLoading={loading}>
                    Save
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={onCreateClose}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      {isReportModalOpen && (
        <Modal isOpen={isReportModalOpen} onClose={onCloseReportModal} isCentered scrollBehavior="inside" size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Generate Detailed Report</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <FormControl mb={4}>
                <FormLabel>Date Range</FormLabel>
                <Flex>
                  <DatePicker
                    selected={reportStartDate}
                    onChange={(date) => setReportStartDate(date)}
                    selectsStart
                    startDate={reportStartDate}
                    endDate={reportEndDate}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="Start Date"
                    customInput={<CustomDatePickerInput />}
                  />
                  <Box mx={2}>to</Box>
                  <DatePicker
                    selected={reportEndDate}
                    onChange={(date) => setReportEndDate(date)}
                    selectsEnd
                    startDate={reportStartDate}
                    endDate={reportEndDate}
                    minDate={reportStartDate}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="End Date"
                    customInput={<CustomDatePickerInput />}
                  />
                </Flex>
              </FormControl>

              <FormControl mb={4}>
                <FormLabel>Services</FormLabel>
                <Menu closeOnSelect={false}>
                  <MenuButton as={Button} rightIcon={<ChevronDownIcon />} width="100%">
                    {selectedReportServices.length === 0
                      ? "Select Services"
                      : selectedReportServices.length === services.length
                      ? "All Services Selected"
                      : `${selectedReportServices.length} Service(s) Selected`}
                  </MenuButton>
                  <MenuList>
                    <MenuItem>
                      <Checkbox
                        isChecked={selectedReportServices.length === services.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedReportServices(services.map(s => s.id));
                          } else {
                            setSelectedReportServices([]);
                          }
                        }}
                      >
                        Select All
                      </Checkbox>
                    </MenuItem>
                    <CheckboxGroup value={selectedReportServices} onChange={setSelectedReportServices}>
                      {services.map(service => (
                        <MenuItem key={service.id}>
                          <Checkbox value={service.id}>{service.name}</Checkbox>
                        </MenuItem>
                      ))}
                    </CheckboxGroup>
                  </MenuList>
                </Menu>
              </FormControl>

              <FormControl mb={4}>
                <FormLabel>Workers</FormLabel>
                <Menu closeOnSelect={false}>
                  <MenuButton as={Button} rightIcon={<ChevronDownIcon />} width="100%">
                    {selectedReportWorkers.length === 0
                      ? "Select Workers"
                      : selectedReportWorkers.length === workers.length
                      ? "All Workers Selected"
                      : `${selectedReportWorkers.length} Worker(s) Selected`}
                  </MenuButton>
                  <MenuList>
                    <MenuItem>
                      <Checkbox
                        isChecked={selectedReportWorkers.length === workers.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedReportWorkers(workers.map(w => w.id));
                          } else {
                            setSelectedReportWorkers([]);
                          }
                        }}
                      >
                        Select All
                      </Checkbox>
                    </MenuItem>
                    <CheckboxGroup value={selectedReportWorkers} onChange={setSelectedReportWorkers}>
                      {workers.map(worker => (
                        <MenuItem key={worker.id}>
                          <Checkbox value={worker.id}>{worker.userName}</Checkbox>
                        </MenuItem>
                      ))}
                    </CheckboxGroup>
                  </MenuList>
                </Menu>
              </FormControl>

              <FormControl mb={4}>
                <FormLabel>Status</FormLabel>
                <CheckboxGroup value={selectedReportStatuses} onChange={setSelectedReportStatuses}>
                  <Stack direction="row">
                    <Checkbox value="pending">Pending</Checkbox>
                    <Checkbox value="confirmed">Confirmed</Checkbox>
                    <Checkbox value="Completed">Completed</Checkbox>
                    <Checkbox value="cancelled">Cancelled</Checkbox>
                  </Stack>
                </CheckboxGroup>
              </FormControl>
            </ModalBody>

            <ModalFooter>
              {reportData.length > 0 && (
                <Button colorScheme="green" mr={3} onClick={() => {
                  const now = new Date();
                  const timestamp = now.getFullYear() +
                                    String(now.getMonth() + 1).padStart(2, '0') +
                                    String(now.getDate()).padStart(2, '0') + '_' +
                                    String(now.getHours()).padStart(2, '0') +
                                    String(now.getMinutes()).padStart(2, '0') +
                                    String(now.getSeconds()).padStart(2, '0');
                  const finalFilename = `detailed_report_${timestamp}.csv`;
                  exportToCsv(reportData, finalFilename);
                }}>
                  Download CSV
                </Button>
              )}
              <Button colorScheme="blue" mr={3} onClick={fetchReportData} isLoading={reportLoading} loadingText="Generating...">
                Generate Report
              </Button>
              <Button variant="ghost" onClick={onCloseReportModal}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </Flex>
  );
}