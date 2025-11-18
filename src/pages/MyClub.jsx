import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import useMyClub from "../hooks/useMyClub";
import Splash from "../components/Splash";

export default function MyClub() {
  const { user, loading } = useUser();
  const { loading: clubLoading, club } = useMyClub(user?.id);

  if (loading || clubLoading) {
    return <Splash message="Finding your club..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!club) {
    // no membership → no My Club page
    return <Navigate to="/create-club" replace />;
  }

  // has membership → jump straight to the club page
  return <Navigate to={`/clubs/${club.slug}`} replace />;
}
