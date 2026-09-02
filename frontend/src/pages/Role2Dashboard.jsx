import React from "react";
import Role2Navbar from "../components/Role2Navbar";

const Role2Dashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <Role2Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-4">Role 2 Dashboard</h1>
        <p className="text-gray-300">
          This is the dedicated dashboard for <span className="font-semibold">role2</span>.
        </p>
      </main>
    </div>
  );
};

export default Role2Dashboard;

