/*eslint-disable*/
import { HamburgerIcon } from "@chakra-ui/icons";
// chakra imports
import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
  Flex,
  Stack,
  useColorMode,
  useColorModeValue,
  useDisclosure
} from "@chakra-ui/react";
import { Text as CText } from "@chakra-ui/react";
import IconBox from "components/Icons/IconBox";
import {
  renderThumbDark,
  renderThumbLight,
  renderTrack,
  renderTrackRTL,
  renderView,
  renderViewRTL
} from "components/Scrollbar/Scrollbar";
import { HSeparator } from "components/Separator/Separator";
import { SidebarHelp } from "components/Sidebar/SidebarHelp";
import React from "react";
import { Scrollbars } from "react-custom-scrollbars";
import { NavLink, useLocation } from "react-router-dom";



// FUNCTIONS

function Sidebar(props) {
  // to check for active links and opened collapses
  let location = useLocation();
  // this is for the rest of the collapses
  const [state, setState] = React.useState({});
  const mainPanel = React.useRef();
  let variantChange = "0.2s linear";
  // verifies if routeName is the one active (in browser input)
  const activeRoute = (routeName) => {
    return location.pathname === routeName ? "active" : "";
  };
  const { colorMode } = useColorMode();
  // this function creates the links and collapses that appear in the sidebar (left menu)
  const { sidebarVariant } = props;
  const createLinks = (routes) => {
    // Chakra Color Mode
    let activeBg = useColorModeValue("white", "navy.700");
    let inactiveBg = useColorModeValue("white", "navy.700");
    let activeColor = useColorModeValue("gray.700", "white");
    let inactiveColor = useColorModeValue("gray.400", "gray.400");
    let sidebarActiveShadow = "0px 7px 11px rgba(0, 0, 0, 0.04)";
    // Only render links, no category headings
    return routes.flatMap((prop, key) => {
      if (prop.redirect || prop.sidebar === false) {
        return [];
      }
      if (prop.category && prop.views) {
        // Just render the links inside, skip the heading
        return createLinks(prop.views);
      }
      return [
        <NavLink to={prop.layout + prop.path} key={key}>
          <Button
            boxSize="initial"
            justifyContent="flex-start"
            alignItems="center"
            boxShadow={activeRoute(prop.layout + prop.path) === "active" ? sidebarActiveShadow : undefined}
            bg={activeRoute(prop.layout + prop.path) === "active" ? activeBg : "transparent"}
            transition={variantChange}
            mb={{
              xl: "6px",
            }}
            mx={{
              xl: "auto",
            }}
            ps={{
              sm: "10px",
              xl: "16px",
            }}
            py="12px"
            borderRadius="15px"
            _hover="none"
            w="100%"
            _active={{
              bg: "inherit",
              transform: "none",
              borderColor: "transparent",
            }}
            _focus={{
              boxShadow: activeRoute(prop.layout + prop.path) === "active" ? "0px 7px 11px rgba(0, 0, 0, 0.04)" : "none",
            }}
          >
            <Flex>
              <IconBox
                bg={activeRoute(prop.layout + prop.path) === "active" ? "#FF7D2E" : inactiveBg}
                color={activeRoute(prop.layout + prop.path) === "active" ? "white" : "#FF7D2E"}
                h="30px"
                w="30px"
                me="12px"
                transition={variantChange}
              >
                {prop.icon}
              </IconBox>
              <CText color={activeRoute(prop.layout + prop.path) === "active" ? activeColor : inactiveColor} my="auto" fontSize="sm" as="span">
                {prop.name}
              </CText>
            </Flex>
          </Button>
        </NavLink>
      ];
    });
  };
  const { logo, routes } = props;

  console.log('Sidebar routes:', routes);

  var links = <>{createLinks(routes)}</>;

  // For mobile sidebar (Drawer), use the same links as desktop
  var mobileLinks = links;
  //  BRAND
  //  Chakra Color Mode
  let sidebarBg = useColorModeValue("white", "navy.800");
  let sidebarRadius = "20px";
  let sidebarMargins = "0px";
  var brand = (
    <Box pt={"25px"} mb="12px">
      {logo}
      <HSeparator my="26px" />
    </Box>
  );

  // SIDEBAR
  return (
    <>
      {/* Desktop Sidebar */}
      <Box ref={mainPanel}>
        <Box display={{ sm: "none", xl: "block" }} position="fixed">
          <Box
            bg={sidebarBg}
            transition={variantChange}
            w="260px"
            maxW="260px"
            ms={{
              sm: "16px",
            }}
            my={{
              sm: "16px",
            }}
            h="calc(100vh - 32px)"
            ps="20px"
            pe="20px"
            m={sidebarMargins}
            filter="drop-shadow(0px 5px 14px rgba(0, 0, 0, 0.05))"
            borderRadius={sidebarRadius}
          >
            <Scrollbars
              autoHide
              renderTrackVertical={
                document.documentElement.dir === "rtl"
                  ? renderTrackRTL
                  : renderTrack
              }
              renderThumbVertical={useColorModeValue(
                renderThumbLight,
                renderThumbDark
              )}
              renderView={
                document.documentElement.dir === "rtl"
                  ? renderViewRTL
                  : renderView
              }
            >
              <Box>{brand}</Box>
              <Stack direction="column" mb="40px">
                <Box>{links}</Box>
              </Stack>
            </Scrollbars>
          </Box>
        </Box>
      </Box>

      {/* Mobile Sidebar (Drawer) */}
      <SidebarResponsive
        logo={logo}
        routes={routes}
        colorMode={colorMode}
        hamburgerColor={sidebarVariant === "opaque" ? "gray.700" : "white"}
      />
    </>
  );
}

// FUNCTIONS

export function SidebarResponsive(props) {
  // to check for active links and opened collapses
  let location = useLocation();
  const { logo, routes, colorMode, hamburgerColor, ...rest } = props;

  // this is for the rest of the collapses
  const [state, setState] = React.useState({});
  const mainPanel = React.useRef();
  // verifies if routeName is the one active (in browser input)
  const activeRoute = (routeName) => {
    return location.pathname === routeName ? "active" : "";
  };
  // Chakra Color Mode
  let activeBg = useColorModeValue("white", "navy.700");
  let inactiveBg = useColorModeValue("white", "navy.700");
  let activeColor = useColorModeValue("gray.700", "white");
  let inactiveColor = useColorModeValue("gray.400", "white");
  let sidebarActiveShadow = useColorModeValue(
    "0px 7px 11px rgba(0, 0, 0, 0.04)",
    "none"
  );
  let sidebarBackgroundColor = useColorModeValue("white", "navy.800");

  // this function creates the links and collapses that appear in the sidebar (left menu)
  const createLinks = (routes) => {
    return routes.map((prop, key) => {
      if (prop.redirect) {
        return null;
      }
      if (prop.category) {
        var st = {};
        st[prop["state"]] = !state[prop.state];
        return (
          <>
            <CText
              color={activeColor}
              fontWeight="bold"
              mb={{
                xl: "6px",
              }}
              mx="auto"
              ps={{
                sm: "10px",
                xl: "16px",
              }}
              py="12px"
            >
              {prop.name}
            </CText>
            {createLinks(prop.views)}
          </>
        );
      }
      return (
        <NavLink to={prop.layout + prop.path} key={key}>
          {activeRoute(prop.layout + prop.path) === "active" ? (
            <Button
              boxSize="initial"
              justifyContent="flex-start"
              alignItems="center"
              bg={activeBg}
              boxShadow={sidebarActiveShadow}
              mb={{
                xl: "6px",
              }}
              mx={{
                xl: "auto",
              }}
              ps={{
                sm: "10px",
                xl: "16px",
              }}
              py="12px"
              borderRadius="15px"
              _hover="none"
              w="100%"
              _active={{
                bg: "inherit",
                transform: "none",
                borderColor: "transparent",
              }}
              _focus={{
                boxShadow: "none",
              }}
            >
              <Flex>
                {typeof prop.icon === "string" ? (
                  <Box as="span" me="12px">{prop.icon}</Box>
                ) : (
                  <IconBox
                    bg="#FF7D2E"
                    color="white"
                    h="30px"
                    w="30px"
                    me="12px"
                  >
                    {prop.icon}
                  </IconBox>
                )}
                <CText color={activeColor} my="auto" fontSize="sm" as="span">
                  {prop.name}
                </CText>
              </Flex>
            </Button>
          ) : (
            <Button
              boxSize="initial"
              justifyContent="flex-start"
              alignItems="center"
              bg="transparent"
              mb={{
                xl: "6px",
              }}
              mx={{
                xl: "auto",
              }}
              py="12px"
              ps={{
                sm: "10px",
                xl: "16px",
              }}
              borderRadius="15px"
              _hover="none"
              w="100%"
              _active={{
                bg: "inherit",
                transform: "none",
                borderColor: "transparent",
              }}
              _focus={{
                boxShadow: "none",
              }}
            >
              <Flex>
                {typeof prop.icon === "string" ? (
                  <Box as="span" me="12px">{prop.icon}</Box>
                ) : (
                  <IconBox
                    bg={inactiveBg}
                    color="#FF7D2E"
                    h="30px"
                    w="30px"
                    me="12px"
                  >
                    {prop.icon}
                  </IconBox>
                )}
                {/* Use Chakra UI Text, not window.Text DOM constructor */}
                <CText color={inactiveColor} my="auto" fontSize="sm" as="span">
                  {prop.name}
                </CText>
              </Flex>
            </Button>
          )}
        </NavLink>
      );
    });
  };

  var links = <>{createLinks(routes)}</>;

  //  BRAND

  var brand = (
    <Box pt={"35px"} mb="8px" display='flex' alignItems='center' justifyContent='center'>
      <img src={require("assets/img/logo.png")} alt="Dashboard Logo" style={{ height: '40px', width: 'auto', display: 'block', margin: '0 auto' }} />
   
    </Box>
  );

  // SIDEBAR
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = React.useRef();
  // Color variables
  return (
    <Flex
      display={{ sm: "flex", xl: "none" }}
      ref={mainPanel}
      alignItems="center"
    >
      <HamburgerIcon
        color={hamburgerColor}
        w="18px"
        h="18px"
        ref={btnRef}
        onClick={onOpen}
      />
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        placement={document.documentElement.dir === "rtl" ? "right" : "left"}
        finalFocusRef={btnRef}
      >
        <DrawerOverlay />
        <DrawerContent
          w="250px"
          maxW="250px"
          ms={{
            sm: "16px",
          }}
          my={{
            sm: "16px",
          }}
          borderRadius="16px"
          bg={sidebarBackgroundColor}
        >
          <DrawerCloseButton
            _focus={{ boxShadow: "none" }}
            _hover={{ boxShadow: "none" }}
          />
          <DrawerBody maxW="250px" px="1rem">
            <Box maxW="100%">
              <Box>{brand}</Box>
              <Stack direction="column" mb="40px">
                <Box>{links}</Box>
              </Stack>
            </Box>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Flex>
  );
}

export default Sidebar;
