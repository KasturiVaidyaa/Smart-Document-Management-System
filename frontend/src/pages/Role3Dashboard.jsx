import React from "react";
import Role3Navbar from "../components/Role3Navbar";

const Role3Dashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-800 text-white">
      <Role3Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-4">Role 3 Dashboard</h1>
        <p className="text-gray-300">
          This is the dedicated dashboard for <span className="font-semibold">role3</span>.
        </p>
      </main>
    </div>
  );
};

export default Role3Dashboard;

