import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Role4Navbar from "../components/Role4Navbar";
import { UserData } from "../context/UserContext";

const AdminVerification = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const navigate = useNavigate();
  const { user } = UserData();

  // Separate users by role
  const role2Users = pendingUsers.filter((u) => u.role === "role2");
  const role3Users = pendingUsers.filter((u) => u.role === "role3");

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/user/pending");
      setPendingUsers(data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load pending users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const handleApprove = async (id) => {
    try {
      setActionLoadingId(id);
      const { data } = await api.patch(`/api/user/${id}/approve`);
      toast.success(data.message || "User approved successfully");
      setPendingUsers((prev) => prev.filter((u) => u._id !== id));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to approve user");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id) => {
    try {
      setActionLoadingId(id);
      const { data } = await api.delete(`/api/user/${id}/reject`);
      toast.info(data.message || "User rejected and removed");
      setPendingUsers((prev) => prev.filter((u) => u._id !== id));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to reject user");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white">
      <Role4Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Admin Verification</h1>
          <button
            onClick={fetchPendingUsers}
            className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-sm"
          >
            Refresh
          </button>
        </div>

        <p className="text-gray-300 mb-6">
          Below are all <span className="font-semibold">role2</span> and{" "}
          <span className="font-semibold">role3</span> users who are waiting for admin
          verification. You can accept or reject each request.
        </p>

        {loading ? (
          <div className="text-gray-400">Loading pending users...</div>
        ) : pendingUsers.length === 0 ? (
          <div className="text-gray-400">
            No pending users to verify right now.
          </div>
        ) : (
          <div className="space-y-8">
            {/* Role 2 Section */}
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-emerald-400">
                Role 2 Users ({role2Users.length})
              </h2>
              {role2Users.length === 0 ? (
                <div className="text-gray-400 bg-gray-900/60 border border-gray-800 rounded-lg p-4">
                  No pending role2 users
                </div>
              ) : (
                <div className="overflow-x-auto bg-gray-900/60 border border-gray-800 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {role2Users.map((u) => (
                        <tr
                          key={u._id}
                          className="border-t border-gray-800 hover:bg-gray-800/60"
                        >
                          <td className="px-4 py-3">{u.name}</td>
                          <td className="px-4 py-3 text-gray-300">{u.email}</td>
                          <td className="px-4 py-3 space-x-2">
                            <button
                              onClick={() => handleApprove(u._id)}
                              disabled={actionLoadingId === u._id}
                              className="px-3 py-1 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {actionLoadingId === u._id ? "Processing..." : "Accept"}
                            </button>
                            <button
                              onClick={() => handleReject(u._id)}
                              disabled={actionLoadingId === u._id}
                              className="px-3 py-1 rounded-md text-xs font-medium bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {actionLoadingId === u._id ? "Processing..." : "Reject"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Role 3 Section */}
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-blue-400">
                Role 3 Users ({role3Users.length})
              </h2>
              {role3Users.length === 0 ? (
                <div className="text-gray-400 bg-gray-900/60 border border-gray-800 rounded-lg p-4">
                  No pending role3 users
                </div>
              ) : (
                <div className="overflow-x-auto bg-gray-900/60 border border-gray-800 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {role3Users.map((u) => (
                        <tr
                          key={u._id}
                          className="border-t border-gray-800 hover:bg-gray-800/60"
                        >
                          <td className="px-4 py-3">{u.name}</td>
                          <td className="px-4 py-3 text-gray-300">{u.email}</td>
                          <td className="px-4 py-3 space-x-2">
                            <button
                              onClick={() => handleApprove(u._id)}
                              disabled={actionLoadingId === u._id}
                              className="px-3 py-1 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {actionLoadingId === u._id ? "Processing..." : "Accept"}
                            </button>
                            <button
                              onClick={() => handleReject(u._id)}
                              disabled={actionLoadingId === u._id}
                              className="px-3 py-1 rounded-md text-xs font-medium bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {actionLoadingId === u._id ? "Processing..." : "Reject"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminVerification;

