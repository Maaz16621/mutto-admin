// Chakra imports
import {
  Box,
  Button,
  Flex,
  HStack,
  Link, Stack, Text, useColorMode, useColorModeValue
} from "@chakra-ui/react";
import {
  DocumentIcon,
  HomeIcon,
  PersonIcon,
  RocketIcon
} from "components/Icons/Icons";
import NavbarLogo from "./NavbarLogo";
import { SidebarResponsive } from "components/Sidebar/Sidebar";
import React from "react";
import { NavLink } from "react-router-dom";
import routes from "routes.js";
export default function AuthNavbar(props) {
  const { logo, logoText, secondary, ...rest } = props;
  const { colorMode } = useColorMode();
  // Chakra color mode
  let mainText = "white";
  let navbarIcon = "white";
  let navbarBg = "none";
  let navbarBorder = "none";
  let navbarShadow = "initial";
  let navbarFilter = "initial";
  let navbarBackdrop = "none";
  let bgButton = useColorModeValue("white", "navy.900");
  let colorButton = useColorModeValue("gray.700", "white");
  let navbarPosition = "absolute";
  let hamburgerColor = {
    base: useColorModeValue("gray.700", "white"),
    md: "white",
  };
  let brand = (
    <Link
      href={`${process.env.PUBLIC_URL}/#/`}
      target="_blank"
      display="flex"
      lineHeight="100%"
      fontWeight="bold"
      justifyContent="center"
      alignItems="center"
      color={mainText}
    >
      <NavbarLogo height="40px" />
      <Text fontSize="sm" mt="3px" ms="10px">
        {logoText}
      </Text>
    </Link>
  );
  hamburgerColor = { base: "white" };
  // Remove all auth links, only logo will be shown
  var linksAuth = null;
  return (
    <Flex
      position={navbarPosition}
      top="16px"
      left="50%"
      transform="translate(-50%, 0px)"
      background={navbarBg}
      border={navbarBorder}
      boxShadow={navbarShadow}
      filter={navbarFilter}
      backdropFilter={navbarBackdrop}
      borderRadius="15px"
      px="16px"
      py="22px"
      mx="auto"
      width="1044px"
      maxW="90%"
      alignItems="center"
      zIndex="3"
      justifyContent="center"
    >
      {brand}
      {/* No auth links or free download button */}
    </Flex>
  );
}
