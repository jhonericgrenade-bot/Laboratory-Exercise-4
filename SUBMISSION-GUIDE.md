# Laboratory 4 - Section B Submission Guide

## 1. Role-Permission Matrix

| Function | Administrator | Facility Staff | Requester |
|---|---:|---:|---:|
| Manage facilities | Yes | Update condition/status only | No |
| Manage users | Yes | No | No |
| View facilities | Yes | Yes | Yes |
| Submit reservation | No | No | Yes |
| Approve reservation | Yes | No | No |
| Reject reservation | Yes | No | No |
| View reservations | Yes | Yes | Own only |
| Confirm In Use | Yes | Yes | No |
| Mark Completed | Yes | Yes | No |
| Create service request | Yes | Yes | No |
| View audit logs | Yes | No | No |
| Cancel eligible own request | No | No | Yes |

## 2. Reservation Workflow

## Test Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| Administrator | admin@gmail.com | `123456` | `admin` |
| Facility Staff | staff@gmail.com | `123456` | `staff` |
| Requester | requester@gmail.com | `123456` | `requester` |

These are demo accounts for checking the role-based features. They must not be used for real or sensitive data.

Submitted -> Pending -> Administrator Review -> Approved or Rejected

If approved:

Approved -> Scheduled -> In Use -> Completed

Other final status:

Pending or Scheduled -> Cancelled

## 3. Business Rules

| ID | Rule | System Control |
|---|---|---|
| BR-B4-01 | Only active facilities may be reserved. | Facility status is checked before saving. |
| BR-B4-02 | Reservation start must precede end time. | Start and end datetime validation. |
| BR-B4-03 | Overlapping approved schedules are prohibited. | Conflict check for Approved, Scheduled, and In Use reservations. |
| BR-B4-04 | Only Administrator may approve reservations. | Role check before approve/reject action. |
| BR-B4-05 | Rejected reservations cannot become Scheduled. | Status transition validation. |
| BR-B4-06 | Approved reservations reserve the time slot. | Approved/Scheduled slots are included in conflict checking. |
| BR-B4-07 | Completed reservations cannot be edited. | Completed records are locked. |
| BR-B4-08 | Facilities under Maintenance cannot be reserved. | Maintenance status is blocked. |
| BR-B4-09 | Requesters may modify only their own Pending requests. | Ownership and status validation. |
| BR-B4-10 | Approval and status changes must be logged. | Audit log trigger or app log is created. |

## 4. ERD Entities

Use these entities in your ERD:

| Entity | Main Fields |
|---|---|
| profiles | id, full_name, role, status, created_at |
| facilities | id, name, location, status, condition, created_at, updated_at |
| reservations | id, facility_id, requester_id, start_time, end_time, purpose, status |
| service_requests | id, facility_id, staff_id, concern, status, created_at |
| audit_logs | id, actor_id, action, table_name, record_id, old_data, new_data, created_at |

Relationships:

- profiles 1 to many reservations
- facilities 1 to many reservations
- profiles 1 to many service_requests
- facilities 1 to many service_requests
- profiles 1 to many audit_logs

## 5. Use Case Diagram Content

Actors:

- Administrator
- Facility Staff
- Requester

Use cases:

- Login
- View Facilities
- Submit Reservation
- Cancel Own Reservation
- View Reservation Status
- Approve Reservation
- Reject Reservation
- View Reservations
- Confirm Facility Usage
- Mark Reservation Completed
- Create Service Request
- Update Facility Condition
- Manage Users
- Manage Facilities
- View Audit Logs

## 6. Functional Test Results

| Test ID | Scenario | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| TC-B4-01 | Requester submits reservation | Saved as Pending | Saved as Pending | Passed |
| TC-B4-02 | Submit overlapping schedule | Conflict detected and blocked | Conflict detected and blocked | Passed |
| TC-B4-03 | Administrator approves request | Status becomes Approved/Scheduled | Status becomes Scheduled | Passed |
| TC-B4-04 | Administrator rejects request | Status becomes Rejected | Status becomes Rejected | Passed |
| TC-B4-05 | Staff marks facility In Use | Status updated | Status updated | Passed |
| TC-B4-06 | Staff completes reservation | Status becomes Completed | Status becomes Completed | Passed |
| TC-B4-07 | Requester edits another user request | Blocked | Blocked by ownership rule | Passed |
| TC-B4-08 | Reserve facility under maintenance | Blocked | Blocked | Passed |
| TC-B4-09 | Check audit log | Approval/status log visible | Log visible in Audit Logs | Passed |
| TC-B4-10 | Open protected page without login | Access denied | Access denied for non-admin role | Passed |

## 7. Suggested Screenshots

Take screenshots of:

1. Facilities page showing Active and Maintenance facilities.
2. Requester reservation form.
3. Admin approval action.
4. Staff In Use or Completed action.
5. Audit Logs page.
6. Supabase table data.

## 8. Short Explanation

The system implements role-based access control for Administrator, Facility Staff, and Requester users. Requesters can submit reservation requests, while Administrators review and approve or reject them. Approved reservations protect the facility schedule from overlapping bookings. Facility Staff can confirm actual usage and completion. Critical actions are recorded in the audit log for accountability.
