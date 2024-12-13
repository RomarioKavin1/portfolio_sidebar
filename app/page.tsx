"use client";
import PortfolioSidebar from "@/components/metaSidebar";

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
