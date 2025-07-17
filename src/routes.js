// import

import React, { Component }  from 'react';
import Dashboard from "views/Dashboard/Dashboard.js";
import Profile from "views/Dashboard/Profile.js";
import SignIn from "views/Pages/SignIn.js";
import ResetPassword from "views/Pages/ResetPassword.js";

import StaffManagement from "views/Dashboard/StaffManagement.js";
import CategoryManager from "views/Dashboard/CategoryManager.js";
import ServiceManager from "views/Dashboard/ServiceManager.js";
import ProductManager from "views/Dashboard/ProductManager.js";
import CouponManager from "views/Dashboard/CouponManager.js";
import DiscountManager from "views/Dashboard/DiscountManager.js";
import Settings from "views/Dashboard/Settings.js"; // Import the new Settings component
import AdsManager from "views/Dashboard/AdsManager.js";
import SubCategoryManager from "views/Dashboard/SubCategoryManager.js";
import Feedback from "views/Dashboard/Feedback.js";

import {
  HomeIcon,
  StatsIcon,
  CreditIcon,
  PersonIcon,
  DocumentIcon,
  RocketIcon,
  SupportIcon,
  SettingsIcon, // Import SettingsIcon
  
} from "components/Icons/Icons";
import {  IoCube, IoDocument, IoDocumentOutline, IoPeople } from 'react-icons/io5';
import { FaBullhorn, FaPercentage } from 'react-icons/fa';
import { RiSpeaker3Line } from 'react-icons/ri';

var dashRoutes = [

  {
    path: "/dashboard",
    name: "Dashboard",
    // rtlName removed
    icon: <HomeIcon color='inherit' />,
    component: Dashboard,
    layout: "/admin",
    permission: "dashboard", // Assuming a general dashboard permission
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
    permission: "profile", // Assuming a profile permission
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
    path: "/reset-password",
    name: "Reset Password",
    icon: <PersonIcon color='inherit' />,
    component: ResetPassword,
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
    permission: "staff-management",
  },
  {
    path: "/category-manager",
    name: "Category Manager",
    icon: <IoDocumentOutline color='inherit' />,
    component: CategoryManager,
    layout: "/admin",
    permission: "category-manager",
  },
    {
    path: "/sub-category-manager",
    name: "Sub-Category Manager",
    icon: <IoDocument color='inherit' />,
    component: SubCategoryManager,
    layout: "/admin",
    permission: "sub-category-manager",
  },
  {
    path: "/service-manager",
    name: "Service Manager",
    icon: <RocketIcon color='inherit' />,
    component: ServiceManager,
    layout: "/admin",
    permission: "service-manager",
  },
  {
    path: "/product-library",
    name: "Addon Products",
     icon: <IoCube color='inherit' />,
    component: ProductManager,
    layout: "/admin",
    permission: "product-library",
  },
  {
    path: "/coupon-manager",
    name: "Coupon Management",
    icon: <CreditIcon color='inherit' />,
    component: CouponManager,
    layout: "/admin",
    permission: "coupon-manager",
  },
  {
    path: "/discount-manager",
    name: "Discount Management",
    icon: <FaPercentage color='inherit' />,
    component: DiscountManager,
    layout: "/admin",
    permission: "discount-manager",
  },
  {
    path: "/worker-management",
    name: "Worker Management",
    icon: <IoPeople color='inherit' />,
    component: require("views/Dashboard/WorkerManagement.js").default,
    layout: "/admin",
    permission: "worker-management",
  },

  {
    path: "/ads-manager",
    name: "Ads Manager",
    icon: <FaBullhorn color='inherit' />,
    component: AdsManager,
    layout: "/admin",
    permission: "ads-manager",
  },


  {
    path: "/feedback",
    name: "Feedback",
    icon: <RiSpeaker3Line color='inherit' />,
    component: Feedback,
    layout: "/admin",
    permission: "feedback",
  },
      {
    path: "/settings",
    name: "Settings",
    icon: <SettingsIcon color='inherit' />,
    component: Settings,
    layout: "/admin",
    permission: "settings",
  },
];
export default dashRoutes;
