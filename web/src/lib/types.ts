export type Property = {
  name: string;
  tagline: string;
  description: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  minNights: number;
  maxNights: number;
  baseRate: number;
  fromRate: number;
  cleaningFee: number;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  amenities: string[];
  contactEmail: string;
  contactPhone: string;
};

export type Photo = {
  id: number;
  caption: string;
  width: number | null;
  height: number | null;
  url: string;
};

export type RateWindow = {
  id: number;
  name: string;
  start: string;
  end: string;
  nightlyRate: number;
  minNights: number | null;
  priority: number;
};

export type Availability = {
  from: string;
  to: string;
  unavailable: string[];
  ranges: { start: string; end: string }[];
  baseRate: number;
  currency: string;
  minNights: number;
  maxNights: number;
  maxGuests: number;
  cleaningFee: number;
  rates: RateWindow[];
};

export type Quote = {
  checkIn: string;
  checkOut: string;
  nights: number;
  breakdown: { night: string; rate: number; rule: { id: number; name: string } | null }[];
  accommodation: number;
  cleaningFee: number;
  total: number;
  averageNightly: number;
  currency: string;
  minNights: number;
  available: boolean;
  conflicts: string[];
  errors: string[];
};

export type BookingConfirmation = {
  reference: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  total: number;
  currency: string;
};

export type AdminBooking = {
  id: number;
  reference: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  check_in: string;
  check_out: string;
  guests: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  message: string;
  nights: number;
  accommodation: number;
  cleaning_fee: number;
  total: number;
  currency: string;
  admin_note: string;
  created_at: string;
};

export type AdminBlock = {
  id: number;
  start_night: string;
  end_night: string;
  reason: string;
};

export type AdminRate = {
  id: number;
  name: string;
  start_night: string;
  end_night: string;
  nightly_rate: number;
  min_nights: number | null;
  priority: number;
};

export type AdminPhoto = {
  id: number;
  filename: string;
  caption: string;
  position: number;
  width: number | null;
  height: number | null;
  byte_size: number;
  url: string;
};

export type AdminCalendar = {
  from: string;
  to: string;
  nights: {
    night: string;
    reason: 'blocked' | 'booked';
    label: string;
    bookingId?: number;
    reference?: string;
  }[];
  blocks: AdminBlock[];
  bookings: {
    id: number;
    reference: string;
    status: string;
    check_in: string;
    check_out: string;
    guest_name: string;
    guests: number;
    total: number;
  }[];
};
