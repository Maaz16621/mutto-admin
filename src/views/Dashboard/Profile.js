
// Chakra imports
import {
  Avatar,
  Box,
  Button,
  Flex,
  Grid,
  Icon,
  Text,
  useColorMode,
  useColorModeValue,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  useDisclosure,
  InputGroup
} from "@chakra-ui/react";
// Assets
import ImageArchitect1 from "assets/img/ImageArchitect1.png";
import { getAuth, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { getDatabase, ref, onValue, update } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import React, { useState, useEffect, useRef } from "react";
import { FaPenFancy } from "react-icons/fa";
import { IoDocumentsSharp } from "react-icons/io5";
import Card from "components/Card/Card";
import CardBody from "components/Card/CardBody";
import CardHeader from "components/Card/CardHeader";

function Profile() {
  const { colorMode } = useColorMode();
  const textColor = useColorModeValue("gray.700", "white");
  const bgProfile = useColorModeValue("hsla(0,0%,100%,.8)", "navy.800");
  const borderProfileColor = useColorModeValue("white", "transparent");
  const emailColor = useColorModeValue("gray.400", "gray.300");

  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({});
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [isHovering, setIsHovering] = useState(false);
  const fileInputRef = useRef(null);

  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const { isOpen: isPasswordOpen, onOpen: onPasswordOpen, onClose: onPasswordClose } = useDisclosure();

  const auth = getAuth();
  const db = getDatabase();
  const storage = getStorage();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userRef = ref(db, `users/${currentUser.uid}`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            setUserData(data);
            setMobile(data.mobile || "");
          }
        });
      } else {
        setUser(null);
        setUserData({});
      }
    });
    return () => unsubscribe();
  }, [auth, db]);

  const handleUpdate = () => {
    if (user) {
      const userRef = ref(db, `users/${user.uid}`);
      update(userRef, { mobile: mobile });
      onEditClose();
    }
  };

  const handlePasswordChange = () => {
    if (user && newPassword && currentPassword) {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      reauthenticateWithCredential(user, credential).then(() => {
        updatePassword(user, newPassword).then(() => {
          onPasswordClose();
        }).catch((error) => {
          console.error("Error updating password: ", error);
        });
      }).catch((error) => {
        console.error("Error re-authenticating: ", error);
      });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && user) {
      const profilePicRef = storageRef(storage, `profile_pics/${user.uid}`);
      uploadBytes(profilePicRef, file).then((snapshot) => {
        getDownloadURL(snapshot.ref).then((downloadURL) => {
          const userRef = ref(db, `users/${user.uid}`);
          update(userRef, { profilePic: downloadURL });
        });
      });
    }
  };

  return (
    <Flex direction='column' pt={{ base: "120px", md: "75px", lg: "100px" }}>
      <Flex
        direction={{ sm: "column", md: "row" }}
        mb='24px'
        maxH='330px'
        justifyContent={{ sm: "center", md: "space-between" }}
        align='center'
        backdropFilter='blur(21px)'
        boxShadow='0px 2px 5.5px rgba(0, 0, 0, 0.02)'
        border='1.5px solid'
        borderColor={borderProfileColor}
        bg={bgProfile}
        p='24px'
        borderRadius='20px'>
        <Flex
          align='center'
          mb={{ sm: "10px", md: "0px" }}
          direction={{ sm: "column", md: "row" }}
          w={{ sm: "100%" }}
          textAlign={{ sm: "center", md: "start" }}>
          <Box
            position="relative"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={() => fileInputRef.current.click()}
            cursor="pointer"
          >
            <Avatar
              me={{ md: "22px" }}
              src={userData.profilePic || ImageArchitect1}
              w='80px'
              h='80px'
              borderRadius='50%'
            />
            {isHovering && (
              <Flex
                position="absolute"
                top="0"
                left="0"
                right="0"
                bottom="0"
                bg="rgba(0,0,0,0.5)"
                color="white"
                justifyContent="center"
                alignItems="center"
                borderRadius="50%"
                me={{ md: "22px" }}
              >
                <Text>Upload</Text>
              </Flex>
            )}
            <Input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </Box>
          <Flex direction='column' maxWidth='100%' my={{ sm: "14px" }}>
            <Text
              fontSize={{ sm: "lg", lg: "xl" }}
              color={textColor}
              fontWeight='bold'
              ms={{ sm: "8px", md: "0px" }}>
              {userData.name || "User Name"}
            </Text>
            <Text
              fontSize={{ sm: "sm", md: "md" }}
              color={emailColor}
              fontWeight='semibold'>
              {user ? user.email : "user@example.com"}
            </Text>
          </Flex>
        </Flex>
        <Flex
          direction={{ sm: "column", lg: "row" }}
          w={{ sm: "100%", md: "50%", lg: "auto" }}>
          <Button p='0px' bg='transparent' variant='no-effects' onClick={onEditOpen}>
            <Flex
              align='center'
              w={{ sm: "100%", lg: "135px" }}
              bg={colorMode === "dark" ? "navy.900" : "#fff"}
              borderRadius='8px'
              justifyContent='center'
              py='10px'
              boxShadow='0px 2px 5.5px rgba(0, 0, 0, 0.06)'
              cursor='pointer'>
              <Icon color={textColor} as={FaPenFancy} me='6px' />
              <Text fontSize='xs' color={textColor} fontWeight='bold'>
                EDIT
              </Text>
            </Flex>
          </Button>
          <Button p='0px' bg='transparent' variant='no-effects' onClick={onPasswordOpen}>
            <Flex
              align='center'
              w={{ lg: "135px" }}
              borderRadius='15px'
              justifyContent='center'
              py='10px'
              mx={{ lg: "1rem" }}
              cursor='pointer'>
              <Icon color={textColor} as={IoDocumentsSharp} me='6px' />
              <Text fontSize='xs' color={textColor} fontWeight='bold'>
                CHANGE PASSWORD
              </Text>
            </Flex>
          </Button>
        </Flex>
      </Flex>

      <Grid templateColumns={{ sm: "1fr" }} gap='22px'>
        <Card p='16px'>
          <CardHeader p='12px 5px' mb='12px'>
            <Text fontSize='lg' color={textColor} fontWeight='bold'>
              Profile Information
            </Text>
          </CardHeader>
          <CardBody px='5px'>
            <Flex direction='column'>
              <Flex align='center' mb='18px'>
                <Text
                  fontSize='md'
                  color={textColor}
                  fontWeight='bold'
                  me='10px'>
                  Full Name:{" "}
                </Text>
                <Text fontSize='md' color='gray.400' fontWeight='400'>
                  {userData.name || "N/A"}
                </Text>
              </Flex>
              <Flex align='center' mb='18px'>
                <Text
                  fontSize='md'
                  color={textColor}
                  fontWeight='bold'
                  me='10px'>
                  Mobile:{" "}
                </Text>
                <Text fontSize='md' color='gray.400' fontWeight='400'>
                  {userData.mobile || "N/A"}
                </Text>
              </Flex>
              <Flex align='center' mb='18px'>
                <Text
                  fontSize='md'
                  color={textColor}
                  fontWeight='bold'
                  me='10px'>
                  Email:{" "}
                </Text>
                <Text fontSize='md' color='gray.400' fontWeight='400'>
                  {user ? user.email : "N/A"}
                </Text>
              </Flex>
            </Flex>
          </CardBody>
        </Card>
      </Grid>

      <Modal isOpen={isEditOpen} onClose={onEditClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Profile</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Full Name</FormLabel>
              <Input
                value={userData.name || ""}
                isReadOnly
              />
            </FormControl>
            <FormControl mt={4}>
              <FormLabel>Email</FormLabel>
              <Input
                value={user ? user.email : ""}
                isReadOnly
              />
            </FormControl>
            <FormControl mt={4}>
              <FormLabel>Mobile</FormLabel>
              <Input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme='blue' mr={3} onClick={handleUpdate}>
              Save
            </Button>
            <Button variant='ghost' onClick={onEditClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isPasswordOpen} onClose={onPasswordClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Change Password</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Current Password</FormLabel>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </FormControl>
            <FormControl mt={4}>
              <FormLabel>New Password</FormLabel>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme='blue' mr={3} onClick={handlePasswordChange}>
              Save
            </Button>
            <Button variant='ghost' onClick={onPasswordClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
}

export default Profile;
