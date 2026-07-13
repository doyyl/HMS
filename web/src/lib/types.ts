export interface Room {
  id: number;
  building: 'A' | 'B';
  number: number;
  label: string;
  status: 'available' | 'occupied';
  cleaning_status: 'clean' | 'dirty' | 'cleaning';
  current_booking_id: number | null;
  type: 'short' | 'overnight' | null;
  check_in_at: string | null;
  expected_checkout_at: string | null;
  room_total: number | null;
  license_plate: string | null;
  province: string | null;
  converted_overnight: number | null;
}

export interface Booking {
  id: number;
  room_id: number;
  type: 'short' | 'overnight';
  license_plate: string | null;
  province: string | null;
  check_in_at: string;
  expected_checkout_at: string;
  base_amount: number;
  extension_hours: number;
  extension_amount: number;
  early_checkin_fee: number;
  converted_overnight: number;
  room_total: number;
  status: 'active' | 'closed' | 'void';
}

export interface FolioItem {
  id: number;
  name: string;
  qty: number;
  unit_price: number;
  line_total: number;
  source: string;
}

export interface Folio {
  booking: Booking;
  roomLabel: string;
  supplementaryTotal: number;
  grandTotal: number;
  items: FolioItem[];
}

export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  active: number;
}

export interface Shift {
  id: number;
  business_date: string;
  opening_float: number;
  opened_at: string;
  closing_count: number | null;
  expected_cash: number | null;
  variance: number | null;
  status: 'open' | 'closed';
}

export interface ShiftSummary {
  shift: Shift;
  cashTotal: number;
  qrTotal: number;
  missingSlips: number;
  expectedCash: number;
}

export interface AvailableRoom {
  id: number;
  building: string;
  number: number;
  label: string;
}

export interface Reservation {
  id: number;
  code: string;
  room_id: number;
  room_label: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  amount: number;
  status: 'pending_payment' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'expired' | 'no_show';
  booking_id: number | null;
  source: 'online' | 'phone' | 'walkin';
}

export interface ShiftPayment {
  id: number;
  amount: number;
  method: 'cash' | 'qr';
  status: 'normal' | 'voided';
  booking_id: number | null;
  room_label: string | null;
  created_at: string;
}

export interface ReceiptData extends Folio {
  hotel: { name: string; address: string };
  payments: Array<{ id: number; amount: number; method: string; receipt_type: string; created_at: string }>;
  paidTotal: number;
  issuedAt: string;
}

export interface CustomerOrder {
  id: number;
  status: string;
  created_at: string;
  booking_id: number | null;
  room_label: string;
  items: Array<{ product_id: number; name: string; qty: number; unit_price: number }>;
}

export interface Report {
  period: 'day' | 'month' | 'year';
  label: string;
  received: { cash: number; qr: number; total: number };
  charges: { roomShort: number; roomOvernight: number; supplementary: number; total: number };
  bookings: number;
}
