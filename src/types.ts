export type Role = 'admin' | 'teacher' | 'parent';

export interface UserProfile {
  id: string;
  uid?: string;
  email: string;
  fullName: string;
  role: Role;
  status: 'active' | 'suspended' | 'inactive';
  isActive?: boolean;
  phone?: string;
  password?: string;
  subjects?: string[];
  classAssignments?: string[];
  childIds?: string[];
  lastLoginAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface Student {
  id: string;
  admissionNumber: string;
  fullName: string;
  className: string;
  gender: 'Male' | 'Female';
  status: 'active' | 'graduated' | 'inactive';
  left?: boolean;
  dob?: string;
  dateOfBirth?: string;
  linNumber?: string;
  guardianPhone?: string;
  parentEmails?: string[];
  parentIds?: string[];
  teacherIds?: string[];
  medicalNotes?: string;
  feeBalance?: number;
  attendanceRate?: number;
  academicYear?: number;
  enrolledAt?: any;
  registeredAt?: any;
  updatedAt?: any;
}

export interface Teacher {
  id: string;
  uid?: string;
  teacherId?: string;
  userUid?: string;
  fullName: string;
  email: string;
  phone?: string;
  password?: string;
  qualification?: string;
  status: 'active' | 'inactive';
  isActive?: boolean;
  classAssignments: string[];
  subjects: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface Parent {
  id: string;
  uid?: string;
  parentId?: string;
  userUid?: string;
  fullName: string;
  email: string;
  phone?: string;
  password?: string;
  status: 'active' | 'inactive';
  isActive?: boolean;
  childIds: string[];
  address?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ClassCohort {
  level: string;
  stream: string;
  display: string;
  type: 'O-Level' | 'A-Level';
}

export interface Subject {
  id: string;
  code?: string;
  name: string;
  department?: string;
  category?: 'Core' | 'Elective' | 'Vocational';
  level?: 'O-Level' | 'A-Level' | 'Both' | 'All Classes';
  classLevel?: string;
  status?: string;
  teacherIds?: string[];
}

export interface TimetableSlot {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  className: string;
  classId?: string;
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherName?: string;
  teacherEmail?: string;
  room?: string;
  status?: string;
  term?: string;
  academicYear?: number;
}

export interface AttendanceRecord {
  id?: string;
  studentId: string;
  className: string;
  classId?: string;
  streamId?: string;
  date: string;
  term: string;
  year?: number;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks?: string;
  teacherId?: string;
  markedBy?: string;
  recordedAt?: any;
  recordedBy?: string;
}

export interface FeeRecord {
  id?: string;
  studentId: string;
  className?: string;
  term: string;
  year?: number;
  academicYear?: number;
  totalFee: number;
  totalFees?: number;
  amount?: number;
  paidAmount: number;
  balance: number;
  status: 'paid' | 'partial' | 'unpaid';
  updatedAt?: any;
}

export interface PaymentRecord {
  id: string;
  studentId: string;
  studentName?: string;
  amount: number;
  term?: string;
  year?: number;
  date?: string;
  provider: string; // MTN Mobile Money, Airtel Money, Bank Deposit, Cash
  paymentMethod?: string;
  channel?: string;
  transactionRef: string;
  confirmedBy?: string;
  confirmedAt?: any;
  receiptNumber?: string;
  status?: string;
  recordedBy?: string;
}

export interface ParentPaymentApproval {
  id: string;
  parentId: string;
  parentName?: string;
  phone?: string;
  studentId: string;
  studentName?: string;
  studentAdmissionNumber?: string;
  admissionNumber?: string;
  className?: string;
  amount: number;
  date?: string;
  term?: string;
  year?: number;
  network?: string; // MTN, Airtel, Bank
  provider?: string;
  transactionId?: string;
  transactionRef?: string;
  referenceNumber?: string;
  paymentMethod?: string;
  channel?: string;
  notes?: string;
  proof?: string;
  proofUrl?: string;
  proofFileName?: string;
  messageBody?: string;
  status: 'pending' | 'verified' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt?: any;
  submittedAt?: any;
  verifiedAt?: any;
  verifiedBy?: string;
  reviewedAt?: any;
  reviewedBy?: string;
}

export interface ResultRecord {
  id?: string;
  studentId: string;
  className?: string;
  classId?: string;
  subjectId: string;
  subjectName?: string;
  term: string;
  year?: number;
  examType: string;
  examIdentifier?: string;
  marks: number;
  grade: string;
  comment?: string;
  remarks?: string;
  position?: number | string;
  teacherId?: string;
  publishedAt?: any;
  updatedAt?: any;
}

export interface TeacherSubmissionItem {
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  score: number;
  grade: string;
  remarks?: string;
  marks?: number;
}

export interface TeacherSubmission {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail?: string;
  subject: string;
  subjectId?: string;
  subjectName?: string;
  className: string;
  term: string;
  year: number;
  examType: string;
  items?: TeacherSubmissionItem[];
  marks?: TeacherSubmissionItem[];
  studentMarks?: Record<string, { marks: number; grade: string; comment?: string }>;
  studentCount?: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  submittedAt?: any;
  reviewedAt?: any;
  reviewedBy?: string;
  approvedAt?: any;
  approvedBy?: string;
}

export interface ReportCard {
  id: string;
  studentId: string;
  className?: string;
  classId?: string;
  streamId?: string;
  term: string;
  year: number;
  average: number;
  totalMarks?: number;
  position?: number;
  totalStudents?: number;
  isIncomplete?: boolean;
  adminComment?: string;
  teacherComment?: string;
  conduct?: string;
  status?: 'draft' | 'published' | 'active';
  compiledAt?: any;
  compiledBy?: string;
  generatedAt?: any;
  publishedAt?: any;
}

export interface EnrollmentHistory {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  fromClass?: string;
  toClass?: string;
  previousClass?: string;
  nextClass?: string;
  term: string;
  year?: number;
  academicYear?: number;
  outcome?: 'promoted' | 'repeated' | 'graduated' | 'transferred';
  promotedBy?: string;
  promotedAt?: any;
  timestamp?: any;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  audience: 'all' | 'teachers' | 'parents' | 'students' | string;
  classTarget?: string;
  author?: string;
  createdBy?: string;
  status?: string;
  createdAt?: any;
}

export interface MessageItem {
  id: string;
  threadId?: string;
  senderId: string;
  senderName?: string;
  senderRole: string;
  receiverId?: string;
  recipientId?: string;
  receiverRole?: string;
  recipientRole?: string;
  text?: string;
  messageText?: string;
  isRead?: boolean;
  readStatus?: boolean;
  attachments?: any[];
  createdAt?: any;
}

export interface AuditLog {
  id: string;
  action?: string;
  actionType?: string;
  performedBy: string;
  targetType: string;
  targetId?: string;
  timestamp?: any;
}

export interface SystemSettings {
  schoolName: string;
  motto: string;
  currentTerm: string;
  currentYear: number;
  academicYear?: number;
  currency: string;
  phone?: string;
  contactPhone?: string;
  email?: string;
  contactEmail?: string;
  address?: string;
}
