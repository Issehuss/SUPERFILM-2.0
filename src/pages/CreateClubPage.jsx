import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import useMyClub from "../hooks/useMyClub";
import CreateClubWizard from "./CreateClubWizard";
import Splash from "../components/Splash";

export default function CreateClubPage() {
  const { user, loading } = useUser();
  const { loading: clubLoading, hasClub } = useMyClub(user?.id);

  if (loading || clubLoading) {
    return <Splash message="Preparing your club creator..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (hasClub) {
    // already in a club → go to My Club instead
    return <Navigate to="/myclub" replace />;
  }

  // render the wizard (your existing file)
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 pt-10">
        <h1 className="text-2xl font-semibold mb-3">Create a Club</h1>
        <p className="text-zinc-400 mb-6">You’ll start as <span className="text-yellow-400 font-semibold">President</span>.</p>
      </div>
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <CreateClubWizard />
      </div>
    </div>
  );
}
