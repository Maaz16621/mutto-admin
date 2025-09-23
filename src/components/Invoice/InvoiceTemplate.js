
import React from 'react';
import { Box, Flex, Heading, Text, Image, Table, Thead, Tbody, Tr, Th, Td } from '@chakra-ui/react';
import logo from '../../assets/img/logo.png';
import stampImage from '../../assets/img/invoice/stamp.png'; // Assuming img27.png is the stamp
import signatureImage from '../../assets/img/invoice/img32.png'; // Assuming img32.png is the signature

const InvoiceTemplate = ({ booking }) => {
  const {
    userDetails,
    vehicle,
    selectedAddress,
    serviceDetails,
    workerDetails,
    addons,
    selectedDate,
    selectedTime,
    id,
    totalAmount
  } = booking;

  const vat = (serviceDetails?.cost || 0) * 0.05;
  const subTotal = serviceDetails?.cost || 0;
  const total = subTotal + vat;

  return (
    <Box id="invoice-template" p={8} bg="white" color="black" width="800px" mx="auto" fontFamily="Arial, sans-serif">
      <Flex justify="space-between" align="flex-start" mb={10}>
        <Box>
          <Image src={logo} alt="Moss Dekk Parking Car Washing LLC" width="150px" mb={4} />
          <Text>Moss Dekk Parking Car Washing LLC</Text>
          <Text>Dubai, U.A.E</Text>
          <Text>0585073998</Text>
          <Text>mossdekk.dubai@gmail.com</Text>
        </Box>
        <Box textAlign="right">
          <Heading as="h1" size="xl" mb={2} textTransform="uppercase">Tax Invoice</Heading>
          <Text fontSize="md"># {id}</Text>
          <Box mt={6}>
            <Text fontSize="sm" color="gray.500">Total Amount</Text>
            <Heading as="h2" size="lg" mt={1}>AED{totalAmount ? totalAmount.toFixed(2) : total.toFixed(2)}</Heading>
          </Box>
        </Box>
      </Flex>

      <Flex justify="space-between" mb={10}>
        <Box>
          <Text color="gray.500">Bill To</Text>
          <Text fontWeight="bold">{userDetails?.fullName}</Text>
        </Box>
        <Box textAlign="right">
          <Flex justify="flex-end"><Text color="gray.500" w="100px" textAlign="left">Invoice Date:</Text><Text w="120px" textAlign="left">{new Date().toLocaleDateString()}</Text></Flex>
          <Flex justify="flex-end"><Text color="gray.500" w="100px" textAlign="left">Terms:</Text><Text w="120px" textAlign="left">Due on Receipt</Text></Flex>
          <Flex justify="flex-end"><Text color="gray.500" w="100px" textAlign="left">Due Date:</Text><Text w="120px" textAlign="left">{new Date().toLocaleDateString()}</Text></Flex>
        </Box>
      </Flex>

      <Box mb={10}>
        <Text color="gray.500">Subject</Text>
        <Text fontWeight="bold">Car Wash Service</Text>
      </Box>

      <Table variant="simple" mb={10}>
        <Thead bg="gray.800">
          <Tr>
            <Th color="white">#</Th>
            <Th color="white">Item & Description</Th>
            <Th color="white" isNumeric>Qty</Th>
            <Th color="white" isNumeric>Rate</Th>
            <Th color="white" isNumeric>Amount</Th>
          </Tr>
        </Thead>
        <Tbody>
          <Tr>
            <Td>1</Td>
            <Td>
              <Text fontWeight="bold">{serviceDetails?.name}</Text>
              <Text fontSize="sm" color="gray.500">Date: {selectedDate} Time: {selectedTime}</Text>
              {vehicle?.company && (
                <Text fontSize="xs" color="gray.500">Vehicle: {vehicle.company} {vehicle.model} ({vehicle.modelYear}) - {vehicle.color} | Plate: {vehicle.plateNumberPart1}-{vehicle.plateNumberPart2}</Text>
              )}
            </Td>
            <Td isNumeric>1.00</Td>
            <Td isNumeric>{subTotal.toFixed(2)}</Td>
            <Td isNumeric>{subTotal.toFixed(2)}</Td>
          </Tr>
          {addons?.filter(addon => addon && addon.name).map((addon, index) => (
            <Tr key={addon.id}>
              <Td>{index + 2}</Td>
              <Td>
                <Text fontWeight="bold">{addon.name}</Text>
              </Td>
              <Td isNumeric>1.00</Td>
              <Td isNumeric>{(addon.price || 0).toFixed(2)}</Td>
              <Td isNumeric>{(addon.price || 0).toFixed(2)}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Flex justify="flex-end" mb={10}>
        <Box width="300px">
          <Flex justify="space-between" mb={2}>
            <Text color="gray.500">Sub Total</Text>
            <Text>{subTotal.toFixed(2)}</Text>
          </Flex>
          <Flex justify="space-between" mb={2}>
            <Text color="gray.500">VAT 5%</Text>
            <Text>{vat.toFixed(2)}</Text>
          </Flex>
          <Flex justify="space-between" fontWeight="bold" fontSize="lg" mt={2} pt={2} borderTop="1px solid black">
            <Text>Total</Text>
            <Text>AED {total.toFixed(2)}</Text>
          </Flex>
        </Box>
      </Flex>

      <Box mb={10}>
        <Text color="gray.500">Notes</Text>
        <Text>Thanks for your business.</Text>
      </Box>

      <Flex justify="space-between" align="flex-end">
        <Box position="relative" width="250px" height="180px">
            <Image src={stampImage} alt="Stamp" position="absolute" top="0" left="0" width="250px" height="200px" objectFit="contain" zIndex="1" opacity="0.7" />
               </Box>
        <Text fontSize="xs" color="gray.500">Page 1 of 1</Text>
      </Flex>
    </Box>
  );
};

export default InvoiceTemplate;
