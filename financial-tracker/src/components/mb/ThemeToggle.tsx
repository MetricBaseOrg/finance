"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const root = document.documentElement;
    const stored = localStorage.getItem("mb-theme") as "dark" | "light" | null;
    const initialTheme = stored || root.getAttribute("data-theme") || "dark";
    setTheme(initialTheme as "dark" | "light");
    root.setAttribute("data-theme", initialTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("mb-theme", newTheme);
  };

  return (
    <button 
      onClick={toggleTheme} 
      className="btn btn-sm"
      aria-label="Toggle theme"
      style={{ padding: "4px 8px", fontSize: 10 }}
    >
      {theme === "dark" ? "☀ LIGHT" : "🌙 DARK"}
    </button>
  );
}
