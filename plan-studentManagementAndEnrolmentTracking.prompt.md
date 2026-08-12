# Student Management Redesign, Enrolment Tracking & LMS Integration Plan

## Overview
Refactor Contact Management into Student Management, fix non-Axcelerate sync bugs and dummy ID ranges for test/local accounts (like John Doe), add an admin onboarding guard bypass, build a Student Summary Page with collapsible details and enrolment history, and set up webhook-driven enrolment sync for LSFA Central workshops.

## Research Findings & Answers

### 1. Axcelerate LMS vs. LSFA Central LMS Determination
- **Flag**: `WorkshopProgress.lmsEnabled` (Boolean, default `false`).
- **Logic**:
  - `lmsEnabled = true`: Workshop LMS journey is managed in LSFA Central.
  - `lmsEnabled = false` (or no `WorkshopProgress` record): Workshop uses Axcelerate's native LMS portal.

### 2. Enrolments vs. Workshop Progress Relationships
- In `schema.prisma`, `LmsEnrollment` connects:
  - `Contact` (`contactId`)
  - `LearningPlan` (`learningPlanId`)
  - `WorkshopProgress` (`instanceId` — Axcelerate workshop instance ID)

### 3. Non-Axcelerate User Sync Issue (John Doe)
- Test/local contacts (e.g. dummy local contacts starting at `900000000` or John Doe seeded as `9999901`) do not exist in Axcelerate.
- John Doe's current seeded ID (`9999901`) was less than `900000000`, causing boundary checks to miss it.
- We need to fix the boundary checks AND update John Doe's dummy contact ID to the `>= 900000000` range via seed script / DB update.

---

## Detailed Execution Plan

### Phase 1: Fix Axcelerate Sync Guards & Dummy Contact IDs for Local/Test Accounts
1. **Dummy Contact ID Seed & DB Fix**:
   - Update `lms.service.ts` seed logic so John Doe's contact ID is created in the `>= 900000000` range (e.g. `900009991`).
   - Run a DB update or seed script to update any existing test contacts with ID `9999901` to `>= 900000000`.
2. **Magic Link Sync (`backend/src/users/users.service.ts`)**:
   - Update `generateMagicLink` to check `axContactId > 0 && axContactId < 900000000` before invoking `this.axcelerate.updateContact`.
3. **Contact Lookup & Updates (`backend/src/contacts/contacts.service.ts`)**:
   - In `getContactForUser`, skip Axcelerate email lookup for non-Axcelerate/dummy emails.
   - Guard `updateContactById` and `updateContactForUser` to strictly enforce `axId < 900000000`.
4. **Upload Evidence Sync (`backend/src/uploads/uploads.controller.ts`)**:
   - Guard `putEnrolmentCustomField` and `putEnrolmentChecklistUrl` with `contactId > 0 && contactId < 900000000`.

### Phase 2: Student Onboarding Guard Bypass
1. **Prisma Schema (`backend/prisma/schema.prisma`)**:
   - Add `bypassOnboarding Boolean @default(false)` to the `Contact` model and generate/run migration.
2. **Backend Service (`backend/src/contacts/contacts.service.ts`)**:
   - Return `bypassOnboarding` in contact queries and accept it in update DTOs.
3. **Frontend Guard (`frontend/src/components/StudentOnboardingGuard.tsx`)**:
   - If `contactData.bypassOnboarding === true`, set `step = 'complete'` immediately to allow testing.
4. **Admin UI Toggle**:
   - Add an admin toggle switch for **Bypass Onboarding Guard** on the Student Summary Page.

### Phase 3: Frontend Navigation & Student Management Redesign
1. **Sidebar Navigation (`frontend/src/components/AppLayout.tsx`)**:
   - Rename menu link from **Contact Management** to **Student Management**.
2. **Student List Page (`frontend/src/pages/ContactsPage.tsx`)**:
   - Rename page heading to **Student Management**.
   - Change action button text from **Edit Profile** to **Edit Details**.
   - Make student's **Full Name** a clickable link navigating to `/contacts/:id` (Student Summary Page).
3. **Student Summary Page (`frontend/src/pages/ContactDetailsPage.tsx`)**:
   - Implement a two-panel layout:
     - **Left Panel (Read-Only Student Profile Summary)**:
       - Header: Full Name, Email, Mobile, USI, Linked Account status, **Edit Details** button, and **Bypass Onboarding Guard** toggle.
       - Top section: Main contact details always visible.
       - Accordion 1 (collapsible, collapsed by default): **AVETMISS Data**.
       - Accordion 2 (collapsible, collapsed by default): **Declarations**.
     - **Right Panel (Enrolment History Table)**:
       - Table listing all `LmsEnrollment` records sorted from newest to oldest (`enrolledAt` descending).
       - Columns: Course / Learning Plan, Mode, Enrolled Date, Completion Date, Score / Competency Status, Linked Workshop Instance.

### Phase 4: Dashboard Learning Cards & Enrolments Refactor
1. **Unified Enrolments Tracking**:
   - Support enrolments for both **LSFA Central LMS** (with learning plan & mode) and **Axcelerate LMS** (tracking student `contactId`, workshop `instanceId`, and `courseCode` without requiring LSFA learning plan/mode).
   - Ensure backend endpoint `GET /contacts/me/enrolments` returns all active enrolments for the logged-in student.
2. **Dynamic Dashboard Cards (`frontend/src/pages/DashboardPage.tsx`)**:
   - Fetch logged-in student's enrolments upon dashboard mount.
   - **No enrolments**: Display the default Axcelerate Online Learning Card linking to `https://lifesavingfirstaid.app.axcelerate.com/learner`.
   - **Has enrolments**: Render a dedicated card for each enrolment:
     - **LSFA LMS Enrolment (`lmsEnabled = true`)**: Show course name/code, progress, and button linking into LSFA Central LMS (`/lms/start/:enrollmentId` or `/lms`).
     - **Axcelerate LMS Enrolment (`lmsEnabled = false`)**: Show course code & workshop instance info, with button linking to Axcelerate Learner Portal.

### Phase 5: Webhook Listener Integration for Enrolments (Pending User Research / Details)
1. **Axcelerate Webhook Listener Integration (`backend/src/axcelerate/webhooks.controller.ts`)**:
   - Add listeners for student workshop booking / enrolment webhooks using payload details provided by user.
   - If the workshop instance has `lmsEnabled = true`, auto-create/link an `LmsEnrollment` record for LSFA Central LMS.
   - If `lmsEnabled = false`, create an enrolment record tracking student `contactId`, `instanceId`, and `courseCode` for Axcelerate LMS dashboard card rendering.

---

## Verification Plan

### Automated & Manual Verification
1. **Axcelerate Sync Test**:
   - Trigger contact update or magic link generation for John Doe (now re-seeded with dummy ID `>= 900000000`).
   - Verify backend logs confirm Axcelerate push is skipped without throwing errors.
2. **Onboarding Guard Bypass Test**:
   - Toggle **Bypass Onboarding Guard** on a student contact.
   - Log in as student role user and verify immediate access past onboarding guard.
3. **Student Summary & Enrolments View**:
   - Navigate to `/contacts`, verify titles/menus say **Student Management**.
   - Click student name, verify summary view with accordion sections and enrolment table sorted newest to oldest.
