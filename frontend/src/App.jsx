import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { UserData } from "./context/UserContext";
import { Loading } from "./components/Loading";
import Forgot from "./pages/Forgot";
import Reset from "./pages/Reset";
import OtpVerify from "./pages/OtpVerify";
import Role1Dashboard from "./pages/Role1Dashboard";
import Role2Dashboard from "./pages/Role2Dashboard";
import Role3Dashboard from "./pages/Role3Dashboard";
import Role4Dashboard from "./pages/Role4Dashboard";
import Landing from "./pages/Landing";
import AdminVerification from "./pages/AdminVerification";

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

const RoleRoute = ({ children, allowedRoles }) => {
  const { isAuth, user, loading } = UserData();

  if (loading) {
    return <Loading />;
  }

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return children;
};

const App = () => {
  const { loading, isAuth, user } = UserData();
  return (
    <>
      {loading ? (
        <Loading />
      ) : (
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                isAuth ? (
                  <Navigate to={getDashboardPath(user.role)} replace />
                ) : (
                  <Landing />
                )
              }
            />

            <Route
              path="/login"
              element={
                isAuth ? (
                  <Navigate to={getDashboardPath(user.role)} replace />
                ) : (
                  <Login />
                )
              }
            />
            <Route
              path="/verify/:token"
              element={
                isAuth ? (
                  <Navigate to={getDashboardPath(user.role)} replace />
                ) : (
                  <OtpVerify />
                )
              }
            />
            <Route
              path="/register"
              element={ <Register />}
            />
            <Route
              path="/forgot"
              element={!isAuth ? <Forgot /> : <Navigate to={getDashboardPath(user.role)} replace />} 
            />
            <Route
              path="/reset-password/:token"
              element={<Reset />}
            />
            <Route
              path="/role1"
              element={
                <RoleRoute allowedRoles={["role1"]}>
                  <Role1Dashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/role2"
              element={
                <RoleRoute allowedRoles={["role2"]}>
                  <Role2Dashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/role3"
              element={
                <RoleRoute allowedRoles={["role3"]}>
                  <Role3Dashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/role4"
              element={
                <RoleRoute allowedRoles={["role4"]}>
                  <Role4Dashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/verification"
              element={
                <RoleRoute allowedRoles={["role4"]}>
                  <AdminVerification />
                </RoleRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      )}
    </>
  );
};

export default App;