import React from "react";
import Header from "./Header";
import Footer from "./Footer";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--page-bg)]">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
