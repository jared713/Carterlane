/**
 * End-to-end check against a running API.
 *
 *   BASE_URL=http://localhost:4000 ADMIN_PASSWORD=... node test/smoke.mjs
 *
 * It creates and then cleans up its own bookings, blocks, rates and photos.
 */
const BASE = process.env.BASE_URL || 'http://localhost:4000';
const PASSWORD = process.env.ADMIN_PASSWORD || 'letmein';

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function iso(offsetDays) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function json(method, payload, token) {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  };
}

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

async function main() {
  console.log(`Testing ${BASE}\n`);

  console.log('health & public reads');
  check('health responds ok', (await api('/health')).body?.ok === true);
  const property = await api('/api/property');
  check('property has a name', typeof property.body?.name === 'string');
  check('property exposes a base rate', property.body?.baseRate > 0);
  check('photos list is an array', Array.isArray((await api('/api/photos')).body));

  console.log('\nadmin sign-in');
  const badLogin = await api('/api/admin/login', json('POST', { password: 'nope' }));
  check('wrong password is rejected', badLogin.status === 401, `got ${badLogin.status}`);
  const login = await api('/api/admin/login', json('POST', { password: PASSWORD }));
  check('correct password returns a token', typeof login.body?.token === 'string');
  const token = login.body?.token;
  if (!token) throw new Error('Cannot continue without an admin token.');
  check(
    'admin routes reject a missing token',
    (await api('/api/admin/bookings')).status === 401,
  );
  check(
    'admin routes accept the token',
    (await api('/api/admin/bookings', auth(token))).status === 200,
  );

  console.log('\nrates');
  const rate = await api(
    '/api/admin/rates',
    json('POST', {
      name: 'Smoke test peak',
      start: iso(200),
      end: iso(203),
      nightlyRate: 400,
      minNights: 2,
      priority: 90,
    }, token),
  );
  check('rate rule is created', rate.status === 201, JSON.stringify(rate.body));
  const rateId = rate.body?.id;
  const quotedPeak = await api(
    `/api/quote?checkIn=${iso(200)}&checkOut=${iso(202)}&guests=2`,
  );
  check(
    'the rule sets the nightly price',
    quotedPeak.body?.breakdown?.every((n) => n.rate === 400),
    JSON.stringify(quotedPeak.body?.breakdown),
  );
  check(
    'accommodation total matches the nights',
    quotedPeak.body?.accommodation === 800,
    String(quotedPeak.body?.accommodation),
  );
  check(
    'total adds the cleaning fee',
    quotedPeak.body?.total === 800 + quotedPeak.body?.cleaningFee,
  );

  const rejectShort = await api(
    `/api/quote?checkIn=${iso(200)}&checkOut=${iso(201)}&guests=2`,
  );
  check(
    'a stay under the minimum is flagged',
    rejectShort.body?.errors?.some((e) => e.includes('Minimum stay')),
    JSON.stringify(rejectShort.body?.errors),
  );

  console.log('\nblocking and re-opening dates');
  const block = await api(
    '/api/admin/blocks',
    json('POST', { start: iso(300), end: iso(302), reason: 'Smoke test' }, token),
  );
  check('block is created', block.status === 201, JSON.stringify(block.body));
  const blocked = await api(`/api/availability?from=${iso(299)}&to=${iso(303)}`);
  check(
    'blocked nights show as unavailable',
    [iso(300), iso(301), iso(302)].every((d) => blocked.body?.unavailable.includes(d)),
    JSON.stringify(blocked.body?.unavailable),
  );
  check(
    'nights either side stay open',
    !blocked.body?.unavailable.includes(iso(299)) &&
      !blocked.body?.unavailable.includes(iso(303)),
  );
  const blockedQuote = await api(
    `/api/quote?checkIn=${iso(300)}&checkOut=${iso(303)}&guests=2`,
  );
  check('a quote over blocked nights is unavailable', blockedQuote.body?.available === false);
  const blockedBooking = await api(
    '/api/bookings',
    json('POST', {
      checkIn: iso(300),
      checkOut: iso(302),
      guests: 2,
      name: 'Blocked Guest',
      email: 'blocked@example.com',
    }, token),
  );
  check('booking blocked nights is refused', blockedBooking.status === 409,
    `got ${blockedBooking.status}`);

  // Re-open the middle night only; the block should split around it.
  const opened = await api(
    '/api/admin/blocks/open',
    json('POST', { start: iso(301), end: iso(301) }, token),
  );
  check('re-open reports the block it touched', opened.body?.blocksTouched === 1);
  const afterOpen = await api(`/api/availability?from=${iso(299)}&to=${iso(303)}`);
  check(
    'the re-opened night is bookable again',
    !afterOpen.body?.unavailable.includes(iso(301)),
    JSON.stringify(afterOpen.body?.unavailable),
  );
  check(
    'the nights either side stay blocked',
    afterOpen.body?.unavailable.includes(iso(300)) &&
      afterOpen.body?.unavailable.includes(iso(302)),
  );

  console.log('\nbooking');
  const bad = await api(
    '/api/bookings',
    json('POST', { checkIn: iso(400), checkOut: iso(402), guests: 2, name: 'A', email: 'not-an-email' }),
  );
  check('invalid details are rejected', bad.status === 400);
  const past = await api(
    '/api/bookings',
    json('POST', { checkIn: iso(-3), checkOut: iso(-1), guests: 2, name: 'Past Guest', email: 'p@example.com' }),
  );
  check('a past check-in is rejected', past.status === 400);
  const tooMany = await api(
    '/api/bookings',
    json('POST', { checkIn: iso(400), checkOut: iso(402), guests: 19, name: 'Crowd', email: 'c@example.com' }),
  );
  check('too many guests is rejected', tooMany.status === 400);

  // Every booking check below is meaningless once the limiter starts refusing,
  // and a wall of failures hides the one real cause. Say it once and stop.
  if (tooMany.status === 429 || past.status === 429) {
    console.log(
      '\nFAIL  the booking rate limit is exhausted.\n' +
        '      This suite makes several bookings per run. Either wait for the\n' +
        '      window to pass, or start the API with a higher BOOKING_RATE_LIMIT.',
    );
    process.exit(1);
  }

  const booking = await api(
    '/api/bookings',
    json('POST', {
      checkIn: iso(400),
      checkOut: iso(403),
      guests: 2,
      name: 'Smoke Tester',
      email: 'smoke@example.com',
      phone: '07000 000000',
      message: 'Automated test booking.',
    }),
  );
  check('booking is created', booking.status === 201, JSON.stringify(booking.body));
  check('booking gets a reference', /^CL-[A-Z0-9]{6}$/.test(booking.body?.reference || ''));
  check('booking records three nights', booking.body?.nights === 3);
  check('booking starts pending', booking.body?.status === 'pending');

  const clash = await api(
    '/api/bookings',
    json('POST', {
      checkIn: iso(402),
      checkOut: iso(405),
      guests: 2,
      name: 'Second Tester',
      email: 'second@example.com',
    }),
  );
  check('an overlapping booking is refused', clash.status === 409, `got ${clash.status}`);

  const backToBack = await api(
    '/api/bookings',
    json('POST', {
      checkIn: iso(403),
      checkOut: iso(405),
      guests: 2,
      name: 'Back To Back',
      email: 'btb@example.com',
    }),
  );
  check(
    'a stay starting on the previous check-out day is allowed',
    backToBack.status === 201,
    JSON.stringify(backToBack.body),
  );

  const listed = await api('/api/admin/bookings', auth(token));
  const created = listed.body?.find((b) => b.reference === booking.body.reference);
  check('the booking appears in the admin list', Boolean(created));
  check('guest email is stored', created?.guest_email === 'smoke@example.com');

  const confirmed = await api(
    `/api/admin/bookings/${created.id}`,
    json('PATCH', { status: 'confirmed', adminNote: 'Smoke test', notify: false }, token),
  );
  check('booking can be confirmed', confirmed.body?.status === 'confirmed');
  const cancelled = await api(
    `/api/admin/bookings/${created.id}`,
    json('PATCH', { status: 'cancelled', notify: false }, token),
  );
  check('booking can be cancelled', cancelled.body?.status === 'cancelled');
  const freed = await api(`/api/availability?from=${iso(400)}&to=${iso(402)}`);
  check(
    'cancelling frees the nights',
    freed.body?.unavailable.length === 0,
    JSON.stringify(freed.body?.unavailable),
  );

  console.log('\nphotos');
  // A 1x1 PNG is enough to exercise upload, processing and serving.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const form = new FormData();
  form.append('photos', new Blob([png], { type: 'image/png' }), 'test-flat.png');
  const upload = await api('/api/admin/photos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  check('photo uploads', upload.status === 201, JSON.stringify(upload.body));
  const photoId = upload.body?.[0]?.id;
  const file = await fetch(`${BASE}/api/photos/${photoId}/file`);
  check('photo bytes are served', file.ok && Number(file.headers.get('content-length')) > 0);
  check(
    'photo is cached immutably',
    (file.headers.get('cache-control') || '').includes('immutable'),
  );
  const captioned = await api(
    `/api/admin/photos/${photoId}`,
    json('PATCH', { caption: 'The living room' }, token),
  );
  check('caption can be set', captioned.body?.caption === 'The living room');
  check(
    'photo appears in the public gallery',
    (await api('/api/photos')).body?.some((p) => p.id === photoId),
  );

  const rejectedType = new FormData();
  rejectedType.append('photos', new Blob([Buffer.from('nope')], { type: 'text/plain' }), 'x.txt');
  const badType = await api('/api/admin/photos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: rejectedType,
  });
  check('non-images are rejected', badType.status === 415, `got ${badType.status}`);

  console.log('\ncleanup');
  const cleanup = [
    api(`/api/admin/photos/${photoId}`, { method: 'DELETE', ...auth(token) }),
    api(`/api/admin/rates/${rateId}`, { method: 'DELETE', ...auth(token) }),
    api(`/api/admin/blocks/open`, json('POST', { start: iso(300), end: iso(302) }, token)),
  ];
  const results = await Promise.all(cleanup);
  check('test fixtures removed', results.every((r) => r.status < 400));
  for (const ref of [booking.body?.reference, backToBack.body?.reference]) {
    if (!ref) continue;
    const all = await api('/api/admin/bookings', auth(token));
    const row = all.body?.find((b) => b.reference === ref);
    if (row) {
      await api(
        `/api/admin/bookings/${row.id}`,
        json('PATCH', { status: 'cancelled', notify: false }, token),
      );
    }
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
