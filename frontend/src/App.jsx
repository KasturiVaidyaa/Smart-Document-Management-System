import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { UserData } from "./context/UserContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { Loading } from "./components/Loading";
import Forgot from "./pages/Forgot";
import Reset from "./pages/Reset";
import Landing from "./pages/Landing";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import Chat from "./pages/Chat";
import ShareLinkAccess from "./pages/ShareLinkAccess";
import AccessRequestsPanel from "./components/documents/AccessRequestsPanel";

const Protected = ({ children }) => {
  const { isAuth, loading } = UserData();
  if (loading) return <Loading />;
  if (!isAuth) return <Navigate to="/login" replace />;
  return children;
};

const Guest = ({ children }) => {
  const { isAuth, loading } = UserData();
  if (loading) return <Loading />;
  if (isAuth) return <Navigate to="/app" replace />;
  return children;
};

const App = () => {
  const { loading } = UserData();

  if (loading) return <Loading />;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Guest>
              <Landing />
            </Guest>
          }
        />
        <Route
          path="/login"
          element={
            <Guest>
              <Login />
            </Guest>
          }
        />
        <Route
          path="/register"
          element={
            <Guest>
              <Register />
            </Guest>
          }
        />
        <Route
          path="/forgot"
          element={
            <Guest>
              <Forgot />
            </Guest>
          }
        />
        <Route path="/reset-password/:token" element={<Reset />} />
        <Route path="/share/:token" element={<ShareLinkAccess />} />
        <Route
          path="/app"
          element={
            <Protected>
              <WorkspaceProvider>
                <AppLayout />
              </WorkspaceProvider>
            </Protected>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="documents" element={<Documents />} />
          <Route path="chat" element={<Chat />} />
          <Route path="access-requests" element={<AccessRequestsPanel />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
