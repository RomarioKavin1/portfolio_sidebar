"use client";

import PortfolioSidebar from "@/components/metaSidebar";
import MetaMaskSidebar from "@/components/metaSidebar";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen">
      <PortfolioSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold">Main Content</h1>
      </main>
    </div>
  );
}
