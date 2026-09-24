import { Subject } from '../types';
import { DEFAULT_SUBJECTS } from '../constants/school';

/**
 * Returns the human-readable subject name.
 * Firebase auto-generated document IDs (e.g. alphanumeric strings) are never shown on the UI.
 */
export function getSubjectDisplayName(
  subjectIdOrName?: string,
  subjectsList?: Subject[]
): string {
  if (!subjectIdOrName) return 'Curriculum Subject';
  const clean = String(subjectIdOrName).trim();
  if (!clean) return 'Curriculum Subject';

  // 1. Check in passed subjects list
  if (subjectsList && subjectsList.length > 0) {
    const foundById = subjectsList.find(s => s.id === clean);
    if (foundById?.name) return foundById.name;

    const foundByName = subjectsList.find(
      s => s.name.toLowerCase() === clean.toLowerCase()
    );
    if (foundByName?.name) return foundByName.name;

    const foundByCode = subjectsList.find(
      s => s.code && s.code.toLowerCase() === clean.toLowerCase()
    );
    if (foundByCode?.name) return foundByCode.name;
  }

  // 2. Check in DEFAULT_SUBJECTS
  const defaultFound = DEFAULT_SUBJECTS.find(
    s =>
      s.id === clean ||
      s.name.toLowerCase() === clean.toLowerCase() ||
      (s.code && s.code.toLowerCase() === clean.toLowerCase())
  );
  if (defaultFound?.name) return defaultFound.name;

  // 3. Never render raw Firestore alphanumeric document IDs on UI
  if (/^[a-zA-Z0-9_-]{15,}$/.test(clean)) {
    return 'Curriculum Subject';
  }

  return clean;
}
