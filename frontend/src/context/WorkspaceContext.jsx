import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../utils/api";
import { toast } from "react-toastify";
import { UserData } from "./UserContext";

const WorkspaceContext = createContext();

export const WorkspaceProvider = ({ children }) => {
  const { isAuth } = UserData();
  const [workspaces, setWorkspaces] = useState([]);
  const [personalWorkspaceId, setPersonalWorkspaceId] = useState(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(
    () => localStorage.getItem("currentWorkspaceId") || ""
  );
  const [loading, setLoading] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    if (!isAuth) {
      setWorkspaces([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/api/workspaces");
      setWorkspaces(data.workspaces || []);
      setPersonalWorkspaceId(data.personalWorkspaceId);
      const saved = localStorage.getItem("currentWorkspaceId");
      const ids = (data.workspaces || []).map((w) => String(w.workspace._id));
      const next =
        (saved && ids.includes(saved) && saved) ||
        (data.personalWorkspaceId && ids.includes(String(data.personalWorkspaceId))
          ? String(data.personalWorkspaceId)
          : ids[0] || "");
      setCurrentWorkspaceId(next);
      if (next) localStorage.setItem("currentWorkspaceId", next);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  }, [isAuth]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const selectWorkspace = (id) => {
    setCurrentWorkspaceId(id);
    localStorage.setItem("currentWorkspaceId", id);
  };

  const createOrganization = async (name) => {
    const { data } = await api.post("/api/workspaces", { name });
    await fetchWorkspaces();
    selectWorkspace(String(data.workspace._id));
    return data;
  };

  const current = useMemo(
    () => workspaces.find((w) => String(w.workspace._id) === String(currentWorkspaceId)),
    [workspaces, currentWorkspaceId]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        personalWorkspaceId,
        currentWorkspaceId,
        current,
        loading,
        selectWorkspace,
        fetchWorkspaces,
        createOrganization,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => useContext(WorkspaceContext);
