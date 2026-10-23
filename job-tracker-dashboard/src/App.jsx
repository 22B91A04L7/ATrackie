import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import JobDetailsPage from "./pages/JobDetailsPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProtectedRoute from "./components/ProtectedRoute";
import ManualEntryPage from "./pages/ManualEntryPage";
import LandingPage from "./pages/LandingPage";
import "./App.css";
import "./workspace.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/jobs" element={<Dashboard />} />
          <Route path="/jobs/manual-entry" element={<ManualEntryPage />} />
          <Route path="/jobs/:id" element={<JobDetailsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
