
import React, { createContext, useState, useContext, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from './firebase'; // Adjust this import path if needed
import allRoutes from './routes'; // Import all possible routes

const RoutesContext = createContext();

export const useRoutes = () => useContext(RoutesContext);

const filterRoutesByPermissions = (routes, userPermissions) => {
  if (!userPermissions) {
    // If no permissions, return only auth routes or a minimal set
    return routes.filter(route => route.layout === '/auth' || !route.permission);
  }

  return routes.filter(route => {
    // No permission required for this route
    if (!route.permission) return true;
    // Check if user has the required permission
    return userPermissions.includes(route.permission);
  });
};

export const RoutesProvider = ({ children }) => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshRoutes = async () => {
    setLoading(true);
    const user = auth.currentUser;
    if (user) {
      const userDocRef = doc(firestore, 'staff', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userPermissions = userData.permissions || [];
        const accessibleRoutes = filterRoutesByPermissions(allRoutes, userPermissions);
        setRoutes(accessibleRoutes);
      } else {
        // Handle case where user document doesn't exist (e.g., regular user, not staff)
        // You might want to fetch permissions from a 'users' collection or assign default permissions
        setRoutes(filterRoutesByPermissions(allRoutes, null));
      }
    } else {
      // No user logged in, show only public/auth routes
      setRoutes(filterRoutesByPermissions(allRoutes, null));
    }
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      refreshRoutes();
    });
    return () => unsubscribe();
  }, []);

  return (
    <RoutesContext.Provider value={{ routes, loading, refreshRoutes }}>
      {children}
    </RoutesContext.Provider>
  );
};
