
import {
  ArgonLogoDark,
  ArgonLogoLight,
  ChakraLogoDark,
  ChakraLogoLight,
} from "components/Icons/Icons";
// Layout components
import React, { useState, useEffect } from "react";
import { Redirect, Route, Switch, useHistory } from "react-router-dom";
import { Portal, useDisclosure, Box, useColorMode, Spinner, Flex } from "@chakra-ui/react";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../firebase"; // Adjust path as needed

import Configurator from "components/Configurator/Configurator";
import Footer from "components/Footer/Footer.js";
import AdminNavbar from "components/Navbars/AdminNavbar.js";
import Sidebar from "components/Sidebar/Sidebar.js";
import FixedPlugin from "../components/FixedPlugin/FixedPlugin";
import MainPanel from "../components/Layout/MainPanel";
import PanelContainer from "../components/Layout/PanelContainer";
import PanelContent from "../components/Layout/PanelContent";
import routes from "routes.js";
import bgAdmin from "assets/img/admin-background.png";

export default function Dashboard(props) {
  const { ...rest } = props;
  const [fixed, setFixed] = useState(false);
  const { colorMode } = useColorMode();
  const history = useHistory();
  const [userPermissions, setUserPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [accessibleRoutes, setAccessibleRoutes] = useState([]); // Make accessibleRoutes a state variable

  const hasPermission = (route, permissions) => {
    // If a route doesn't require a specific permission, grant access
    if (!route.permission) {
      return true;
    }
    // Check if the user has the required permission
    return permissions.includes(route.permission);
  };

  useEffect(() => {
    const fetchPermissions = async () => {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user || !user.uid) {
        history.push("/auth/signin"); // Redirect to sign-in if no user
        return;
      }

      try {
        const staffDocRef = doc(firestore, "staff", user.uid);
        const staffDocSnap = await getDoc(staffDocRef);

        let fetchedPermissions = [];
        if (staffDocSnap.exists()) {
          const staffData = staffDocSnap.data();
          fetchedPermissions = staffData.permissions || [];
          setUserPermissions(fetchedPermissions);
        } else {
          history.push("/auth/signin");
        }

        // Set accessibleRoutes after permissions are fetched
        setAccessibleRoutes(routes.filter(route => hasPermission(route, fetchedPermissions)));

      } catch (error) {
        console.error("Error fetching staff permissions:", error);
        history.push("/auth/signin"); // Redirect on error
      } finally {
        setLoadingPermissions(false);
      }
    };

    fetchPermissions();
  }, [history]); // Only history in dependency array

  // This useEffect will run after permissions are loaded and accessibleRoutes is updated
  useEffect(() => {
    if (!loadingPermissions && accessibleRoutes.length > 0) { // Ensure permissions are loaded and accessibleRoutes is populated
      const currentPath = history.location.pathname;
      const isCurrentPathAccessible = accessibleRoutes.some(
        (route) => route.layout + route.path === currentPath
      );

      if (currentPath === "/admin" || !isCurrentPathAccessible) {
        const firstAccessibleRoute = accessibleRoutes.find(
          (route) => route.layout === "/admin" && route.path
        );
        if (firstAccessibleRoute) {
          history.push(firstAccessibleRoute.layout + firstAccessibleRoute.path);
        } else {
          history.push("/auth/signin");
        }
      }
    }
  }, [loadingPermissions, accessibleRoutes, history]);

  useEffect(() => {
    if (!loadingPermissions) { // Ensure permissions are loaded
      const currentPath = history.location.pathname;
      const isCurrentPathAccessible = accessibleRoutes.some(
        (route) => route.layout + route.path === currentPath
      );

      if (currentPath === "/admin" || !isCurrentPathAccessible) {
        const firstAccessibleRoute = accessibleRoutes.find(
          (route) => route.layout === "/admin" && route.path
        );
        if (firstAccessibleRoute) {
          history.push(firstAccessibleRoute.layout + firstAccessibleRoute.path);
        } else {
          history.push("/auth/signin");
        }
      }
    }
  }, [loadingPermissions, accessibleRoutes, history]);

  const getRoute = () => {
    return window.location.pathname !== "/admin/full-screen-maps";
  };

  const getActiveRoute = (routes) => {
    let activeRoute = "Default Brand Text";
    for (let i = 0; i < routes.length; i++) {
      if (routes[i].collapse) {
        let collapseActiveRoute = getActiveRoute(routes[i].views);
        if (collapseActiveRoute !== activeRoute) {
          return collapseActiveRoute;
        }
      } else if (routes[i].category) {
        let categoryActiveRoute = getActiveRoute(routes[i].views);
        if (categoryActiveRoute !== activeRoute) {
          return categoryActiveRoute;
        }
      } else {
        if (
          window.location.href.indexOf(routes[i].layout + routes[i].path) !== -1
        ) {
          return routes[i].name;
        }
      }
    }
    return activeRoute;
  };

  const getActiveNavbar = (routes) => {
    let activeNavbar = false;
    for (let i = 0; i < routes.length; i++) {
      if (routes[i].category) {
        let categoryActiveNavbar = getActiveNavbar(routes[i].views);
        if (categoryActiveNavbar !== activeNavbar) {
          return categoryActiveNavbar;
        }
      } else {
        if (
          window.location.href.indexOf(routes[i].layout + routes[i].path) !== -1
        ) {
          if (routes[i].secondaryNavbar) {
            return routes[i].secondaryNavbar;
          }
        }
      }
    }
    return activeNavbar;
  };

  const getRoutes = (routes) => {
    return routes.map((prop, key) => {
      if (prop.collapse) {
        return getRoutes(prop.views);
      }
      if (prop.category === "account") {
        return getRoutes(prop.views);
      }
      if (prop.layout === "/admin") {
        if (hasPermission(prop, userPermissions)) {
          return (
            <Route
              path={prop.layout + prop.path}
              component={prop.component}
              key={key}
            />
          );
        } else {
          // If the route is not accessible, render a redirect to the first accessible route
          const firstAccessibleRoute = accessibleRoutes.find(
            (route) => route.layout === "/admin" && route.path
          );
          return (
            <Route
              path={prop.layout + prop.path}
              render={() => <Redirect to={firstAccessibleRoute ? firstAccessibleRoute.layout + firstAccessibleRoute.path : "/auth/signin"} />}
              key={key}
            />
          );
        }
      } else {
        return null;
      }
    });
  };

  const { isOpen, onOpen, onClose } = useDisclosure();
  document.documentElement.dir = "ltr";

  if (loadingPermissions) {
    return (
      <Flex justify="center" align="center" h="100vh">
        <Spinner size="xl" />
      </Flex>
    );
  }

  return (
    <Box>
      <Box
        minH='40vh'
        w='100%'
        position='absolute'
        bgImage={colorMode === "light" ? bgAdmin : "none"}
        bg={colorMode === "light" ? bgAdmin : "navy.900"}
        bgSize='cover'
        top='0'
      />
      <Sidebar
        routes={accessibleRoutes} // Pass filtered routes to Sidebar
        logo={
          <Box display='flex' alignItems='center' justifyContent='center'>
            <img src={require("assets/img/logo.png")} alt="Dashboard Logo" style={{ height: '40px', width: 'auto' }} />
          </Box>
        }
        display='none'
        {...rest}
      />
      <MainPanel
        w={{
          base: "100%",
          xl: "calc(100% - 275px)",
        }}>
        <Portal>
          <AdminNavbar
            onOpen={onOpen}
            brandText={getActiveRoute(accessibleRoutes)}
            secondary={getActiveNavbar(accessibleRoutes)}
            fixed={fixed}
            {...rest}
          />
        </Portal>
        {getRoute() ? (
          <PanelContent>
            <PanelContainer>
              <Switch>
                {getRoutes(routes)} {/* Use original routes here for routing logic, but permission check inside getRoutes */}
                {/* No default redirect here, handled by useEffect and getRoutes */}
              </Switch>
            </PanelContainer>
          </PanelContent>
        ) : null}
        <Footer />
        <Portal>
          <FixedPlugin
            secondary={getActiveNavbar(accessibleRoutes)}
            fixed={fixed}
            onOpen={onOpen}
          />
        </Portal>
        <Configurator
          secondary={getActiveNavbar(accessibleRoutes)}
          isOpen={isOpen}
          onClose={onClose}
          isChecked={fixed}
          onSwitch={(value) => {
            setFixed(value);
          }}
        />
      </MainPanel>
    </Box>
  );
}
