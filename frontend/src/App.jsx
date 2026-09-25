import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
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
import WorkspaceAdmin from "./pages/WorkspaceAdmin";
import ShareLinkAccess from "./pages/ShareLinkAccess";
import ErrorBoundary from "./components/ErrorBoundary";

// ── Auth guards ────────────────────────────────────────────────────
const Protected = () => {
  const { isAuth, loading } = UserData();
  if (loading) return <Loading />;
  if (!isAuth) return <Navigate to="/login" replace />;
  return (
    <WorkspaceProvider>
      <AppLayout />
    </WorkspaceProvider>
  );
};

const Guest = ({ children }) => {
  const { isAuth, loading } = UserData();
  if (loading) return <Loading />;
  if (isAuth) return <Navigate to="/app" replace />;
  return children;
};

// ── Router definition ──────────────────────────────────────────────
const router = createBrowserRouter([
  {
    path: "/",
    element: <Guest><Landing /></Guest>,
  },
  {
    path: "/login",
    element: <Guest><Login /></Guest>,
  },
  {
    path: "/register",
    element: <Guest><Register /></Guest>,
  },
  {
    path: "/forgot",
    element: <Guest><Forgot /></Guest>,
  },
  {
    path: "/reset-password/:token",
    element: <Reset />,
  },
  {
    path: "/share/:token",
    element: <ShareLinkAccess />,
  },
  {
    path: "/app",
    element: <Protected />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "documents", element: <Documents /> },
      { path: "chat", element: <Chat /> },
      // Old standalone route now redirects into admin
      { path: "access-requests", element: <Navigate to="/app/admin" replace /> },
      { path: "admin", element: <WorkspaceAdmin /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

const App = () => (
  <ErrorBoundary>
    <RouterProvider router={router} />
  </ErrorBoundary>
);

export default App;
