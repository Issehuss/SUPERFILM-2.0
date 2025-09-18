import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchClubMembersWithRoles, assignClubRole, signMyClubRole } from "../services/roles";
import { useUser } from "../context/UserContext";

export default function useClubRoles(clubId) {
  const { user } = useUser();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      const rows = await fetchClubMembersWithRoles(clubId);
      setMembers(rows);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { refresh(); }, [refresh]);

  const myRow = useMemo(() => members.find(m => m.user_id === user?.id), [members, user?.id]);
  const isLeader = myRow?.role === "president";

  return {
    members,
    myRole: myRow?.role || "member",
    hasSigned: Boolean(myRow?.role_signed_at),
    isLeader,
    loading,
    error: err,
    refresh,
    async assign({ userId, role }) {
      await assignClubRole({ clubId, userId, role });
      await refresh();
    },
    async sign() {
      await signMyClubRole({ clubId });
      await refresh();
    },
  };
}
