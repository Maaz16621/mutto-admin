import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  FormControl,
  FormLabel,
  useToast,
  Spinner,
  Select,
  Tag,
  TagLabel,
  TagCloseButton,
  SimpleGrid,
  Text,
  Checkbox,
} from "@chakra-ui/react";
import Card from "components/Card/Card.js";
import CardHeader from "components/Card/CardHeader.js";
import CardBody from "components/Card/CardBody";
import { firestore } from "../../firebase";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

export default function Settings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [addingOffDate, setAddingOffDate] = useState(false);
  const [addingOffDateRange, setAddingOffDateRange] = useState(false);
  const [addingSpecialHours, setAddingSpecialHours] = useState(false);
  const [removingSpecialHours, setRemovingSpecialHours] = useState(false);
  const [removingOffDate, setRemovingOffDate] = useState(false);
  const [removingOffDateId, setRemovingOffDateId] = useState(null);
  const [removingSpecialHoursId, setRemovingSpecialHoursId] = useState(null);
  const [currency, setCurrency] = useState("USD");
  const [offDates, setOffDates] = useState([]);
  const [newOffDate, setNewOffDate] = useState("");
  const [newOffDateRangeStart, setNewOffDateRangeStart] = useState("");
  const [newOffDateRangeEnd, setNewOffDateRangeEnd] = useState("");
  const [dailyWorkingHours, setDailyWorkingHours] = useState({
    monday: { start: "09:00", end: "17:00", enabled: true },
    tuesday: { start: "09:00", end: "17:00", enabled: true },
    wednesday: { start: "09:00", end: "17:00", enabled: true },
    thursday: { start: "09:00", end: "17:00", enabled: true },
    friday: { start: "09:00", end: "17:00", enabled: true },
    saturday: { start: "00:00", end: "00:00", enabled: false },
    sunday: { start: "00:00", end: "00:00", enabled: false },
  });
  const [specialWorkingHours, setSpecialWorkingHours] = useState([]);
  const [newSpecialDate, setNewSpecialDate] = useState("");
  const [newSpecialStartTime, setNewSpecialStartTime] = useState("09:00");
  const [newSpecialEndTime, setNewSpecialEndTime] = useState("17:00");

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const settingsDocRef = doc(firestore, "settings", "appSettings");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCurrency(data.currency || "USD");
          setOffDates(data.offDates || []);
          setDailyWorkingHours(data.dailyWorkingHours || {
            monday: { start: "09:00", end: "17:00", enabled: true },
            tuesday: { start: "09:00", end: "17:00", enabled: true },
            wednesday: { start: "09:00", end: "17:00", enabled: true },
            thursday: { start: "09:00", end: "17:00", enabled: true },
            friday: { start: "09:00", end: "17:00", enabled: true },
            saturday: { start: "00:00", end: "00:00", enabled: false },
            sunday: { start: "00:00", end: "00:00", enabled: false },
          });
          setSpecialWorkingHours(data.specialWorkingHours || []);
        }
      } catch (error) {
        toast({ title: "Error fetching settings", description: error.message, status: "error" });
      }
      setLoading(false);
    };
    fetchSettings();
  }, [toast]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const settingsDocRef = doc(firestore, "settings", "appSettings");
      await setDoc(settingsDocRef, { currency, offDates, dailyWorkingHours, specialWorkingHours }, { merge: true });
      toast({ title: "Settings saved successfully", status: "success" });
    } catch (error) {
      toast({ title: "Error saving settings", description: error.message, status: "error" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddOffDate = async () => {
    if (newOffDate) {
      setAddingOffDate(true);
      try {
        const settingsDocRef = doc(firestore, "settings", "appSettings");
        await setDoc(settingsDocRef, { offDates: arrayUnion(newOffDate) }, { merge: true });
        setOffDates((prev) => [...prev, newOffDate]);
        setNewOffDate("");
        toast({ title: "Off date added", status: "success" });
      } catch (error) {
        toast({ title: "Error adding off date", description: error.message, status: "error" });
      } finally {
        setAddingOffDate(false);
      }
    }
  };

  const handleAddOffDateRange = async () => {
    if (newOffDateRangeStart && newOffDateRangeEnd) {
      setAddingOffDateRange(true);
      const dates = [];
      let currentDate = new Date(newOffDateRangeStart);
      let endDate = new Date(newOffDateRangeEnd);

      while (currentDate <= endDate) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      try {
        const settingsDocRef = doc(firestore, "settings", "appSettings");
        await setDoc(settingsDocRef, { offDates: arrayUnion(...dates) }, { merge: true });
        setOffDates((prev) => [...prev, ...dates]);
        setNewOffDateRangeStart("");
        setNewOffDateRangeEnd("");
        toast({ title: "Off date range added", status: "success" });
      } catch (error) {
        toast({ title: "Error adding off date range", description: error.message, status: "error" });
      } finally {
        setAddingOffDateRange(false);
      }
    }
  };

  const handleAddSpecialWorkingHours = async () => {
    if (newSpecialDate && newSpecialStartTime && newSpecialEndTime) {
      setAddingSpecialHours(true);
      try {
        const settingsDocRef = doc(firestore, "settings", "appSettings");
        const newEntry = { date: newSpecialDate, start: newSpecialStartTime, end: newSpecialEndTime };
        await setDoc(settingsDocRef, { specialWorkingHours: arrayUnion(newEntry) }, { merge: true });
        setSpecialWorkingHours((prev) => [...prev, newEntry]);
        setNewSpecialDate("");
        setNewSpecialStartTime("09:00");
        setNewSpecialEndTime("17:00");
        toast({ title: "Special working hours added", status: "success" });
      } catch (error) {
        toast({ title: "Error adding special working hours", description: error.message, status: "error" });
      } finally {
        setAddingSpecialHours(false);
      }
    }
  };

  const handleRemoveSpecialWorkingHours = async (dateToRemove) => {
    setRemovingSpecialHoursId(dateToRemove);
    try {
      const settingsDocRef = doc(firestore, "settings", "appSettings");
      // To remove an item from an array in Firestore, you need to provide the exact item.
      // Since we are storing objects, we need to find the object to remove.
      const itemToRemove = specialWorkingHours.find(item => item.date === dateToRemove);
      if (itemToRemove) {
        await setDoc(settingsDocRef, { specialWorkingHours: arrayRemove(itemToRemove) }, { merge: true });
        setSpecialWorkingHours((prev) => prev.filter((item) => item.date !== dateToRemove));
        toast({ title: "Special working hours removed", status: "success" });
      }
    } catch (error) {
      toast({ title: "Error removing special working hours", description: error.message, status: "error" });
    } finally {
      setRemovingSpecialHoursId(null);
    }
  };

  const handleRemoveOffDate = async (dateToRemove) => {
    setRemovingOffDateId(dateToRemove);
    try {
      const settingsDocRef = doc(firestore, "settings", "appSettings");
      await setDoc(settingsDocRef, { offDates: arrayRemove(dateToRemove) }, { merge: true });
      setOffDates((prev) => prev.filter((date) => date !== dateToRemove));
      toast({ title: "Off date removed", status: "success" });
    } catch (error) {
      toast({ title: "Error removing off date", description: error.message, status: "error" });
    } finally {
      setRemovingOffDateId(null);
    }
  };

  return (
    <Flex direction="column" pt={{ base: "120px", md: "75px" }}>
      <Card>
        <CardHeader p="6px 0px 22px 0px">
          <Heading size="md">Application Settings</Heading>
        </CardHeader>
        <CardBody>
          {loading ? (
            <Flex justify="center" align="center" minH="100px">
              <Spinner size="lg" />
            </Flex>
          ) : (
            <>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl>
                <FormLabel>Default Currency</FormLabel>
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="USD">USD - United States Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="AED">AED - United Arab Emirates Dirham</option>
                </Select>
              </FormControl>

              <Box>
                <FormControl mb={2}>
                  <FormLabel>Add Specific Off Date</FormLabel>
                  <Flex>
                    <Input
                      type="date"
                      value={newOffDate}
                      onChange={(e) => setNewOffDate(e.target.value)}
                      mr={2}
                    />
                    <Button onClick={handleAddOffDate} colorScheme="orange" isLoading={addingOffDate}>Add</Button>
                  </Flex>
                </FormControl>
                <Box mt={4}>
                  <FormLabel>Current Off Dates</FormLabel>
                  <Flex wrap="wrap" gap={2}>
                    {offDates.map((date) => (
                      <Tag size="md" key={date} borderRadius="full" variant="solid" colorScheme="red">
                        <TagLabel>{date}</TagLabel>
                        <TagCloseButton
                          onClick={() => handleRemoveOffDate(date)}
                          isDisabled={removingOffDateId === date}
                        />
                      </Tag>
                    ))}
                  </Flex>
                </Box>
              </Box>
            </SimpleGrid>
            <Box mt={4}>
              <Heading size="sm" mb={2}>Add Off Date Range</Heading>
              <FormControl>
                <Flex gap={2}>
                  <Input
                    type="date"
                    value={newOffDateRangeStart}
                    onChange={(e) => setNewOffDateRangeStart(e.target.value)}
                    flex={1}
                    flexShrink={1}
                  />
                  <Text>to</Text>
                  <Input
                    type="date"
                    value={newOffDateRangeEnd}
                    onChange={(e) => setNewOffDateRangeEnd(e.target.value)}
                    flex={1}
                    flexShrink={1}
                  />
                  <Button onClick={handleAddOffDateRange} colorScheme="orange" minWidth="120px" flexShrink={0} isLoading={addingOffDateRange}>Add Range</Button>
                </Flex>
              </FormControl>
            </Box>
            <Box mt={8}>
              <Heading size="md" mb={4}>Working Hours</Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {Object.entries(dailyWorkingHours).map(([day, hours]) => (
                  <FormControl key={day} display="flex" alignItems="center">
                    <FormLabel htmlFor={day} mb="0" minW="100px" textTransform="capitalize">
                      {day}
                    </FormLabel>
                    <Input
                      type="time"
                      value={hours.start}
                      onChange={(e) =>
                        setDailyWorkingHours({
                          ...dailyWorkingHours,
                          [day]: { ...hours, start: e.target.value },
                        })
                      }
                      isDisabled={!hours.enabled}
                      mr={2}
                    />
                    <Text mr={2}>-</Text>
                    <Input
                      type="time"
                      value={hours.end}
                      onChange={(e) =>
                        setDailyWorkingHours({
                          ...dailyWorkingHours,
                          [day]: { ...hours, end: e.target.value },
                        })
                      }
                      isDisabled={!hours.enabled}
                      mr={2}
                    />
                    <Checkbox
                      id={day}
                      isChecked={hours.enabled}
                      onChange={(e) =>
                        setDailyWorkingHours({
                          ...dailyWorkingHours,
                          [day]: { ...hours, enabled: e.target.checked },
                        })
                      }
                    >Enable</Checkbox>
                  </FormControl>
                ))}
              </SimpleGrid>
            </Box>
            <Box mt={8}>
              <Heading size="md" mb={4}>Special Date Working Hours</Heading>
              <FormControl mb={2}>
                <FormLabel>Add Special Date Hours</FormLabel>
                <Flex>
                  <Input
                    type="date"
                    value={newSpecialDate}
                    onChange={(e) => setNewSpecialDate(e.target.value)}
                    mr={2}
                  />
                  <Input
                    type="time"
                    value={newSpecialStartTime}
                    onChange={(e) => setNewSpecialStartTime(e.target.value)}
                    mr={2}
                  />
                  <Text mr={2}>-</Text>
                  <Input
                    type="time"
                    value={newSpecialEndTime}
                    onChange={(e) => setNewSpecialEndTime(e.target.value)}
                    mr={2}
                  />
                  <Button onClick={handleAddSpecialWorkingHours} colorScheme="orange" isLoading={addingSpecialHours}>Add</Button>
                </Flex>
              </FormControl>
              <Box mt={4}>
                <FormLabel>Current Special Working Hours</FormLabel>
                <Flex wrap="wrap" gap={2}>
                  {specialWorkingHours.map((item, index) => (
                    <Tag size="md" key={index} borderRadius="full" variant="solid" colorScheme="purple">
                      <TagLabel>{item.date}: {item.start} - {item.end}</TagLabel>
                      <TagCloseButton
                        onClick={() => handleRemoveSpecialWorkingHours(item.date)}
                        isDisabled={removingSpecialHoursId === item.date}
                      />
                    </Tag>
                  ))}
                </Flex>
              </Box>
            </Box>
            </>
          )}
          <Button mt={8} colorScheme="blue" onClick={handleSaveSettings} isLoading={savingSettings} size="lg">
            Save All Settings
          </Button>
        </CardBody>
      </Card>
    </Flex>
  );
}
