import api from "../utils/api";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuth, setIsAuth] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loginUser(email, password, navigate) {
    setBtnLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { email, password });
      toast.success(data.message);
      if (data.token) {
        localStorage.setItem("token", data.token);
      }
      setUser(data.user);
      setIsAuth(true);
      navigate("/app");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Login failed");
    } finally {
      setBtnLoading(false);
    }
  }

  async function registerUser(name, email, password, navigate) {
    setBtnLoading(true);
    try {
      const { data } = await api.post("/api/auth/register", {
        name,
        email,
        password,
      });
      toast.success(data.message);
      if (data.token) {
        localStorage.setItem("token", data.token);
      }
      setUser(data.user);
      setIsAuth(true);
      navigate("/app");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Registration failed");
    } finally {
      setBtnLoading(false);
    }
  }

  async function forgotUser(email, navigate) {
    setBtnLoading(true);
    try {
      const { data } = await api.post("/api/auth/forgot", { email });
      toast.success(data.message);
      navigate("/reset-password/" + data.token);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Request failed");
    } finally {
      setBtnLoading(false);
    }
  }

  async function resetUser(token, otp, password, navigate) {
    setBtnLoading(true);
    try {
      const { data } = await api.post("/api/auth/reset-password/" + token, {
        otp,
        password,
      });
      toast.success(data.message);
      navigate("/login");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Reset failed");
    } finally {
      setBtnLoading(false);
    }
  }

  async function logoutUser(navigate) {
    setBtnLoading(true);
    try {
      await api.post("/api/auth/logout");
      localStorage.removeItem("token");
      localStorage.removeItem("currentWorkspaceId");
      setUser(null);
      setIsAuth(false);
      toast.success("Logged out successfully");
      navigate("/");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Logout failed");
    } finally {
      setBtnLoading(false);
    }
  }

  async function fetchUser() {
    try {
      const { data } = await api.get("/api/auth/me");
      if (data && data._id) {
        setUser(data);
        setIsAuth(true);
      } else {
        setUser(null);
        setIsAuth(false);
      }
    } catch {
      setUser(null);
      setIsAuth(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <UserContext.Provider
      value={{
        loginUser,
        btnLoading,
        isAuth,
        user,
        loading,
        registerUser,
        setIsAuth,
        setUser,
        forgotUser,
        resetUser,
        fetchUser,
        logoutUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const UserData = () => useContext(UserContext);
