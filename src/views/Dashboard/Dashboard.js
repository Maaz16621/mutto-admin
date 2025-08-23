
// Chakra imports
import {
  Avatar,
  Box,
  Button,
  Flex,
  Grid,
  Progress,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorMode,
  useColorModeValue,
  Spinner,
} from "@chakra-ui/react";
// Custom components
import Card from "components/Card/Card.js";
import CardBody from "components/Card/CardBody.js";
import CardHeader from "components/Card/CardHeader.js";

import LineChart from "components/Charts/LineChart";
const LazyBar = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Bar })));
import IconBox from "components/Icons/IconBox";
// Custom icons
import {
  CartIcon,
  DocumentIcon,
  GlobeIcon,
  WalletIcon,
} from "components/Icons/Icons.js";
import React, { useEffect, useState, useRef, Suspense, lazy } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { collection, onSnapshot, query, doc, getDoc } from "firebase/firestore";
import { firestore } from  "../../firebase";
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { getBarChartConfig, lineChartData, lineChartOptions } from "variables/charts";


// Variables



ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const containerStyle = {
  width: '100%',
  height: '600px',
  borderRadius: '15px',
};

const center = {
  lat: 24.3506,
  lng: 53.9396
};


const generateMarkerIcon = (name) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("");
  const svg = `
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#FF7D2E" stroke="white" stroke-width="2" />
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="16" font-family="Arial, sans-serif" dy=".3em">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export default function Dashboard() {
  const [workers, setWorkers] = useState([]);
  const [workerJobs, setWorkerJobs] = useState({});
  const [dashboardData, setDashboardData] = useState({
    todayMoney: 0,
    todayBookings: 0,
    completedBookings: 0,
    totalEarnings: 0,
  });
  const [currency, setCurrency] = useState("$");
  const [barChartData, setBarChartData] = useState({ labels: [], datasets: [] });
  const [barChartOptions, setBarChartOptions] = useState({});
  const iconBlue = useColorModeValue("#FF7D2E", "#FF7D2E");
  const iconBoxInside = useColorModeValue("white", "white");
  const textColor = useColorModeValue("gray.700", "white");
  const mapRef = useRef();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: ['places', 'geometry'],
  });

  useEffect(() => {
    const q = query(collection(firestore, "workers"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const workersData = [];
      const newWorkerJobs = {};
      const promises = [];

      querySnapshot.forEach((doc) => {
        const worker = { id: doc.id, ...doc.data() };
        workersData.push(worker);

        if (worker.currentJobId) {
          const jobPromise = getDoc(doc(firestore, "bookings", worker.currentJobId)).then((jobDoc) => {
            if (jobDoc.exists()) {
              newWorkerJobs[worker.id] = jobDoc.data();
            }
          });
          promises.push(jobPromise);
        }
      });

      Promise.all(promises).then(() => {
        setWorkerJobs(newWorkerJobs);
      });

      setWorkers(workersData);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const bookingsUnsubscribe = onSnapshot(collection(firestore, "bookings"), (snapshot) => {
      let todayMoney = 0;
      let todayBookings = 0;
      let completedBookings = 0;
      let totalEarnings = 0;

      const today = new Date().toISOString().slice(0, 10);

      const monthlyData = {};
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      for (let i = 0; i < 6; i++) {
        const date = new Date(currentYear, currentMonth - i, 1);
        const monthYear = `${date.toLocaleString('default', { month: 'short' })}-${date.getFullYear().toString().slice(2)}`;
        monthlyData[monthYear] = 0;
      }

      snapshot.forEach(doc => {
        const booking = doc.data();
        if (booking.status === 'completed') {
          completedBookings++;
          totalEarnings += booking.serviceDetails?.cost || 0;
          if (booking.selectedDate === today) {
            todayMoney += booking.serviceDetails?.cost || 0;
          }

          // For monthly chart data
          if (booking.selectedDate) {
            const bookingDate = new Date(booking.selectedDate);
            const bookingMonthYear = `${bookingDate.toLocaleString('default', { month: 'short' })}-${bookingDate.getFullYear().toString().slice(2)}`;
            if (monthlyData.hasOwnProperty(bookingMonthYear)) {
              monthlyData[bookingMonthYear]++;
            }
          }
        }
        if (booking.selectedDate === today) {
          todayBookings++;
        }
      });

      const labels = Object.keys(monthlyData).reverse();
      const data = Object.values(monthlyData).reverse();

      setDashboardData({ todayMoney, todayBookings, completedBookings, totalEarnings });

      // Update chart data
      const { chartData, chartOptions } = getBarChartConfig({ labels, data });
      setBarChartData(chartData);
      setBarChartOptions(chartOptions);
    });

    return () => bookingsUnsubscribe();
  }, []);

  useEffect(() => {
    const fetchAppSettings = async () => {
      try {
        const appSettingsDoc = await getDoc(doc(firestore, "settings", "appSettings"));
        if (appSettingsDoc.exists()) {
          setCurrency(appSettingsDoc.data().currency || "$");
        }
      } catch (error) {
        console.error("Error fetching app settings:", error);
      }
    };
    fetchAppSettings();
  }, []);

  const { colorMode } = useColorMode();

  const handleWorkerCardClick = (worker) => {
    if (worker.location && worker.location.latitude && worker.location.longitude) {
      const newPosition = { lat: worker.location.latitude, lng: worker.location.longitude };
      if (mapRef.current) {
        mapRef.current.panTo(newPosition);
        mapRef.current.setZoom(15);
      }
    }
  };

  return (
    <Flex flexDirection='column' pt={{ base: "120px", md: "75px" }}>
      <SimpleGrid columns={{ sm: 1, md: 2, xl: 4 }} spacing='24px' mb='20px'>
        <Card minH='125px'>
          <Flex direction='column'>
            <Flex
              flexDirection='row'
              align='center'
              justify='center'
              w='100%'
              mb='25px'>
              <Stat me='auto'>
                <StatLabel
                  fontSize='xs'
                  color='gray.400'
                  fontWeight='bold'
                  textTransform='uppercase'>
                  Today's Money
                </StatLabel>
                <Flex>
                  <StatNumber fontSize='lg' color={textColor} fontWeight='bold'>
                    {currency}{dashboardData.todayMoney}
                  </StatNumber>
                </Flex>
              </Stat>
              <IconBox
                borderRadius='50%'
                as='box'
                h={"45px"}
                w={"45px"}
                bg={iconBlue}>
                <WalletIcon h={"24px"} w={"24px"} color={iconBoxInside} />
              </IconBox>
            </Flex>
            <Text color='gray.400' fontSize='sm'>
              Since last month
            </Text>
          </Flex>
        </Card>
        <Card minH='125px'>
          <Flex direction='column'>
            <Flex
              flexDirection='row'
              align='center'
              justify='center'
              w='100%'
              mb='25px'>
              <Stat me='auto'>
                <StatLabel
                  fontSize='xs'
                  color='gray.400'
                  fontWeight='bold'
                  textTransform='uppercase'>
                  Today's Users
                </StatLabel>
                <Flex>
                  <StatNumber fontSize='lg' color={textColor} fontWeight='bold'>
                    {dashboardData.todayBookings}
                  </StatNumber>
                </Flex>
              </Stat>
              <IconBox
                borderRadius='50%'
                as='box'
                h={"45px"}
                w={"45px"}
                bg={iconBlue}>
                <GlobeIcon h={"24px"} w={"24px"} color={iconBoxInside} />
              </IconBox>
            </Flex>
            <Text color='gray.400' fontSize='sm'>
              Since last month
            </Text>
          </Flex>
        </Card>
        <Card minH='125px'>
          <Flex direction='column'>
            <Flex
              flexDirection='row'
              align='center'
              justify='center'
              w='100%'
              mb='25px'>
              <Stat me='auto'>
                <StatLabel
                  fontSize='xs'
                  color='gray.400'
                  fontWeight='bold'
                  textTransform='uppercase'>
                  Completed Bookings
                </StatLabel>
                <Flex>
                  <StatNumber fontSize='lg' color={textColor} fontWeight='bold'>
                    {dashboardData.completedBookings}
                  </StatNumber>
                </Flex>
              </Stat>
              <IconBox
                borderRadius='50%'
                as='box'
                h={"45px"}
                w={"45px"}
                bg={iconBlue}>
                <DocumentIcon h={"24px"} w={"24px"} color={iconBoxInside} />
              </IconBox>
            </Flex>
            <Text color='gray.400' fontSize='sm'>
              Since last month
            </Text>
          </Flex>
        </Card>
        <Card minH='125px'>
          <Flex direction='column'>
            <Flex
              flexDirection='row'
              align='center'
              justify='center'
              w='100%'
              mb='25px'>
              <Stat me='auto'>
                <StatLabel
                  fontSize='xs'
                  color='gray.400'
                  fontWeight='bold'
                  textTransform='uppercase'>
                  Total Earnings
                </StatLabel>
                <Flex>
                  <StatNumber fontSize='lg' color={textColor} fontWeight='bold'>
                    {currency}{dashboardData.totalEarnings}
                  </StatNumber>
                </Flex>
              </Stat>
              <IconBox
                borderRadius='50%'
                as='box'
                h={"45px"}
                w={"45px"}
                bg={iconBlue}>
                <CartIcon h={"24px"} w={"24px"} color={iconBoxInside} />
              </IconBox>
            </Flex>
            <Text color='gray.400' fontSize='sm'>
              Since last month
            </Text>
          </Flex>
        </Card>
      </SimpleGrid>
      <Grid
        templateColumns={{ sm: "1fr", lg: "2fr 1fr" }}
        templateRows={{ lg: "repeat(2, auto)" }}
        gap='20px'>
        <Card
          bg={
            colorMode === "dark"
              ? "navy.800"
              : "linear-gradient(81.62deg, #313860 2.25%, #151928 79.87%)"
          }
          p='0px'
          maxW={{ sm: "320px", md: "100%" }}>
          <Flex direction='column' mb='40px' p='28px 0px 0px 22px'>
            <Text color='#fff' fontSize='lg' fontWeight='bold' mb='6px'>
              Sales Overview
            </Text>
            <Text color='#fff' fontSize='sm'>
              <Text as='span' color='green.400' fontWeight='bold'>
                (+5) more{" "}
              </Text>
              in 2022
            </Text>
          </Flex>
          <Box minH='300px'>
            <LineChart
              chartData={lineChartData}
              chartOptions={lineChartOptions}
            />
          </Box>
        </Card>
        <Card p='0px' maxW={{ sm: "320px", md: "100%" }}>
          <Flex direction='column' mb='40px' p='28px 0px 0px 22px'>
            <Text color='gray.400' fontSize='sm' fontWeight='bold' mb='6px'>
              PERFORMANCE
            </Text>
            <Text color={textColor} fontSize='lg' fontWeight='bold'>
              Completed Bookings
            </Text>
          </Flex>
          <Box minH='300px'>
            <Suspense fallback={<Flex justify="center" align="center" minH="300px"><Spinner size="xl" /></Flex>}>
              <LazyBar
                data={barChartData}
                options={barChartOptions}
              />
            </Suspense>
          </Box>
        </Card>
        <Box gridColumn={{ lg: "1 / 3" }}>
          <Text fontSize='lg' color={textColor} fontWeight='bold' mb='20px'>
            Worker Locations
          </Text>
          <Card p='0px' maxW={{ sm: "320px", md: "100%" }}>
            <CardBody>
              <Box position="relative">
                {isLoaded ? (
                  <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={center}
                    zoom={10}
                    onLoad={map => mapRef.current = map}
                    onUnmount={() => mapRef.current = null}
                  >
                    {workers.map(worker => (
                      worker.location && worker.location.latitude && worker.location.longitude && (
                        <Marker 
                          key={worker.id} 
                          position={{ lat: worker.location.latitude, lng: worker.location.longitude }} 
                          icon={generateMarkerIcon(worker.userName)}
                        />
                      )
                    ))}
                  </GoogleMap>
                ) : (
                  <Flex justify="center" align="center" minH="400px">
                    <Spinner size="xl" />
                  </Flex>
                )}
                <Box position="absolute" top="10px" right="10px" zIndex="1000" bg="transparent" p="10px" borderRadius="md" maxH="380px" overflowY="auto">
                  {workers.filter(w => w.status === 'active').map(worker => (
                    <Card key={worker.id} mb="10px" bg="white" p="10px" onClick={() => handleWorkerCardClick(worker)} cursor="pointer">
                      <Flex align="center">
                        <Avatar src={worker.profilePic} size="sm" mr="10px" />
                        <Box>
                          <Text fontWeight="bold">{worker.userName}</Text>
                          {workerJobs[worker.id] ? (
                            <Text fontSize="sm" color="green.500">On Job: {workerJobs[worker.id].serviceName}</Text>
                          ) : (
                            <Text fontSize="sm">{worker.jobStatus || 'Idle'}</Text>
                          )}
                        </Box>
                      </Flex>
                    </Card>
                  ))}
                </Box>
              </Box>
            </CardBody>
          </Card>
        </Box>
      </Grid>
    </Flex>
  );
}
