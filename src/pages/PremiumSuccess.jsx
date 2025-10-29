// src/pages/PremiumSuccess.jsx
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";

export default function PremiumSuccess() {
  const { refreshProfile } = useUser();
  useEffect(() => { refreshProfile?.(); }, [refreshProfile]);
  return <Navigate to="/settings/premium?upgraded=1" replace />;
}
