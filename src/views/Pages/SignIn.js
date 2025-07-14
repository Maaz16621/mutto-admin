import React, { useState, useEffect } from "react";
// Chakra imports
import {
  Box,
  Flex,
  Button,
  FormControl,
  FormLabel,
  Input,
  Switch,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";

// Assets
import signInImage from "assets/img/signInImage.png";
import { auth } from "../../firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { useHistory } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../../firebase";
import { useToast } from "@chakra-ui/react";

function SignIn() {
  // Chakra color mode
  const textColor = useColorModeValue("gray.700", "white");
  const titleColor = useColorModeValue("gray.700", "#FF7D2E");

  // State for form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  const history = useHistory();
  const toast = useToast();

  // On mount, redirect to dashboard if already logged in
  useEffect(() => {
    if (localStorage.getItem("user")) {
      history.push("/admin/dashboard");
    }
  }, [history]);

  // Handle password reset
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Please enter your email address.", status: "warning", duration: 4000, isClosable: true, position: "top-right" });
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: "Password reset email sent!", description: "Check your inbox for further instructions.", status: "success", duration: 5000, isClosable: true, position: "top-right" });
      setIsResetMode(false); // Return to sign-in view
    } catch (err) {
      let msg = "Failed to send reset email.";
      if (err.code === "auth/user-not-found") msg = "No account found with this email.";
      else if (err.code === "auth/invalid-email") msg = "Invalid email address.";
      toast({ title: msg, status: "error", duration: 5000, isClosable: true, position: "top-right" });
    }
    setResetting(false);
  };

  // Handle sign in
  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
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
      await updateDoc(staffDocRef, { lastLogin: serverTimestamp() });
      localStorage.setItem("user", JSON.stringify({ uid: user.uid, email: user.email, role: staffSnap.data().role }));
      toast({ title: "Login successful!", status: "success", duration: 3000, isClosable: true, position: "top-right" });
      history.push("/admin/dashboard");
    } catch (err) {
      let msg = "Login failed";
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        msg = "Incorrect email or password.";
      } else if (err.code === "auth/wrong-password") {
        msg = "Incorrect password.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Invalid email address.";
      } else if (err.code === "auth/user-disabled") {
        msg = "This account has been disabled.";
      }
      toast({ title: msg, status: "error", duration: 5000, isClosable: true, position: "top-right" });
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
          {isResetMode ? "Reset Password" : "Sign In"}
        </Text>
        <form style={{ width: "100%" }} onSubmit={isResetMode ? handlePasswordReset : handleSignIn}>
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
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              isDisabled={loading || resetting}
            />
            {!isResetMode && (
              <>
                <FormLabel ms="4px" fontSize="sm" fontWeight="normal">
                  Password
                </FormLabel>
                <Input
                  variant="auth"
                  fontSize="sm"
                  ms="4px"
                  type="password"
                  placeholder="Your password"
                  mb="8px"
                  size="lg"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  isDisabled={loading || resetting}
                />
              </>
            )}
          </FormControl>
          {!isResetMode && (
            <Flex justify="space-between" align="center" mb="16px">
              <FormControl display="flex" alignItems="center" mb="0">
                <Switch id="remember-login" colorScheme="orange" me="10px" isDisabled={loading || resetting} />
                <FormLabel htmlFor="remember-login" mb="0" fontWeight="normal">
                  Remember me
                </FormLabel>
              </FormControl>
              <Button
                variant="link"
                colorScheme="orange"
                size="sm"
                fontWeight="normal"
                onClick={() => setIsResetMode(true)}
                isDisabled={loading}
              >
                Forgot password?
              </Button>
            </Flex>
          )}
          {isResetMode ? (
            <>
              <Button
                fontSize="md"
                variant="dark"
                fontWeight="bold"
                w="100%"
                h="45px"
                mb="8px"
                colorScheme="orange"
                type="submit"
                isLoading={resetting}
                isDisabled={loading}
              >
                Send Reset Link
              </Button>
              <Button
                variant="link"
                colorScheme="gray"
                size="sm"
                fontWeight="normal"
                w="100%"
                mt="4"
                onClick={() => setIsResetMode(false)}
                isDisabled={resetting}
              >
                Back to Sign In
              </Button>
            </>
          ) : (
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
              isDisabled={resetting}
            >
              Sign In
            </Button>
          )}
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
