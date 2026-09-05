import api from "../utils/api";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
const UserContext = createContext(); 

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState([]);
  const [isAuth, setIsAuth] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);

  const getDashboardPath = (role) => {
    switch (role) {
      case "role1":
        return "/role1";
      case "role2":
        return "/role2";
      case "role3":
        return "/role3";
      case "role4":
        return "/role4";
      default:
        return "/";
    }
  };

  async function loginUser(email, password, navigate) {
    setBtnLoading(true);
    try {
      const { data } = await api.post("/api/user/login", {
        email,
        password,
      });
      toast.success(data.message);
      setUser(data.user);
      setIsAuth(true);
      setBtnLoading(false);
      navigate(getDashboardPath(data.user.role));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Login failed");
      setBtnLoading(false);
    }
  }



  async function forgotUser(email,navigate) {
    setBtnLoading(true);
    try {
      const {data} = await api.post("/api/user/forget", {email});
      toast.success(data.message);
      setBtnLoading(false);
      const token =data.token;
      navigate("/reset-password/"+token);
    
  } catch (error) {
    toast.error(error.response.data.message);
    setBtnLoading(false);
  }
  }

  async function resetUser(token,otp,password,navigate) {
    setBtnLoading(true);
    try {
      const {data} = await api.post("/api/user/reset-password/"+token, {otp,password});
      toast.success(data.message);
      setBtnLoading(false);
      navigate("/login");
    
  } catch (error) {
    toast.error(error.response.data.message);
    setBtnLoading(false);
  }
  }

  async function registerUser(name, email, password, role, navigate) {
    setBtnLoading(true);
    try {
      const { data } = await api.post("/api/user/register", {
        name,
        email,
        password,
        role,
      });
      toast.success(data.message);
      console.log(data);
      const token=data.token
      setBtnLoading(false);
      navigate("/verify/"+token);
      
    } catch (error) {
      toast.error(error?.response?.data?.message || "Registration failed");
      setBtnLoading(false);
    }
  }

  async function verify(token, otp, navigate) {
    setBtnLoading(true);
    try {
      const { data } = await api.post(`/api/user/verifyOtp/${token}`, {
        otp,
      });

      const role = data?.user?.role;

      // Registration completed.
      toast.success(data.message);

      if (role === "role1" || role === "role4") {
        // Auto-login for role1 and role4 after verification.
        setUser(data.user);
        setIsAuth(true);
        setBtnLoading(false);
        navigate(getDashboardPath(role));
        return;
      }

      // If role2 or role3, explicitly inform about admin verification.
      if (role === "role2" || role === "role3") {
        toast.info(
          "Your account is pending admin verification. You cannot login until an admin approves your account."
        );
      }

      setBtnLoading(false);
      // Redirect to login for roles that are not auto-logged-in.
      navigate("/login");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Verification failed");
      setBtnLoading(false);
    }
  }

  async function logoutUser(navigate) {
    setBtnLoading(true);
    try {
      await api.get("/api/user/logout");
      setUser([]);
      setIsAuth(false);
      toast.success("Logged out successfully");
      setBtnLoading(false);
      navigate("/login");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Logout failed");
      setBtnLoading(false);
    }
  }

  const [loading, setLoading] = useState(true);
  async function fetchUser() {
    try {
      const { data } = await api.get("/api/user/me");
      if (data && typeof data === "object" && data._id) {
        setUser(data);
        setIsAuth(true);
      } else {
        setUser(null);
        setIsAuth(false);
      }
    } catch (error) {
      console.log("Error fetching user session:", error);
      setUser(null);
      setIsAuth(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUser();
    return () => {};
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
        verify,
        fetchUser,
        logoutUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

// Custom hook to access the context
export const UserData = () => useContext(UserContext);