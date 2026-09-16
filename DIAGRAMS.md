# Diagrams

Use these Mermaid diagrams for the report. GitHub can render Mermaid diagrams in Markdown preview, so you can screenshot them after pushing to GitHub.

## ERD

```mermaid
erDiagram
  PROFILES ||--o{ RESERVATIONS : submits
  FACILITIES ||--o{ RESERVATIONS : reserved_for
  PROFILES ||--o{ SERVICE_REQUESTS : creates
  FACILITIES ||--o{ SERVICE_REQUESTS : has
  PROFILES ||--o{ AUDIT_LOGS : performs

  PROFILES {
    uuid id PK
    text full_name
    user_role role
    account_status status
    timestamptz created_at
  }

  FACILITIES {
    uuid id PK
    text name
    text location
    facility_status status
    text condition
    timestamptz created_at
    timestamptz updated_at
  }

  RESERVATIONS {
    uuid id PK
    uuid facility_id FK
    uuid requester_id FK
    timestamptz start_time
    timestamptz end_time
    text purpose
    reservation_status status
    timestamptz created_at
    timestamptz updated_at
  }

  SERVICE_REQUESTS {
    uuid id PK
    uuid facility_id FK
    uuid staff_id FK
    text concern
    service_status status
    timestamptz created_at
  }

  AUDIT_LOGS {
    bigint id PK
    uuid actor_id FK
    text action
    text table_name
    uuid record_id
    jsonb old_data
    jsonb new_data
    timestamptz created_at
  }
```

## Use Case Diagram

```mermaid
flowchart LR
  Admin[Administrator]
  Staff[Facility Staff]
  Requester[Requester]

  Login((Login))
  ViewFacilities((View Facilities))
  SubmitReservation((Submit Reservation))
  ViewStatus((View Reservation Status))
  CancelOwn((Cancel Own Pending Request))
  Approve((Approve Reservation))
  Reject((Reject Reservation))
  ViewReservations((View Reservations))
  InUse((Confirm Facility In Use))
  Complete((Mark Reservation Completed))
  ServiceRequest((Create Service Request))
  UpdateFacility((Update Facility Condition))
  ManageFacilities((Manage Facilities))
  ManageUsers((Manage Users))
  Audit((View Audit Logs))

  Requester --> Login
  Requester --> ViewFacilities
  Requester --> SubmitReservation
  Requester --> ViewStatus
  Requester --> CancelOwn

  Staff --> Login
  Staff --> ViewFacilities
  Staff --> ViewReservations
  Staff --> InUse
  Staff --> Complete
  Staff --> ServiceRequest
  Staff --> UpdateFacility

  Admin --> Login
  Admin --> ViewFacilities
  Admin --> ViewReservations
  Admin --> Approve
  Admin --> Reject
  Admin --> ManageFacilities
  Admin --> ManageUsers
  Admin --> Audit
```

## Reservation Workflow

```mermaid
flowchart TD
  Submitted[Reservation Submitted] --> Pending[Pending]
  Pending --> Review[Administrator Review]
  Review --> Approved[Approved / Scheduled]
  Review --> Rejected[Rejected]
  Approved --> InUse[In Use]
  InUse --> Completed[Completed]
  Pending --> Cancelled[Cancelled]
  Approved --> Cancelled
```
