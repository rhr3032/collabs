import { createContext, useContext, ReactNode } from "react";
import { useLocation } from "react-router-dom";

const DemoContext = createContext(false);

export function DemoProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isDemo = location.pathname.startsWith("/demo");
  return <DemoContext.Provider value={isDemo}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  return useContext(DemoContext);
}
