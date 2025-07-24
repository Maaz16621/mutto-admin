// chakra imports
import { Box, ChakraProvider, Portal } from "@chakra-ui/react";
import Footer from "components/Footer/Footer.js";
// core components
import AuthNavbar from "components/Navbars/AuthNavbar.js";
import React, { useEffect } from "react";
import { Redirect, Route, Switch } from "react-router-dom";
import routes from "routes.js";

import { useHistory } from "react-router-dom";

export default function Pages(props) {
  const { ...rest } = props;
  // ref for the wrapper div
  const wrapper = React.createRef();
  const history = useHistory();
  useEffect(() => {
    document.body.style.overflow = "unset";
    // Redirect to dashboard if already logged in
    const user = localStorage.getItem("user");
    if (user) {
      history.push("/admin/dashboard");
    }
    return function cleanup() {};
  }, [history]);
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
  
  const getRoutes = (routes) => {
    return routes.map((prop, key) => {
      if (prop.collapse) {
        return getRoutes(prop.views);
      }
      if (prop.category === "account") {
        return getRoutes(prop.views);
      }
      if (prop.layout === "/auth") {
        return (
          <Route
            path={prop.layout + prop.path}
            component={prop.component}
            key={key}
          />
        );
      } else {
        return null;
      }
    });
  };
  const navRef = React.useRef();
  document.documentElement.dir = "ltr";
  return (
    <Box ref={navRef} w='100%'>
      <Portal containerRef={navRef}>
     </Portal>
      <Box w='100%'>
        <Box ref={wrapper} w='100%'>
          <Switch>
            {getRoutes(routes)}
            <Redirect from='/auth' to='/auth/signin' />
          </Switch>
        </Box>
      </Box>
    
    </Box>
  );
}
