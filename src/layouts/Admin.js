
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



  const hasPermission = React.useCallback((route, permissions) => {
    const currentPermissions = Array.isArray(permissions) ? permissions : [];
    if (!route.permission) {
      return true;
    }
    return currentPermissions.includes(route.permission);
  }, []);

  useEffect(() => {
    const fetchPermissionsAndHandleRedirect = async () => {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user || !user.uid) {
        history.push("/auth/signin");
        return;
      }

      try {
        const staffDocRef = doc(firestore, "staff", user.uid);
        const staffDocSnap = await getDoc(staffDocRef);

        let fetchedPermissions = [];
        if (staffDocSnap.exists()) {
          const staffData = staffDocSnap.data();
          fetchedPermissions = staffData.permissions || [];
        }
        setUserPermissions(fetchedPermissions);

        const filteredRoutes = routes.filter(route => hasPermission(route, fetchedPermissions));
        setAccessibleRoutes(filteredRoutes);

        setLoadingPermissions(false);

        const currentPath = history.location.pathname;
        const isCurrentPathAccessible = filteredRoutes.some(
          (route) => route.layout + route.path === currentPath
        );

        if (currentPath === "/admin" || !isCurrentPathAccessible) {
          const firstAccessibleRoute = filteredRoutes.find(
            (route) => route.layout === "/admin" && route.path
          );
          if (firstAccessibleRoute) {
            history.push(firstAccessibleRoute.layout + firstAccessibleRoute.path);
          } else {
            history.push("/auth/signin");
          }
        }
      } catch (error) {
        console.error("Error fetching staff permissions:", error);
        history.push("/auth/signin");
      }
    };

    fetchPermissionsAndHandleRedirect();
  }, [history]); // Removed hasPermission from dependency array

  const getRoute = () => {
    return window.location.pathname !== "/admin/full-screen-maps";
  };

  const getActiveRoute = (routesList) => {
    let activeRoute = "Default Brand Text";
    for (let i = 0; i < routesList.length; i++) {
      if (routesList[i].collapse) {
        let collapseActiveRoute = getActiveRoute(routesList[i].views);
        if (collapseActiveRoute !== activeRoute) {
          return collapseActiveRoute;
        }
      } else if (routesList[i].category) {
        let categoryActiveRoute = getActiveRoute(routesList[i].views);
        if (categoryActiveRoute !== activeRoute) {
          return categoryActiveRoute;
        }
      } else {
        if (
          window.location.href.indexOf(routesList[i].layout + routesList[i].path) !== -1
        ) {
          return routesList[i].name;
        }
      }
    }
    return activeRoute;
  };

  const getActiveNavbar = (routesList) => {
    let activeNavbar = false;
    for (let i = 0; i < routesList.length; i++) {
      if (routesList[i].category) {
        let categoryActiveNavbar = getActiveNavbar(routesList[i].views);
        if (categoryActiveNavbar !== activeNavbar) {
          return categoryActiveNavbar;
        }
      } else {
        if (
          window.location.href.indexOf(routesList[i].layout + routesList[i].path) !== -1
        ) {
          if (routesList[i].secondaryNavbar) {
            return routesList[i].secondaryNavbar;
          }
        }
      }
    }
    return activeNavbar;
  };

  const getRoutes = (routesList) => {
    if (!Array.isArray(routesList)) {
      return [];
    }
    return routesList.map((prop, key) => {
      if (prop.collapse) {
        return getRoutes(Array.isArray(prop.views) ? prop.views : []);
      }
      if (prop.category === "account") {
        return getRoutes(Array.isArray(prop.views) ? prop.views : []);
      }
      if (prop.layout === "/admin") {
        if (hasPermission(prop, userPermissions)) { // Pass userPermissions here
          return (
            <Route
              path={prop.layout + prop.path}
              component={prop.component}
              key={key}
            />
          );
        } else {
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
                {getRoutes(accessibleRoutes)}
                {/* No default redirect here, handled by useEffect and getRoutes */}
              </Switch>
            </PanelContainer>
          </PanelContent>
        ) : null}
        <Footer />
     
        
      </MainPanel>
    </Box>
  );
}
