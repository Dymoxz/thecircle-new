import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { setupDeviceKey } from "../services/keys.service";
import { useRef } from "react";

const RequireAuth = ({ children }) => {
  const setupCalled = useRef(false);
  const token = localStorage.getItem("jwt_token");

  if (!token) return <Navigate to="/login" replace />;

  try {
    const { exp } = jwtDecode(token);
    if (Date.now() >= exp * 1000) {
      console.log("expired");
      // Token expired
      return <Navigate to="/login" replace />;
    }
  } catch (e) {
    console.log("invalid token");
    // Invalid token format
    return <Navigate to="/login" replace />;
  }

  if (!setupCalled.current) {
    setupDeviceKey();
    setupCalled.current = true;
  }

  return children;
};

export default RequireAuth;
