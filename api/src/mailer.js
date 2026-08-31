import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, OWNER_EMAIL } = process.env;

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  const port = Number(SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
} else {
  console.warn('SMTP is not configured — booking emails will be logged, not sent.');
}

function money(amount, currency) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

async function send({ to, subject, text }) {
  if (!to) return;
  if (!transporter) {
    console.log(`[email skipped] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  try {
    await transporter.sendMail({ from: MAIL_FROM || SMTP_USER, to, subject, text });
  } catch (err) {
    // A mail failure must never lose a booking that is already committed.
    console.error('Failed to send email:', err.message);
  }
}

export async function notifyNewBooking(booking, property) {
  const summary = [
    `Reference: ${booking.reference}`,
    `Dates: ${booking.check_in} to ${booking.check_out} (${booking.nights} nights)`,
    `Guests: ${booking.guests}`,
    `Name: ${booking.guest_name}`,
    `Email: ${booking.guest_email}`,
    `Phone: ${booking.guest_phone || '—'}`,
    `Total: ${money(Number(booking.total), booking.currency)}`,
    booking.message ? `\nMessage:\n${booking.message}` : '',
  ].join('\n');

  await send({
    to: OWNER_EMAIL || property.contact_email,
    subject: `New booking request ${booking.reference} — ${booking.check_in}`,
    text: `A new booking request has come in.\n\n${summary}\n\nConfirm or decline it in the admin area.`,
  });

  await send({
    to: booking.guest_email,
    subject: `We have your request for ${property.name} (${booking.reference})`,
    text:
      `Hello ${booking.guest_name},\n\n` +
      `Thank you — we have your request for ${property.name}. These dates are held ` +
      `while we confirm them, and you will hear from us shortly.\n\n${summary}\n\n` +
      `No payment is taken online; we will send payment details with your confirmation.\n\n` +
      `${property.name}`,
  });
}

export async function notifyBookingStatus(booking, property) {
  const confirmed = booking.status === 'confirmed';
  await send({
    to: booking.guest_email,
    subject: confirmed
      ? `Your stay at ${property.name} is confirmed (${booking.reference})`
      : `Your booking request ${booking.reference} could not be confirmed`,
    text: confirmed
      ? `Hello ${booking.guest_name},\n\nYour stay is confirmed.\n\n` +
        `Reference: ${booking.reference}\n` +
        `Arrive: ${booking.check_in} from ${property.check_in_time}\n` +
        `Depart: ${booking.check_out} by ${property.check_out_time}\n` +
        `Total: ${money(Number(booking.total), booking.currency)}\n\n` +
        `We will be in touch with payment and arrival details.\n\n${property.name}`
      : `Hello ${booking.guest_name},\n\nUnfortunately we cannot confirm ` +
        `${booking.check_in} to ${booking.check_out}. Do get in touch if other ` +
        `dates would suit.\n\n${property.name}`,
  });
}
