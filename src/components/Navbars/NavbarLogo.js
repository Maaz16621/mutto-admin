import React from "react";
import { Image } from "@chakra-ui/react";
import logo from "assets/img/logo.png";

export default function NavbarLogo(props) {
  return (
    <Image src={logo} alt="Logo" height="32px" mx="auto" {...props} />
  );
}
