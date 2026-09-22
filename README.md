# FLUX RIDE

A student co-passenger matching project built with Java 17, Spring Boot, MySQL, React and Vite.

## Current state

Trip Request → compatible shared trips → compatibility score and reasons → user chooses a group → explicit join → MATCHED.

External Uber/Ola/auto/cab booking is a separate user action. This project does not provide drivers or book transport.

The backend supports destination, pickup-word similarity and departure-time matching, membership validation, duplicate protection and a transactional SEARCHING → MATCHED transition. The frontend is still the legacy UI; Find Co-Passengers is the next development step. Some old frontend routes do not match the current backend yet.

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

The lifecycle suite uses isolated H2 and real HTTP requests. It explicitly overrides the datasource, including the password; it does not need MySQL credentials. The reviewed predecessor built successfully on the owner's machine. The owner also confirmed MATCHED after joining and restart, and unchanged SEARCHING/membership after an incompatible attempt. The credential-only public setup change has not been run against MySQL in the assistant environment.

## Frontend

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

The committed lockfile fixes dependency resolution. Backend API integration in the legacy screens remains to be updated.

## API used by the new frontend

| Action | Endpoint |
| --- | --- |
| Create request (includes future departureTime) | POST /api/rides |
| Find compatible groups | GET /api/pools/matches/{tripRequestId} |
| Join selected group | POST /api/pools/{sharedTripId}/join/{tripRequestId} |
| Request history/status | GET /api/rides/user/{userId} |
| Joined groups | GET /api/pools/user/{userId} |

Show scores as `Math.round(compatibilityScore * 100) + "% Match"`; 0.78 becomes 78% Match.

## Known scope limits

This is a student prototype. User IDs are not authenticated ownership checks. Concurrent join races are not protected by row locks or database uniqueness constraints. Leaving does not restore a linked request to SEARCHING. Legacy automatic join/create still exists. Pickup matching uses words, not geographic routing, and fares are estimates rather than live provider quotes.
