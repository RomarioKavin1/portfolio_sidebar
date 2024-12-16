"use client";
import BlockBuilder from "@/components/blockBuilder";
import PortfolioSidebar from "@/components/metaSidebar";

export default function Home() {
  return (
    <div className="flex min-h-screen">
      <PortfolioSidebar />
      <main className="flex-1">
        <h1 className="">
          <BlockBuilder />
        </h1>
      </main>
    </div>
  );
}
