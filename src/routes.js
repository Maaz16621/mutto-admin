// import

import React, { Component }  from 'react';
import Dashboard from "views/Dashboard/Dashboard.js";
import Tables from "views/Dashboard/Tables.js";
import Billing from "views/Dashboard/Billing.js";
import RTLPage from "views/RTL/RTLPage.js";
import Profile from "views/Dashboard/Profile.js";
import SignIn from "views/Pages/SignIn.js";
import SignUp from "views/Pages/SignUp.js";

import StaffManagement from "views/Dashboard/StaffManagement.js";
import CategoryManager from "views/Dashboard/CategoryManager.js";
import ServiceManager from "views/Dashboard/ServiceManager.js";


import {
  HomeIcon,
  StatsIcon,
  CreditIcon,
  PersonIcon,
  DocumentIcon,
  RocketIcon,
  SupportIcon,
} from "components/Icons/Icons";
import { IoPeople } from 'react-icons/io5';

var dashRoutes = [

  {
    path: "/dashboard",
    name: "Dashboard",
    // rtlName removed
    icon: <HomeIcon color='inherit' />,
    component: Dashboard,
    layout: "/admin",
  },
  {
    path: "/tables",
    name: "Tables",
    // rtlName removed
    icon: <StatsIcon color='inherit' />,
    component: Tables,
    layout: "/admin",
  },
  {
    path: "/profile",
    name: "Profile",
    // rtlName removed
    icon: <PersonIcon color='inherit' />,
    secondaryNavbar: true,
    component: Profile,
    layout: "/admin",
    sidebar: false, // Hide from sidebar (including mobile)
  },
  // AUTH ROUTES
  {
    path: "/signin",
    name: "Sign In",
    // rtlName removed
    icon: <PersonIcon color='inherit' />,
    component: SignIn,
    layout: "/auth",
    sidebar: false, // Hide from sidebar
  },
    {
    path: "/staff-management",
    name: "Staff Management",
    // rtlName removed
    icon: <IoPeople color='inherit' />,
    component: StaffManagement,
    layout: "/admin",
  },
  {
    path: "/category-manager",
    name: "Category Manager",
    icon: <DocumentIcon color='inherit' />,
    component: CategoryManager,
    layout: "/admin",
  },
  {
    path: "/service-manager",
    name: "Service Manager",
    icon: <RocketIcon color='inherit' />,
    component: ServiceManager,
    layout: "/admin",
  },
];
export default dashRoutes;
