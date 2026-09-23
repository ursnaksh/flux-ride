# FLUX RIDE

A student co-passenger matching project built with Java 17, Spring Boot, MySQL, React and Vite.

## Current state

Trip Request → compatible shared trips → compatibility score and reasons → user chooses a group → explicit join → MATCHED.

External Uber/Ola/auto/cab booking is a separate user action. This project does not provide drivers or book transport.

The backend supports destination, pickup-word similarity and departure-time matching, membership validation, duplicate protection and a transactional SEARCHING → MATCHED transition. The frontend now supports passenger registration/login, a request form with departure time, percentage match cards and reasons, explicit group joining or creation, and request/shared-trip history. Saved request URLs reload their state from the backend.

This is a clean source snapshot of the reviewed project. Earlier local Git history, bundled dependencies, generated output and embedded database credentials are intentionally excluded. Keep the old local project as a history backup.

## Backend setup (PowerShell)

Install Java 17 and MySQL. For an existing working development database, keep the same database and account; cloning this repository does not change it. For a new database, run `backend/database/create-fluxdb.sql` as an administrator and configure an application user with access to `fluxdb` separately.

From the repository root:

```powershell
cd backend
$env:DB_USERNAME = Read-Host "Your local MySQL username"
$credential = Get-Credential -UserName $env:DB_USERNAME -Message "Enter your local MySQL password"
$env:DB_PASSWORD = $credential.GetNetworkCredential().Password
.\gradlew.bat bootRun
```

The app reads the password from the current terminal's environment. Repeat the setup in a new terminal. Do not commit your password. No `.env` loader is installed. The default database is local `fluxdb`; set `DB_URL` only when using another database location. Never point automated tests or schema-update development runs at a production database.

## Tests

```powershell
cd backend
.\gradlew.bat compileJava test --no-daemon
```

The lifecycle suite uses isolated H2 and real HTTP requests. It covers create → discover → join, rejection of reused or expired requests, transaction rollback, and simultaneous creation from the same request. It explicitly overrides the datasource, including the password; it does not need MySQL credentials. The reviewed predecessor built successfully on the owner's machine. The owner also confirmed MATCHED after joining and restart, and unchanged SEARCHING/membership after an incompatible attempt. The new creation flow compiled and passed 18 HTTP/JPA lifecycle cases against H2 in the assistant environment. This run preloaded the cached Byte Buddy agent through a local Gradle init script for the container; no project build settings were changed. The new creation flow still needs a live MySQL check on the owner’s machine.

## Frontend

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

The committed lockfile fixes dependency resolution. Open the Vite URL printed in the terminal (normally http://localhost:5173). Keep the backend running on port 8080 in another terminal. Optionally set `VITE_API_BASE_URL` in a local `frontend/.env.local` when using a different backend address.

The form saves a request, then displays compatible existing groups. Passengers can choose Join Group or Create Group. Creation uses the saved request details, adds the creator as the first passenger, and changes the request to MATCHED in one transaction. It always creates a new group, even when compatible groups exist. No-match results keep the request SEARCHING until the passenger chooses an action. The frontend does not call the legacy automatic join/create API.

### Browser tests

```powershell
cd frontend
npx playwright install chromium
npm run test:e2e
```

All 14 Chromium tests passed, and the frontend production build passed. These Chromium tests use API contract fixtures named Nagesh, Swapnil and Tanishka. They cover joining, deliberate group creation, duplicate clicks, reload persistence, and recovery after a lost response without touching MySQL; they are not live Spring/MySQL integration tests.

## API used by the new frontend

| Action | Endpoint |
| --- | --- |
| Create request (includes future departureTime) | POST /api/rides |
| Find compatible groups | GET /api/pools/matches/{tripRequestId} |
| Create group from saved request | POST /api/pools/from-request/{tripRequestId} |
| Join selected group | POST /api/pools/{sharedTripId}/join/{tripRequestId} |
| Request history/status | GET /api/rides/user/{userId} |
| Joined groups | GET /api/pools/user/{userId} |

Show scores as `Math.round(compatibilityScore * 100) + "% Match"`; 0.78 becomes 78% Match.

## Known scope limits

This is a student prototype. User IDs are not authenticated ownership checks. Creation and explicit joining lock the request row so concurrent attempts cannot consume the same request twice. Group capacity and duplicate-member races involving different requests are not protected by group row locks or database uniqueness constraints. Leaving does not restore a linked request to SEARCHING. Legacy automatic join/create still exists. Pickup matching uses words, not geographic routing, and fares are estimates rather than live provider quotes.
