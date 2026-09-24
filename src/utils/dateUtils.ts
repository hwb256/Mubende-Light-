/**
 * Formats a Firestore Timestamp, Date, or string into a clean, human-readable date.
 * Strictly outputs just the date without extra prefix text, author comments, or timestamps.
 * e.g., "21 Sep 2026"
 */
export function formatAnnouncementDate(createdAt: any): string {
  if (!createdAt) return '';
  try {
    let d: Date | null = null;
    if (typeof createdAt?.toDate === 'function') {
      d = createdAt.toDate();
    } else if (createdAt?.seconds) {
      d = new Date(createdAt.seconds * 1000);
    } else if (typeof createdAt === 'string' || typeof createdAt === 'number') {
      const parsed = new Date(createdAt);
      if (!isNaN(parsed.getTime())) d = parsed;
    } else if (createdAt instanceof Date) {
      d = createdAt;
    }

    if (d && !isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  } catch {
    // fallback gracefully
  }
  return '';
}
