import { ClassCohort, Subject, SystemSettings } from '../types';

export const SCHOOL_LOGO_URL = 'https://www.image2url.com/r2/default/images/1783246676629-4ce5802c-8e40-4365-9cc3-5c3e19f2696f.jpg';

export const ALL_CLASSES: ClassCohort[] = [
  // O-Level
  { level: 'S.1', stream: 'T', display: 'S.1T', type: 'O-Level' },
  { level: 'S.1', stream: 'K', display: 'S.1K', type: 'O-Level' },
  { level: 'S.1', stream: 'Q', display: 'S.1Q', type: 'O-Level' },
  { level: 'S.1', stream: 'P', display: 'S.1P', type: 'O-Level' },
  { level: 'S.2', stream: 'T', display: 'S.2T', type: 'O-Level' },
  { level: 'S.2', stream: 'K', display: 'S.2K', type: 'O-Level' },
  { level: 'S.2', stream: 'Q', display: 'S.2Q', type: 'O-Level' },
  { level: 'S.2', stream: 'P', display: 'S.2P', type: 'O-Level' },
  { level: 'S.3', stream: 'T', display: 'S.3T', type: 'O-Level' },
  { level: 'S.3', stream: 'K', display: 'S.3K', type: 'O-Level' },
  { level: 'S.3', stream: 'P', display: 'S.3P', type: 'O-Level' },
  { level: 'S.4', stream: 'T', display: 'S.4T', type: 'O-Level' },
  { level: 'S.4', stream: 'K', display: 'S.4K', type: 'O-Level' },
  { level: 'S.4', stream: 'Q', display: 'S.4Q', type: 'O-Level' },
  { level: 'S.4', stream: 'P', display: 'S.4P', type: 'O-Level' },
  // A-Level
  { level: 'S.5', stream: 'Arts', display: 'S.5 Arts', type: 'A-Level' },
  { level: 'S.5', stream: 'Sciences', display: 'S.5 Sciences', type: 'A-Level' },
  { level: 'S.6', stream: 'Arts', display: 'S.6 Arts', type: 'A-Level' },
  { level: 'S.6', stream: 'Sciences', display: 'S.6 Sciences', type: 'A-Level' },
];

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'math', code: 'MTH', name: 'Mathematics', category: 'Core', level: 'Both' },
  { id: 'eng', code: 'ENG', name: 'English Language', category: 'Core', level: 'Both' },
  { id: 'phy', code: 'PHY', name: 'Physics', category: 'Core', level: 'Both' },
  { id: 'chem', code: 'CHM', name: 'Chemistry', category: 'Core', level: 'Both' },
  { id: 'bio', code: 'BIO', name: 'Biology', category: 'Core', level: 'Both' },
  { id: 'hist', code: 'HST', name: 'History & Political Ed.', category: 'Core', level: 'Both' },
  { id: 'geo', code: 'GEO', name: 'Geography', category: 'Core', level: 'Both' },
  { id: 'cre', code: 'CRE', name: 'Christian Religious Ed.', category: 'Elective', level: 'O-Level' },
  { id: 'ire', code: 'IRE', name: 'Islamic Religious Ed.', category: 'Elective', level: 'O-Level' },
  { id: 'agr', code: 'AGR', name: 'Agriculture', category: 'Vocational', level: 'Both' },
  { id: 'ict', code: 'ICT', name: 'Computer Studies / ICT', category: 'Vocational', level: 'Both' },
  { id: 'art', code: 'ART', name: 'Art and Design', category: 'Vocational', level: 'Both' },
  { id: 'lit', code: 'LIT', name: 'Literature in English', category: 'Elective', level: 'Both' },
  { id: 'econ', code: 'ECO', name: 'Economics', category: 'Core', level: 'A-Level' },
  { id: 'ent', code: 'ENT', name: 'Entrepreneurship', category: 'Vocational', level: 'Both' },
];

export const DEFAULT_SETTINGS: SystemSettings = {
  schoolName: 'MUBENDE LIGHT SENIOR SECONDARY SCHOOL',
  motto: 'Education is Light.',
  currentTerm: 'Term 1',
  currentYear: 2026,
  academicYear: 2026,
  currency: 'UGX',
  phone: '+256 700 123 456',
  contactPhone: '+256 700 123 456',
  email: 'admin@mubendelight.sc.ug',
  contactEmail: 'admin@mubendelight.sc.ug',
  address: 'Mubende Municipality, Uganda',
};
