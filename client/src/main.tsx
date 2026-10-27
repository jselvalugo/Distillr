import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrandToaster } from "./components/brand-toaster";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <BrandToaster />
    </QueryClientProvider>
  </StrictMode>
);
