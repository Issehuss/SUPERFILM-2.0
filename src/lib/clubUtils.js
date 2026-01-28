export function resolvePrimaryClub({ profile, myClubs }) {
  if (!Array.isArray(myClubs) || myClubs.length === 0) return null;

  const primaryId = profile?.primary_club_id;
  if (primaryId) {
    const match = myClubs.find((club) => club?.id === primaryId);
    if (match) return match;
  }

  return myClubs[0];
}
