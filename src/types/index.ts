// ─── Enums (mirror app/models/enums.py) ─────────────────────────────────────

export type QueueStatus = 'waiting' | 'calling' | 'serving' | 'done' | 'skipped';
export type ReceptionStatus = 'pending' | 'checked_in' | 'completed' | 'cancelled';
export type VisitStatus = 'waiting' | 'cls' | 'cls_result' | 'revisit' | 'done';
export type ExaminationStatus = 'draft' | 'saved' | 'completed';
export type DispositionType =
  | 'emergency' | 'outpatient' | 'revisit' | 'inpatient_ward'
  | 'inpatient' | 'transfer_out' | 'deceased' | 'transfer_clinic'
  | 'leave_ama' | 'discharged' | 'chronic_script';
export type PaymentType =
  | 'bhyt' | 'fee' | 'request' | 'health' | 'consume'
  | 'under6' | 'vaccine' | 'free' | 'defer';
export type UserRole = 'doctor' | 'nurse' | 'receptionist' | 'cashier' | 'admin';

// New enums
export type ClsResultStatus = 'pending' | 'in_process' | 'completed' | 'cancelled';
export type BillStatus = 'draft' | 'issued' | 'paid' | 'partial' | 'cancelled' | 'refunded';
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'momo' | 'vnpay' | 'zalopay' | 'bhyt' | 'defer';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'no_show';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  full_name: string | null;
  role: UserRole;
  clinic_room: string | null;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  username: string;
  full_name: string | null;
  role: UserRole;
  clinic_room: string | null;
}

// ─── Patient ─────────────────────────────────────────────────────────────────

export interface PatientList {
  id: number;
  patient_code: string | null;
  full_name: string;
  cccd: string | null;
  date_of_birth: string | null;
  birth_year: number | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  address_province_name: string | null;
}

export interface PatientResponse extends PatientList {
  cccd_issued_by: string | null;
  cccd_issued_date: string | null;
  occupation: string | null;
  ethnicity_code: string | null;
  ethnicity_name: string | null;
  nationality_code: string | null;
  nationality_name: string | null;
  address_street: string | null;
  address_village: string | null;
  address_ward_code: string | null;
  address_ward_name: string | null;
  address_district_code: string | null;
  address_district_name: string | null;
  address_province_code: string | null;
  address: string | null;
  workplace: string | null;
  email: string | null;
  policy_type: string | null;
  contact_name: string | null;
  contact_address: string | null;
  contact_phone: string | null;
  contact_cccd: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientCreate {
  full_name: string;
  date_of_birth?: string | null;
  birth_year?: number | null;
  gender?: 'male' | 'female' | null;
  cccd?: string | null;
  cccd_issued_by?: string | null;
  cccd_issued_date?: string | null;
  occupation?: string | null;
  ethnicity_code?: string | null;
  ethnicity_name?: string | null;
  nationality_code?: string | null;
  nationality_name?: string | null;
  address_street?: string | null;
  address_village?: string | null;
  address_ward_code?: string | null;
  address_ward_name?: string | null;
  address_district_code?: string | null;
  address_district_name?: string | null;
  address_province_code?: string | null;
  address_province_name?: string | null;
  address?: string | null;
  workplace?: string | null;
  phone?: string | null;
  email?: string | null;
  policy_type?: string | null;
  contact_name?: string | null;
  contact_address?: string | null;
  contact_phone?: string | null;
  contact_cccd?: string | null;
}

// ─── Queue Ticket ────────────────────────────────────────────────────────────

export interface QueueTicket {
  id: number;
  ticket_number: number;
  counter_number: number | null;
  status: QueueStatus;
  called_at: string | null;
  served_at: string | null;
  service_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueueSummary {
  total_waiting: number;
  total_serving: number;
  current_number: number | null;
  counter_number: number | null;
  date: string;
}

// ─── Reception ───────────────────────────────────────────────────────────────

export interface ReceptionList {
  id: number;
  visit_date: string;
  visit_time: string | null;
  status: ReceptionStatus;
  clinic_room: string | null;
  visit_number: number | null;
  priority: number;
  patient_type: string | null;
  subject_name: string | null;
  insurance_number: string | null;
  patient_id: number;
  queue_ticket_id: number | null;
  checked_in_at: string | null;
  patient: PatientList | null;
}

export interface ReceptionResponse extends ReceptionList {
  visit_status: VisitStatus;
  is_appointment: boolean;
  is_online: boolean;
  is_referral: boolean;
  subject_type: string | null;
  insurance_valid_from: string | null;
  insurance_valid_to: string | null;
  initial_registration: string | null;
  referral_note: string | null;
  referral_facility: string | null;
  high_tech_service: boolean;
  insurance_5years: boolean;
  insurance_5years_date: string | null;
  special_status: string | null;
  is_near_poor: boolean;
  is_poor: boolean;
  patient_category: string | null;
  reason: string | null;
  department: string | null;
  doctor_name: string | null;
  completed_at: string | null;
  receptionist_name: string | null;
  internal_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceptionCreate {
  patient_id?: number | null;
  patient_data?: PatientCreate | null;
  visit_time?: string | null;
  clinic_room?: string | null;
  subject_type?: string | null;
  subject_name?: string | null;
  insurance_number?: string | null;
  insurance_valid_from?: string | null;
  insurance_valid_to?: string | null;
  initial_registration?: string | null;
  referral_note?: string | null;
  referral_facility?: string | null;
  patient_category?: string | null;
  patient_type?: string | null;
  priority?: number;
  reason?: string | null;
  is_appointment?: boolean;
  is_online?: boolean;
  is_referral?: boolean;
  high_tech_service?: boolean;
  insurance_5years?: boolean;
  insurance_5years_date?: string | null;
  is_near_poor?: boolean;
  is_poor?: boolean;
  receptionist_name?: string | null;
  internal_note?: string | null;
}

export interface ReceptionCheckIn {
  queue_ticket_id?: number | null;
  receptionist_name?: string | null;
  internal_note?: string | null;
}

// ─── Doctor queue ─────────────────────────────────────────────────────────────

export interface PatientSummary {
  id: number;
  patient_code: string | null;
  full_name: string;
  date_of_birth: string | null;
  birth_year: number | null;
  gender: string | null;
  phone: string | null;
}

export interface QueueItem {
  id: number;
  visit_number: number | null;
  visit_time: string | null;
  visit_status: VisitStatus;
  status: ReceptionStatus;
  patient: PatientSummary;
  patient_type: string | null;
  subject_name: string | null;
  priority: number;
}

export interface QueueStatsResponse {
  clinic_room: string;
  visit_date: string;
  total: number;
  waiting: number;
  cls: number;
  cls_result: number;
  revisit: number;
  done: number;
}

// ─── Examination ─────────────────────────────────────────────────────────────

export interface DiagnosisResponse {
  id: number;
  examination_id: number;
  icd_code: string | null;
  icd_name: string;
  is_primary: boolean;
  note: string | null;
  sort_order: number;
}

export interface PrescriptionItemResponse {
  id: number;
  examination_id: number;
  item_type: 'drug' | 'cls';
  item_code: string | null;
  item_name: string;
  unit: string | null;
  quantity: number;
  unit_price: number | null;
  usage_instruction: string | null;
  payment_type: PaymentType;
  total_amount: number | null;
  bhyt_amount: number | null;
  patient_amount: number | null;
  sort_order: number;
}

export interface ExaminationResponse {
  id: number;
  reception_id: number;
  patient_id: number;
  doctor_id: number | null;
  doctor_name: string | null;
  status: ExaminationStatus;
  exam_date: string;
  exam_start_at: string | null;
  exam_end_at: string | null;
  subject_type: string | null;
  subject_name: string | null;
  insurance_number: string | null;
  clinical_symptoms: string | null;
  complications: string | null;
  disposition: DispositionType | null;
  revisit_days: number | null;
  diagnoses: DiagnosisResponse[];
  prescription_items: PrescriptionItemResponse[];
  created_at: string;
  updated_at: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ─── Clinic Room Stats ────────────────────────────────────────────────────────

export interface ClinicRoomStat {
  clinic_room: string;
  total: number;
  pending: number;
  bhyt: number;
  service: number;
}

export interface ClinicRoomStatResponse {
  rooms: ClinicRoomStat[];
  total_all: number;
  total_pending: number;
  total_bhyt: number;
  total_service: number;
}

// ─── API Error ────────────────────────────────────────────────────────────────

export interface ApiError {
  detail: string | Array<{ msg: string; loc: string[] }>;
  status: number;
}

// ─── CLS Result ───────────────────────────────────────────────────────────────

export interface ClsResultValue {
  id:             number;
  cls_result_id:  number;
  indicator_name: string;
  indicator_code: string | null;
  value_text:     string | null;
  value_numeric:  number | null;
  unit:           string | null;
  ref_min:        number | null;
  ref_max:        number | null;
  ref_text:       string | null;
  is_abnormal:    boolean;
  sort_order:     number;
}

export interface ClsResultResponse {
  id:                   number;
  prescription_item_id: number;
  examination_id:       number;
  patient_id:           number;
  service_code:         string | null;
  service_name:         string;
  department:           string | null;
  status:               ClsResultStatus;
  performed_at:         string | null;
  result_at:            string | null;
  performed_by:         string | null;
  verified_by:          string | null;
  result_summary:       string | null;
  result_note:          string | null;
  result_file_url:      string | null;
  is_abnormal:          boolean;
  values:               ClsResultValue[];
  created_at:           string;
  updated_at:           string;
}

export interface ClsResultUpdate {
  status?:          ClsResultStatus;
  performed_by?:    string;
  verified_by?:     string;
  result_summary?:  string;
  result_note?:     string;
  result_file_url?: string;
  is_abnormal?:     boolean;
  values?: Array<{
    indicator_name:  string;
    indicator_code?: string;
    value_text?:     string;
    value_numeric?:  number;
    unit?:           string;
    ref_min?:        number;
    ref_max?:        number;
    ref_text?:       string;
    is_abnormal?:    boolean;
    sort_order?:     number;
  }>;
}

// ─── Drug Interaction ─────────────────────────────────────────────────────────

export interface DrugWarning {
  warning_type: 'duplicate_ingredient' | 'known_interaction';
  severity:     'info' | 'warning' | 'danger';
  drug_a_code:  string;
  drug_a_name:  string;
  drug_b_code:  string;
  drug_b_name:  string;
  ingredient:   string | null;
  message:      string;
}

export interface DrugInteractionResponse {
  has_warnings: boolean;
  warnings:     DrugWarning[];
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export interface BillItemResponse {
  id:                   number;
  bill_id:              number;
  prescription_item_id: number | null;
  item_type:            string;
  item_code:            string | null;
  item_name:            string;
  unit:                 string | null;
  quantity:             number;
  unit_price:           number | null;
  payment_type:         PaymentType;
  total_amount:         number | null;
  bhyt_amount:          number | null;
  patient_amount:       number | null;
  sort_order:           number;
}

export interface PaymentResponse {
  id:              number;
  bill_id:         number;
  cashier_id:      number | null;
  payment_method:  PaymentMethod;
  amount:          number;
  paid_at:         string;
  transaction_ref: string | null;
  note:            string | null;
  is_deposit:      boolean;
  is_refund:       boolean;
  created_at:      string;
}

export interface BillResponse {
  id:               number;
  bill_number:      string;
  examination_id:   number | null;
  patient_id:       number | null;
  status:           BillStatus;
  issued_at:        string | null;
  paid_at:          string | null;
  cashier_id:       number | null;
  cashier_name:     string | null;
  drug_total:       number;
  cls_total:        number;
  service_total:    number;
  grand_total:      number;
  bhyt_pays:        number;
  patient_pays:     number;
  discount_amount:  number;
  deposit_amount:   number;
  balance_due:      number;
  insurance_number: string | null;
  bhyt_approved_code: string | null;
  note:             string | null;
  items:            BillItemResponse[];
  payments:         PaymentResponse[];
  created_at:       string;
  updated_at:       string;
}

// ─── Appointment ─────────────────────────────────────────────────────────────

export interface AppointmentResponse {
  id:               number;
  appointment_no:   string;
  patient_id:       number;
  doctor_id:        number | null;
  examination_id:   number | null;
  scheduled_date:   string;
  scheduled_time:   string | null;
  status:           AppointmentStatus;
  appointment_type: 'new' | 'revisit' | 'followup';
  reason:           string | null;
  doctor_name:      string | null;
  department:       string | null;
  clinic_room:      string | null;
  note:             string | null;
  patient_note:     string | null;
  cancel_reason:    string | null;
  is_reminded:      boolean;
  created_at:       string;
  updated_at:       string;
}

export interface AppointmentCreate {
  patient_id:       number;
  doctor_id?:       number;
  examination_id?:  number;
  scheduled_date:   string;
  scheduled_time?:  string;
  appointment_type?: 'new' | 'revisit' | 'followup';
  reason?:          string;
  doctor_name?:     string;
  department?:      string;
  clinic_room?:     string;
  note?:            string;
  patient_note?:    string;
}
