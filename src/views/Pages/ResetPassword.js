import React, { useState, useEffect } from "react";
import {
  Box,
  Flex,
  Button,
  FormControl,
  FormLabel,
  Input,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { useLocation, useHistory } from "react-router-dom";
import { auth } from "../../firebase";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [codeValid, setCodeValid] = useState(false);
  const query = useQuery();
  const history = useHistory();
  const oobCode = query.get("oobCode");
  const bgForm = useColorModeValue("white", "navy.800");
  const titleColor = useColorModeValue("gray.700", "#FF7D2E");

  useEffect(() => {
    if (oobCode) {
      verifyPasswordResetCode(auth, oobCode)
        .then(email => {
          setEmail(email);
          setCodeValid(true);
        })
        .catch(() => {
          setError("Invalid or expired password reset link.");
          setCodeValid(false);
        });
    }
  }, [oobCode]);

  const handleReset = async e => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!newPassword || !confirmPassword) {
      setError("Please enter and confirm your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess("Password has been reset! You can now sign in.");
      setTimeout(() => history.push("/auth/signin"), 2500);
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    }
    setLoading(false);
  };

  return (
    <Flex minH="100vh" w="100vw" align="center" justify="center" bg="#FF7D2E" position="relative">
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
          Reset Password
        </Text>
        {error && <Text color="red.500" mb={2}>{error}</Text>}
        {success && <Text color="green.500" mb={2}>{success}</Text>}
        {codeValid ? (
          <form style={{ width: "100%" }} onSubmit={handleReset}>
            <FormControl isRequired mb="4">
              <FormLabel fontSize="sm">New Password</FormLabel>
              <Input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                mb="16px"
                size="lg"
                isDisabled={loading}
              />
              <FormLabel fontSize="sm">Confirm Password</FormLabel>
              <Input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                mb="24px"
                size="lg"
                isDisabled={loading}
              />
              <Button
                colorScheme="orange"
                w="100%"
                h="45px"
                type="submit"
                isLoading={loading}
                fontWeight="bold"
              >
                Reset Password
              </Button>
            </FormControl>
          </form>
        ) : (
          <Text color="gray.600">Please use a valid password reset link.</Text>
        )}
      </Box>
    </Flex>
  );
}
