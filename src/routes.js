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
import ProductCategoryManager from "views/Dashboard/ProductCategoryManager.js";
import ProductSubCategoryManager from "views/Dashboard/ProductSubCategoryManager.js";
import CouponManager from "views/Dashboard/CouponManager.js";
import DiscountManager from "views/Dashboard/DiscountManager.js";
import Settings from "views/Dashboard/Settings.js"; // Import the new Settings component
import AdsManager from "views/Dashboard/AdsManager.js";
import SubCategoryManager from "views/Dashboard/SubCategoryManager.js";
import Feedback from "views/Dashboard/Feedback.js";
import Chat from "views/Dashboard/Chat.js";

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
import {  IoCube, IoDocument, IoDocumentOutline, IoPeople, IoChatbubbles, IoDocumentText, IoBuild, IoTicket, IoLogIn, IoKey, IoConstruct, IoLayers, IoLayersOutline, IoFolder, IoFolderOpen, IoChatboxEllipses } from 'react-icons/io5';
import { FaBullhorn, FaPercentage } from 'react-icons/fa';
import { RiSpeaker3Line } from 'react-icons/ri';

var dashRoutes = [

  {
    path: "/dashboard",
    name: "Dashboard",
    category: "Main",
    // rtlName removed
    icon: <HomeIcon color='inherit' />,
    component: Dashboard,
    layout: "/admin",
    permission: "dashboard", // Assuming a general dashboard permission
  },

  {
    path: "/profile",
    name: "Profile",
    category: "Main",
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
    category: "Auth",
    // rtlName removed
    icon: <IoLogIn color='inherit' />,
    component: SignIn,
    layout: "/auth",
    sidebar: false, // Hide from sidebar
  },
  {
    path: "/reset-password",
    name: "Reset Password",
    category: "Auth",
    icon: <IoKey color='inherit' />,
    component: ResetPassword,
    layout: "/auth",
    sidebar: false, // Hide from sidebar
  },
    {
    path: "/staff-management",
    name: "Staff Management",
    category: "User Management",
    // rtlName removed
    icon: <IoPeople color='inherit' />,
    component: StaffManagement,
    layout: "/admin",
    permission: "staff-management",
  },
  {
    path: "/category-manager",
    name: "Category Manager",
    category: "Product Management",
    icon: <IoLayers color='inherit' />,
    component: CategoryManager,
    layout: "/admin",
    permission: "category-manager",
  },
    {
    path: "/sub-category-manager",
    name: "Sub-Category Manager",
    category: "Product Management",
    icon: <IoLayersOutline color='inherit' />,
    component: SubCategoryManager,
    layout: "/admin",
    permission: "sub-category-manager",
  },
  {
    path: "/service-manager",
    name: "Service Manager",
    category: "Service Management",
    icon: <IoBuild color='inherit' />,
    component: ServiceManager,
    layout: "/admin",
    permission: "service-manager",
  },
  {
    path: "/product-library",
    name: "Addon Products",
    category: "Product Management",
    icon: <IoCube color='inherit' />,
    component: ProductManager,
    layout: "/admin",
    permission: "product-library",
  },
  {
    path: "/product-category-manager",
    name: "Product Categories",
    category: "Product Management",
    icon: <IoFolder color='inherit' />,
    component: ProductCategoryManager,
    layout: "/admin",
    permission: "product-category-manager",
  },
  {
    path: "/product-sub-category-manager",
    name: "Product Sub-Categories",
    category: "Product Management",
    icon: <IoFolderOpen color='inherit' />,
    component: ProductSubCategoryManager,
    layout: "/admin",
    permission: "product-sub-category-manager",
  },
  {
    path: "/coupon-manager",
    name: "Coupon Management",
    category: "Promotions",
    icon: <IoTicket color='inherit' />,
    component: CouponManager,
    layout: "/admin",
    permission: "coupon-manager",
  },
  {
    path: "/discount-manager",
    name: "Discount Management",
    category: "Promotions",
    icon: <FaPercentage color='inherit' />,
    component: DiscountManager,
    layout: "/admin",
    permission: "discount-manager",
  },
  {
    path: "/worker-management",
    name: "Worker Management",
    category: "User Management",
    icon: <IoConstruct color='inherit' />,
    component: require("views/Dashboard/WorkerManagement.js").default,
    layout: "/admin",
    permission: "worker-management",
  },

  {
    path: "/ads-manager",
    name: "Ads Manager",
    category: "Promotions",
    icon: <FaBullhorn color='inherit' />,
    component: AdsManager,
    layout: "/admin",
    permission: "ads-manager",
  },


  {
    path: "/feedback",
    name: "Feedback",
    category: "Main",
    icon: <IoChatboxEllipses color='inherit' />,
    component: Feedback,
    layout: "/admin",
    permission: "feedback",
  },
      {
    path: "/settings",
    name: "Settings",
    category: "Settings",
    icon: <SettingsIcon color='inherit' />,
    component: Settings,
    layout: "/admin",
    permission: "settings",
  },
  {
    path: "/chat",
    name: "Chat",
    category: "Main",
    icon: <IoChatbubbles color='inherit' />,
    component: Chat,
    layout: "/admin",
    permission: "chat",
  },
];
export default dashRoutes;
