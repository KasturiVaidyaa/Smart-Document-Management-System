import React from "react";
import Role4Navbar from "../components/Role4Navbar";

const Role4Dashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white">
      <Role4Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-4">Role 4 Dashboard</h1>
        <p className="text-gray-300">
          This is the dedicated dashboard for <span className="font-semibold">role4</span>.
        </p>
      </main>
    </div>
  );
};

export default Role4Dashboard;

