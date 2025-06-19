import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

const useAuth = () => {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const isAuthenticated = !!token;

  useEffect(() => {
    // This effect listens for changes in localStorage and updates the token state
    const syncToken = () => setToken(localStorage.getItem("token"));
    window.addEventListener("storage", syncToken);

    // Clean up the listener when component unmounts
    return () => window.removeEventListener("storage", syncToken);
  }, []);

  const login = (token) => {
    localStorage.setItem("token", token);  // Save token to localStorage
    setToken(token);  // Update state to trigger re-render
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);  // Remove token from state to trigger re-render
    window.location.reload();  // Reload the page to clear any user-specific data
  };

  const getUser = () => {
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch (e) {
      console.error("Invalid token:", e);
      return null;
    }
  };

  return { isAuthenticated, login, logout, getUser };
};

export default useAuth;
