import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import useMyClub from "../hooks/useMyClub";
import CreateClubWizard from "./CreateClubWizard";
import Splash from "../components/Splash";

export default function CreateClubPage() {
  const { user, loading } = useUser();
  const { loading: clubLoading } = useMyClub(user?.id);

  if (loading || clubLoading) {
    return <Splash message="Preparing your club creator..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // ❗ FIX: DO NOT block users from creating multiple clubs
  // The "3 free clubs limit" is handled by canCreateAnotherClub() inside the wizard.
  // So we ALWAYS allow access to this page if the user is logged in.

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 pt-10">
        <h1 className="text-2xl font-semibold mb-3">Create a Club</h1>
        <p className="text-zinc-400 mb-6">
          You’ll start as{" "}
          <span className="text-yellow-400 font-semibold">President</span>.
        </p>
      </div>
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <CreateClubWizard />
      </div>
    </div>
  );
}
