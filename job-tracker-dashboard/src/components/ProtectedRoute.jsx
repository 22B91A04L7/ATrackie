import { Navigate, Outlet } from "react-router-dom";
import { useSyncExternalStore } from "react";

function subscribeToSession(onChange) {
  const listener = (event) => {
    if (event.key === "token" || event.key === null) onChange();
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function ProtectedRoute() {
  const token = useSyncExternalStore(subscribeToSession, () => localStorage.getItem("token"), () => null);
  // Remount pages on account/session changes so old form data and jobs cannot
  // remain visible in a second dashboard tab after another account signs in.
  return token ? <Outlet key={token} /> : <Navigate to="/login" replace />;
}
export default ProtectedRoute;
