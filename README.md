# Role-Based Facility Reservation and Approval System

This project is a GitHub Pages + Supabase implementation for Laboratory 4 - Section B.

## Setup

1. Create or open the Supabase project.
2. Open Supabase SQL Editor.
3. Paste and run `supabase-final-schema.sql`.
4. Open `app.js` and confirm the Supabase URL and publishable key are correct.
5. Create three test accounts in Supabase Authentication:
   - Administrator account with role `admin`
   - Facility Staff account with role `staff`
   - Requester account with role `requester`
6. Push the files to GitHub.
7. In GitHub, go to Settings > Pages.
8. Set source to the main branch and root folder.
9. Open the GitHub Pages URL.

## Test Accounts

The system needs three accounts to test role-based access:

| Account Type | Role Value |
|---|---|
| Administrator | `admin` |
| Facility Staff | `staff` |
| Requester | `requester` |

Roles are stored in the `profiles` table. The complete database setup is already included in `supabase-final-schema.sql`.

## How To Test

1. Login as requester and submit a reservation.
2. Login as admin and approve or reject the reservation.
3. Login as staff and mark the scheduled reservation as In Use, then Completed.
4. Login as admin and view Audit Logs.
5. Login as requester and verify that Users and Audit Logs are hidden.

## Required submission files

- GitHub repository URL
- Live GitHub Pages URL
- Updated ERD and Use Case Diagram
- Role-permission matrix
- Reservation workflow
- Business rules
- Audit-log screenshot
- Functional test results

Use `SUBMISSION-GUIDE.md` for copy-ready documentation.
