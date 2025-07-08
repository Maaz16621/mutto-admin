import React, { useState, useEffect } from "react";
// Chakra imports
import {
  Box,
  Flex,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Icon,
  Link,
  Switch,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";

// Assets
import signInImage from "assets/img/signInImage.png";
import { auth, db, firestore, DATABASE_URL } from "../../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ref, get } from "firebase/database";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { collection, doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useToast } from "@chakra-ui/react";

function SignIn() {
  // Chakra color mode
  const textColor = useColorModeValue("gray.700", "white");
  const bgForm = useColorModeValue("white", "navy.800");
  const titleColor = useColorModeValue("gray.700", "#FF7D2E");

  // State for form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const history = useHistory();

  // On mount, redirect to dashboard if already logged in
  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      history.push("/admin/dashboard");
    }
  }, [history]);
  const toast = useToast();

  // Handle sign in
  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      // Try both possible staff doc IDs: uid and uid-auth
      let staffDocRef = doc(firestore, "staff", user.uid);
      let staffSnap = await getDoc(staffDocRef);
      if (!staffSnap.exists()) {
        staffDocRef = doc(firestore, "staff", `uid-${user.uid}`);
        staffSnap = await getDoc(staffDocRef);
      }
      if (!staffSnap.exists()) {
        toast({ title: "Account not found in staff collection.", status: "error", duration: 5000, isClosable: true, position: "top-right" });
        setLoading(false);
        return;
      }
      // Update lastLogin timestamp
      await updateDoc(staffDocRef, { lastLogin: serverTimestamp() });
      // Save session (localStorage or context, here localStorage for demo)
      localStorage.setItem("user", JSON.stringify({ uid: user.uid, email: user.email, role: staffSnap.data().role }));
      toast({ title: "Login successful!", status: "success", duration: 3000, isClosable: true, position: "top-right" });
      history.push("/admin/dashboard");
    } catch (err) {
      let msg = "Login failed";
      // Only show 'Account not found.' for user-not-found or invalid-credential with NO user
      if (err.code === "auth/user-not-found" || (err.message && err.message.includes("user-not-found"))) {
        msg = "Account not found.";
      } else if (err.code === "auth/wrong-password") {
        msg = "Incorrect password.";
      } else if (err.code === "auth/invalid-credential" || (err.message && err.message.includes("invalid-credential"))) {
        // If the error is invalid-credential but the email is correct, show incorrect password
        msg = "Incorrect password.";
      } else if (err.code === "auth/invalid-email") msg = "Invalid email address.";
      else if (err.code === "auth/user-disabled") msg = "Account is disabled.";
      else if (err.code) msg = `Firebase: ${err.code}`;
      else if (err.message) msg = err.message;
      toast({ title: msg, description: err.message, status: "error", duration: 5000, isClosable: true, position: "top-right" });
      setLoading(false);
    }
  };

  return (
    <Flex minH="100vh" w="100vw" align="center" justify="center" bgImage={signInImage} position="relative">
      <Box
        zIndex="2"
        w={{ base: "90vw", sm: "400px" }}
        background="whiteAlpha.900"
        borderRadius="15px"
        p={{ base: "24px", sm: "40px" }}
        boxShadow={useColorModeValue("0px 5px 14px rgba(0, 0, 0, 0.05)", "unset")}
        display="flex"
        flexDirection="column"
        alignItems="center"
      >
        <Text fontSize="2xl" color={titleColor} fontWeight="bold" mb="24px" textAlign="center">
          Sign In
        </Text>
        <form style={{ width: "100%" }} onSubmit={handleSignIn}>
          <FormControl isRequired mb="4">
            <FormLabel ms="4px" fontSize="sm" fontWeight="normal">
              Email
            </FormLabel>
            <Input
              variant="auth"
              fontSize="sm"
              ms="4px"
              type="email"
              placeholder="Your email address"
              mb="24px"
              size="lg"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
            />
            <FormLabel ms="4px" fontSize="sm" fontWeight="normal">
              Password
            </FormLabel>
            <Input
              variant="auth"
              fontSize="sm"
              ms="4px"
              type="password"
              placeholder="Your password"
              mb="24px"
              size="lg"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <FormControl display="flex" alignItems="center" mb="24px">
              <Switch id="remember-login" colorScheme="orange" me="10px" />
              <FormLabel htmlFor="remember-login" mb="0" fontWeight="normal">
                Remember me
              </FormLabel>
            </FormControl>
            {/* No error alert, only toast */}
            <Button
              fontSize="md"
              variant="dark"
              fontWeight="bold"
              w="100%"
              h="45px"
              mb="8px"
              colorScheme="orange"
              type="submit"
              isLoading={loading}
            >
              Sign In
            </Button>
          </FormControl>
        </form>
      </Box>
      <Box
        position="absolute"
        top="0"
        left="0"
        w="100%"
        h="100%"
        bg="#FF7D2E"
        opacity="0.8"
        zIndex="1"
      />
    </Flex>
  );
}

export default SignIn;
