
# Caledar Api 
This Project is meant for Calendar Api with Recurrence Ability with Daily, Weekly and Monthly recurrence Options. 

## Installing 
```bash
npm install
```

## Running, Building, Development & Testing

This project uses the following npm scripts defined in `package.json`:

| Script      | Command                          | Description                                         |
|-------------|---------------------------------|-----------------------------------------------------|
| `npm run build` | `tsc`                          | Compiles the TypeScript source files to JavaScript in `dist/` folder. |
| `npm start` | `node dist/server.js`            | Runs the compiled production server.                |
| `npm run dev` | `nodemon --watch src --exec ts-node src/server.ts` | Runs the server in development mode with automatic reload on source changes using `nodemon` and `ts-node`. |
| `npm test`  | `jest --verbose --runInBand`    | Runs the Jest test suite with detailed output and runs tests sequentially (recommended for MongoDB stability). |

---




## Test User Roles and Headers

- **Regular User 1**: `{ "x-user-id": "user1", "x-user-admin": "false" }`
- **Regular User 2**: `{ "x-user-id": "user2", "x-user-admin": "false" }`
- **Admin User**: `{ "x-user-id": "admin", "x-user-admin": "true" }`

Tests check role-based access control by using these headers in requests.

---

## Test Cases Breakdown

### 1. Create a Weekly Recurring Event

- **Endpoint**: `POST /api/events`
- **Payload**: Event details with a weekly recurrence rule (freq=WEEKLY)
- **Assertions**:
  - Status 201 Created
  - Response contains a `recurrenceRule`
  - Stores event ID for further tests

### 2. Create a Single (Non-Recurring) Event

- **Endpoint**: `POST /api/events`
- **Payload**: Event details without recurrence
- **Assertions**:
  - Status 201 Created
  - Stores event ID for later use

### 3. Fetch Events in a Date Range

- **Endpoint**: `GET /api/myevents?start=...&end=...`
- **Assertions**:
  - Status 200 OK
  - Returns an array of event occurrences
  - Checks that occurrences are returned (length > 0)

### 4. Generate Occurrences in Range

- Similar to test #3, confirming multiple occurrences returned for recurring event.

### 5. Update a Single Occurrence (`thisEvent` update)

- **Endpoint**: `PUT /api/events/:id?updateType=thisEvent`
- **Payload**: Changes for a specific occurrence date (e.g., reschedule)
- **Assertions**:
  - Status 200 OK
  - Event document stores the exception with matching date

### 6.Update the event with `thisAndFollowing` Update

- **Endpoint**: `PUT /api/events/:id?updateType=thisAndFollowing`
- **Payload**: New recurrence rule starting from a cutoff occurrence
- **Assertions**:
  - Status 200 OK
  - A new event document is created (series split)
  - Total events count increases

### 7 & 8. Authorization Checks: Non-owner, Non-admin Updates Forbidden

- Attempts to update `thisEvent` and `thisAndFollowing` by user who is not owner/admin
- **Assertions**:
  - Status 403 Forbidden
  - Event data remains unchanged for unauthorized user

### 9. Delete a Single Occurrence (`thisEvent` deletion)

- **Endpoint**: `DELETE /api/events/:id?deleteType=thisEvent&occurrenceDate=...`
- **Assertions**:
  - Status 200 OK
  - Exception with `isDeleted` flag is stored in the event

### 10. Admin Can Delete Entire Series

- **Endpoint**: `DELETE /api/events/:id?deleteType=allEvents`
- **Assertions**:
  - Status 200 OK
  - Event document removed from database

### 11. Prevent Non-owner, Non-admin from Deleting Entire Series

- **Assertions**:
  - Status 403 Forbidden

### 12. Return 404 for Invalid Event ID

- **Assertions**:
  - Status 404 Not Found

---



## ✅ Test Run Summary

- ✅ creates a weekly recurring event (107 ms)  
- ✅ creates a single (non-recurring) event (9 ms)  
- ✅ fetches my events in a date range (25 ms)  
- ✅ generates occurrences in a range (12 ms)  
- ✅ creates an exception override for a single occurrence (`thisEvent`) (20 ms)  
- ✅ splits series with `thisAndFollowing` (67 ms)  
- ✅ Update a single occurrence (`thisEvent`) for Non-user and Non-admin should return forbidden (14 ms)  
- ✅ Update event with `thisAndFollowing` using Non-user and Non-admin should return forbidden (8 ms)  
- ✅ deletes a single occurrence (`thisEvent`) (16 ms)  
- ✅ admin can delete entire series (12 ms)  
- ✅ prevents non-owner, non-admin from deleting (7 ms)  
- ✅ returns 404 for invalid eventId (5 ms)  
- ✅ returns 404 for invalid eventId (4 ms)
- ✅ returns 400 for invalid eventId format on delete (4 ms)
- ✅ returns 400 for invalid eventId format on update (4 ms)
- ✅ returns 400 if required occurrenceDate missing for thisEvent delete (17 ms)

**Test Suites:** 1 passed, 1 total  
**Tests:** 12 passed, 12 total  
**Snapshots:** 0 total  
**Time:** 6.584 s  

## Running the Tests

1. Ensure your MongoDB test instance is running and accessible.
2. Set the environment variable `MONGO_URI` to your test database URI.
3. Run the test command:

```bash
npm run test
# or
jest --runInBand
```

## API Documentation with Swagger UI

This project serves interactive API documentation using **Swagger UI** integrated directly into the Express server.

### How It Works

- The OpenAPI spec is written in `swagger.yaml`.
- We use `swagger-ui-express` and `yamljs` packages to serve the docs at `/docs` endpoint.
- This lets anyone visiting `http://localhost:3000/docs` explore and test API endpoints interactively.
- Start by clicking Authorize and put user1 