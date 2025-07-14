
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
} from "@chakra-ui/react";
// Custom components
import Card from "components/Card/Card.js";
import CardBody from "components/Card/CardBody.js";
import CardHeader from "components/Card/CardHeader.js";
import BarChart from "components/Charts/BarChart";
import LineChart from "components/Charts/LineChart";
import IconBox from "components/Icons/IconBox";
// Custom icons
import {
  CartIcon,
  DocumentIcon,
  GlobeIcon,
  WalletIcon,
} from "components/Icons/Icons.js";
import React, { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { firestore } from "../../firebase";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import ImageArchitect1 from "assets/img/ImageArchitect1.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

// Variables
import {
  barChartData,
  barChartOptions,
  lineChartData,
  lineChartOptions,
} from "variables/charts";

export default function Dashboard() {
  const [workers, setWorkers] = useState([]);
  const iconBlue = useColorModeValue("#FF7D2E", "#FF7D2E");
  const iconBoxInside = useColorModeValue("white", "white");
  const textColor = useColorModeValue("gray.700", "white");
  const mapRef = useRef();

  useEffect(() => {
    const q = query(collection(firestore, "workers"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const workersData = [];
      querySnapshot.forEach((doc) => {
        workersData.push({ id: doc.id, ...doc.data() });
      });
      setWorkers(workersData);
    });

    return () => unsubscribe();
  }, []);

  const { colorMode } = useColorMode();

  const handleWorkerCardClick = (worker) => {
    if (worker.location && worker.location.latitude && worker.location.longitude) {
      mapRef.current.flyTo([worker.location.latitude, worker.location.longitude], 15);
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
                    $53,897
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
              <Text as='span' color='green.400' fontWeight='bold'>
                +3.48%{" "}
              </Text>
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
                    $3,200
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
              <Text as='span' color='green.400' fontWeight='bold'>
                +5.2%{" "}
              </Text>
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
                  New Clients
                </StatLabel>
                <Flex>
                  <StatNumber fontSize='lg' color={textColor} fontWeight='bold'>
                    +2,503
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
              <Text as='span' color='red.500' fontWeight='bold'>
                -2.82%{" "}
              </Text>
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
                  Total Sales
                </StatLabel>
                <Flex>
                  <StatNumber fontSize='lg' color={textColor} fontWeight='bold'>
                    $173,000
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
              <Text as='span' color='green.400' fontWeight='bold'>
                +8.12%{" "}
              </Text>
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
              Total orders
            </Text>
          </Flex>
          <Box minH='300px'>
            <BarChart chartData={barChartData} chartOptions={barChartOptions} />
          </Box>
        </Card>
        <Box gridColumn={{ lg: "1 / 3" }}>
          <Text fontSize='lg' color={textColor} fontWeight='bold' mb='20px'>
            Worker Locations
          </Text>
          <Card p='0px' maxW={{ sm: "320px", md: "100%" }}>
            <CardBody>
              <Box position="relative">
                <MapContainer ref={mapRef} center={[25.2048, 55.2708]} zoom={10} style={{ height: '400px', width: '100%', borderRadius: '15px' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {workers.map(worker => (
                    worker.location && worker.location.latitude && worker.location.longitude && (
                      <Marker key={worker.id} position={[worker.location.latitude, worker.location.longitude]} />
                    )
                  ))}
                </MapContainer>
                <Box position="absolute" top="10px" right="10px" zIndex="1000" bg="transparent" p="10px" borderRadius="md" maxH="380px" overflowY="auto">
                  {workers.filter(w => w.status === 'active').map(worker => (
                    <Card key={worker.id} mb="10px" bg="white" p="10px" onClick={() => handleWorkerCardClick(worker)} cursor="pointer">
                      <Flex align="center">
                        <Avatar src={worker.profilePic || ImageArchitect1} size="sm" mr="10px" />
                        <Box>
                          <Text fontWeight="bold">{worker.userName}</Text>
                          <Text fontSize="sm">{worker.jobStatus || 'Resting'}</Text>
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
