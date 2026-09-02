import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserData } from "../context/UserContext";

const Role1Navbar = () => {
  const { user, logoutUser, btnLoading } = UserData();
  const navigate = useNavigate();

  return (
    <nav className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
      <div className="text-lg font-bold text-[#50c878]">Role 1 Dashboard</div>
      <div className="flex items-center gap-6">
        <Link to="/role1" className="hover:text-[#50c878]">
          Overview
        </Link>
        <button
          onClick={() => logoutUser(navigate)}
          disabled={btnLoading}
          className="text-sm bg-red-600 hover:bg-red-500 px-3 py-1 rounded-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Logout
        </button>
        <span className="text-sm text-gray-300">
          {user?.name} ({user?.role})
        </span>
      </div>
    </nav>
  );
};

export default Role1Navbar;

