import React from "react";
import Role1Navbar from "../components/Role1Navbar";

const Role1Dashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <Role1Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-4">Role 1 Dashboard</h1>
        <p className="text-gray-300">
          This is the dedicated dashboard for <span className="font-semibold">role1</span>.
        </p>
      </main>
    </div>
  );
};

export default Role1Dashboard;

