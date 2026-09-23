import { test, expect } from '@playwright/test';

// API contract fixtures only. These tests exercise the real React UI in Chromium,
// but intentionally do not connect to or mutate a developer's MySQL database.
async function setup(page, { signedIn = true } = {}) {
  const departureTime = new Date(Date.now() + 86400000).toISOString().slice(0, 19);
  const user = { id: 2, name: 'Swapnil', phone: '9000000002' };
  const member = (id, userId, userName) => ({ id, userId, userName, pickup: 'VIT Main Road', initials: userName[0] });
  const state = {
    departureTime, requests: [], calls: [], matchFailures: 0, rejectJoin: false, loseJoinResponse: false, rejectCreate: false, loseCreateResponse: false,
    matches: [
      { sharedTripId: 101, destination: 'Pune Airport', departureTime, compatibilityScore: 0.91, reasons: ['Same destination', 'Similar pickup route', 'Compatible departure time'], currentMembers: 1, availableSeats: 3 },
      { sharedTripId: 102, destination: 'Pune Airport', departureTime, compatibilityScore: 0.78, reasons: ['Same destination', 'Compatible departure time'], currentMembers: 1, availableSeats: 3 }
    ],
    groups: [
      { id: 101, destinationLabel: 'Pune Airport', departureTime, totalFare: 159, status: 'FORMING', members: [member(1, 1, 'Nagesh')] },
      { id: 102, destinationLabel: 'Pune Airport', departureTime, totalFare: 159, status: 'FORMING', members: [member(3, 3, 'Tanishka')] }
    ]
  };
  state.seedRequest = (status = 'SEARCHING') => {
    state.requests.push({ id: 7, userId: 2, pickup: 'VIT Main Road', drop: 'Pune Airport', distanceKm: 12, fare: 159, departureTime, status });
  };
  if (signedIn) await page.addInitScript(() => {
    localStorage.setItem('flux_user_id', '2');
    localStorage.setItem('flux_user_name', 'Swapnil');
    localStorage.setItem('flux_role', 'USER');
  });
  await page.route('http://localhost:8080/api/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    const respond = (data, status = 200, message = 'OK') => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: status < 400, message, data }) });
    state.calls.push({ path, method });
    if (path === '/api/users/register' || path === '/api/users/login') return respond(user);
    if (path === '/api/pools/active/count') return respond(2);
    if (path === '/api/rides' && method === 'POST') {
      const body = req.postDataJSON();
      expect(body.departureTime).toBeTruthy();
      expect(body.departureTime.endsWith('Z')).toBe(false);
      const request = { ...body, id: state.requests.length + 7, status: 'SEARCHING', fare: 159 };
      state.requests.push(request); return respond(request, 201);
    }
    if (path === '/api/rides/user/2') return respond(state.requests);
    if (path === '/api/pools/user/2') return respond(state.groups.filter(g => g.members.some(m => m.userId === 2)));
    if (path.startsWith('/api/pools/matches/')) {
      if (state.matchFailures > 0) { state.matchFailures--; return respond(null, 500, 'Matches temporarily unavailable'); }
      return respond(state.matches);
    }
    const create = path.match(/^\/api\/pools\/from-request\/(\d+)$/);
    if (create && method === 'POST') {
      const request = state.requests.find(r => r.id === Number(create[1]));
      if (state.rejectCreate) return respond(null, 500, 'Unable to save group');
      if (!request || request.status !== 'SEARCHING') return respond(null, 400, 'Request is no longer SEARCHING');
      request.status = 'MATCHED';
      const group = { id: 103, destinationLabel: request.drop, departureTime: request.departureTime,
        totalFare: request.fare, status: 'FORMING', members: [member(4, 2, 'Swapnil')] };
      state.groups.push(group);
      if (state.loseCreateResponse) return route.abort('failed');
      return respond(group, 201);
    }
    const join = path.match(/^\/api\/pools\/(\d+)\/join\/(\d+)$/);
    if (join && method === 'POST') {
      if (state.rejectJoin) {
        state.matches = state.matches.filter(m => m.sharedTripId !== Number(join[1]));
        return respond(null, 400, 'Shared trip is not accepting new passengers');
      }
      const request = state.requests.find(r => r.id === Number(join[2]));
      expect(request.status).toBe('SEARCHING');
      request.status = 'MATCHED';
      const group = state.groups.find(g => g.id === Number(join[1]));
      group.members.push(member(4, 2, 'Swapnil'));
      if (state.loseJoinResponse) return route.abort('failed');
      return respond(group);
    }
    return respond(null, 404, `Unexpected test API: ${method} ${path}`);
  });
  return state;
}

async function fillPlan(page, departureTime) {
  await page.getByLabel('Pickup location').fill('VIT Main Road');
  await page.getByLabel('Destination', { exact: true }).fill('Pune Airport');
  await page.getByLabel('Departure date & time').fill(departureTime.slice(0, 16));
  await page.getByLabel('Approximate distance (km)').fill('12');
}

 test('registers a passenger and shows passenger-only navigation', async ({ page }) => {
  await setup(page, { signedIn: false });
  await page.goto('/find');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Driver login')).toHaveCount(0);
  await page.getByLabel('Your name').fill('Swapnil');
  await page.getByLabel('Phone number').fill('9000000002');
  await page.getByRole('button', { name: 'Create account →', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Same direction. Better company.' })).toBeVisible();
  await expect(page.getByText('2 active shared trips')).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Find Co-Passengers' }).click();
  await expect(page.getByRole('heading', { name: 'Find Co-Passengers', exact: true })).toBeVisible();
 });

 test('creates once, shows percentages, chooses a group, and resumes MATCHED on reload', async ({ page }) => {
  const state = await setup(page);
  const errors = []; page.on('pageerror', err => errors.push(err.message));
  await page.goto('/find');
  await fillPlan(page, state.departureTime);
  await page.getByRole('button', { name: 'Find compatible groups' }).dblclick();
  await expect(page.getByText('78% Match')).toBeVisible();
  await expect(page.getByText('91% Match')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('matches-desktop.png'), fullPage: true });
  expect(state.calls.filter(c => c.path === '/api/rides' && c.method === 'POST')).toHaveLength(1);
  expect(state.calls.filter(c => c.path.includes('/join/'))).toHaveLength(0);
  await page.reload();
  await expect(page.getByText('78% Match')).toBeVisible();
  expect(state.calls.filter(c => c.path === '/api/rides' && c.method === 'POST')).toHaveLength(1);
  await page.getByRole('button', { name: 'Join Group 102', exact: true }).click();
  await expect(page.getByText('MATCHED — you’ve joined a group.')).toBeVisible();
  await expect(page.getByText('Tanishka', { exact: true })).toBeVisible();
  await expect(page.getByText('Swapnil', { exact: true })).toBeVisible();
  expect(state.requests[0].status).toBe('MATCHED');
  expect(state.calls.filter(c => c.path.includes('/join/'))).toEqual([{ path: '/api/pools/102/join/7', method: 'POST' }]);
  await page.reload();
  await expect(page.getByText('MATCHED — you’ve joined a group.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Join Group/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'View my trips' }).click();
  await expect(page.getByText('MATCHED', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Shared trips (1)' }).click();
  await expect(page.getByText('Tanishka', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
 });

 test('blocks past departure before creating a request', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/find');
  await fillPlan(page, '2020-01-01T10:00:00');
  await page.getByRole('button', { name: 'Find compatible groups' }).click();
  await expect(page.getByRole('alert')).toContainText('future');
  expect(state.calls.some(c => c.path === '/api/rides' && c.method === 'POST')).toBe(false);
 });

 test('retries match loading without creating a duplicate request', async ({ page }) => {
  const state = await setup(page); state.seedRequest(); state.matchFailures = 1;
  await page.goto('/find?request=7');
  await expect(page.getByRole('alert')).toContainText('Matches temporarily unavailable');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('78% Match')).toBeVisible();
  expect(state.calls.some(c => c.path === '/api/rides' && c.method === 'POST')).toBe(false);
 });

 test('empty matches preserve SEARCHING and offer refresh without auto-joining', async ({ page }) => {
  const state = await setup(page); state.seedRequest(); state.matches = [];
  await page.goto('/find?request=7');
  await expect(page.getByRole('heading', { name: 'No compatible groups just yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh matches' }).click();
  await expect(page.getByText('SEARCHING', { exact: true })).toBeVisible();
  expect(state.calls.filter(c => c.method === 'POST')).toHaveLength(0);
 });

 test('rejected join removes stale group and preserves SEARCHING', async ({ page }) => {
  const state = await setup(page); state.seedRequest(); state.rejectJoin = true;
  await page.goto('/find?request=7');
  await page.getByRole('button', { name: 'Join Group 101', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not accepting');
  await expect(page.getByRole('button', { name: 'Join Group 101', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Join Group 102', exact: true })).toBeEnabled();
  expect(state.requests[0].status).toBe('SEARCHING');
 });

 test('lost successful join response recovers MATCHED rather than repeating the join', async ({ page }) => {
  const state = await setup(page); state.seedRequest(); state.loseJoinResponse = true;
  await page.goto('/find?request=7');
  await page.getByRole('button', { name: 'Join Group 101', exact: true }).click();
  await expect(page.getByText('MATCHED — you’ve joined a group.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Join Group/ })).toHaveCount(0);
  expect(state.calls.filter(c => c.path.includes('/join/'))).toHaveLength(1);
 });

 test('does not fetch matches for a request absent from this user history', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/find?request=999');
  await expect(page.getByRole('alert')).toContainText('not found in your trips');
  expect(state.calls.some(c => c.path.includes('/matches/'))).toBe(false);
 });

 test('cancelled request cannot join or fetch matches', async ({ page }) => {
  const state = await setup(page); state.seedRequest('CANCELLED');
  await page.goto('/find?request=7');
  await expect(page.getByRole('heading', { name: 'This request is no longer available for matching.' })).toBeVisible();
  expect(state.calls.some(c => c.path.includes('/matches/'))).toBe(false);
 });

 test('mobile layout fits and old pool route leads to the request form', async ({ page }) => {
  const state = await setup(page); state.seedRequest();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pool');
  await expect(page).toHaveURL(/\/find$/);
  await expect(page.getByLabel('Pickup location')).toBeVisible();
  await page.goto('/find?request=7');
  await expect(page.getByText('78% Match')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('matches-mobile.png'), fullPage: true });
 });

 test('creates a group from an empty result and restores MATCHED after reload', async ({ page }) => {
  const state = await setup(page); state.seedRequest(); state.matches = [];
  await page.goto('/find?request=7');
  await page.getByRole('button', { name: 'Create Group', exact: true }).dblclick();
  await expect(page.getByText('Group created — you’re the first passenger.')).toBeVisible();
  await expect(page.getByText('Swapnil', { exact: true })).toBeVisible();
  await expect(page.getByText('1/4 passengers', { exact: false })).toBeVisible();
  expect(state.calls.filter(c => c.path === '/api/pools/from-request/7')).toHaveLength(1);
  expect(state.calls.filter(c => c.path === '/api/pools')).toHaveLength(0);
  await page.reload();
  await expect(page.getByText('MATCHED — you’ve joined a group.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Group', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'View my trips' }).click();
  await page.getByRole('button', { name: 'Shared trips (1)' }).click();
  await expect(page.getByText('Swapnil', { exact: true })).toBeVisible();
 });

 test('creation remains an explicit choice when compatible groups already exist', async ({ page }) => {
  const state = await setup(page); state.seedRequest();
  await page.goto('/find?request=7');
  await expect(page.getByText('78% Match')).toBeVisible();
  await page.getByRole('button', { name: 'Create Group', exact: true }).click();
  await expect(page.getByText('Group created — you’re the first passenger.')).toBeVisible();
  expect(state.calls.filter(c => c.path.includes('/join/'))).toHaveLength(0);
  expect(state.groups[0].members).toHaveLength(1);
 });

 test('failed creation keeps the request searchable and allows deliberate retry', async ({ page }) => {
  const state = await setup(page); state.seedRequest(); state.matches = []; state.rejectCreate = true;
  await page.goto('/find?request=7');
  await page.getByRole('button', { name: 'Create Group', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to save group');
  await expect(page.getByRole('button', { name: 'Create Group', exact: true })).toBeEnabled();
  expect(state.requests[0].status).toBe('SEARCHING');
  expect(state.groups).toHaveLength(2);
 });

 test('lost creation response reads MATCHED and never creates a second group', async ({ page }) => {
  const state = await setup(page); state.seedRequest(); state.matches = []; state.loseCreateResponse = true;
  await page.goto('/find?request=7');
  await page.getByRole('button', { name: 'Create Group', exact: true }).click();
  await expect(page.getByText('MATCHED — you’ve joined a group.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Group', exact: true })).toHaveCount(0);
  expect(state.groups).toHaveLength(3);
  expect(state.calls.filter(c => c.path === '/api/pools/from-request/7')).toHaveLength(1);
 });
