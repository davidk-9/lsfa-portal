# LMS & Student Management Integration Plan - Next Tranche

## Tranche Plan & Backlog

### Item 1: Learning Plan Assignment Selector in Admin Calendar Modal
1. **Admin Calendar Workshop Progress Modal (`WorkshopProgressModal`)**:
   - Add a dropdown selector allowing admins to assign/change the `LearningPlan` (`learningPlanId`) on a `WorkshopProgress` record.
   - Populate the selector with available published/active `LearningPlan` versions matching that workshop's course code.
   - Saving updates both `lmsEnabled` and `learningPlanId` on `WorkshopProgress` in LSFA Central.

### Item 2: Student Enrolment Detail Modal & Learning Plan Selector
1. **Student Summary Page Course Enrolments Table (`frontend/src/pages/ContactDetailsPage.tsx`)**:
   - Add an action button/link (e.g. `[...]`) on each row of the student's Course Enrolments table.
   - Clicking this action opens an **Enrolment Details Modal** displaying all fields of that `LmsEnrollment` record (Enrolment ID, Student Contact ID, Workshop Instance ID, Course Code, Axcelerate Status, Enrolled Date, Completion Date, Mode, Score, Competency Status, and assigned Learning Plan).
   - In this modal, allow admins to assign or update the `LearningPlan` (`learningPlanId`) directly on the `LmsEnrollment` record via a dropdown selector:
     - If the enrolment is attached to a workshop instance, filter available published/active `LearningPlan`s by that workshop's course code.
     - If no workshop instance is attached, list all published/active `LearningPlan`s across all course codes.
   - Saving updates the `LmsEnrollment` record in the database.

### Item 3: Knowledge Evidence (KE) Multi-Course Code & Multi-KE Mapping (COMPLETED)
1. **KE Multi-Course Code Linkage**:
   - Updated KE editor modal (`LmsAdminPage.tsx`) to allow multi-select checkbox mapping across all Course Codes (`HLTAID009`, `HLTAID011`, etc.).
   - Supported many-to-many relationship between `LmsKnowledgeEvidence` and `CourseCode`.
2. **Multi-KE Mapping for Blobs & Questions**:
   - Updated database schema, backend DTOs, and controllers (`lms-admin.service.ts`, `lms-admin.controller.ts`) so Content Blobs (`LmsLearningBlob`) and Questions (`LmsQuestion`) link to multiple KEs (`knowledgeEvidences LmsKnowledgeEvidence[]`).
   - Updated UI modals to support multi-checkbox KE selection and display KE badges in list views.

### Item 4: Decouple Chapters/Blobs & Link to Learning Plan Master Container (COMPLETED)
1. **Decoupled Chapters**:
   - Made `courseCodeId` optional (`Int?`) on `LmsChapter` so Chapters and Learning Blobs can exist independently or be reused across units.
2. **Learning Plan Master Container Integration**:
   - Created `LearningPlanChapter` join table in database schema and updated `lms-admin.service.ts` & `lms-admin.controller.ts` with `setPlanChapters()`.
   - Updated `LearningPlan` to act as the master container that holds ordered **Chapters/Blobs** and **Questions**.
   - Updated LMS Admin UI modal (`LmsAdminPage.tsx`) so admins select and order Chapters/Blobs directly when creating or editing a Learning Plan Version.
   - Updated `lms.service.ts` (`getEnrollmentContent`) so enrolled students load the exact ordered chapters assigned to their learning plan.

### Item 5: Question Bank Specialized Editors (Types 1-7) & Question Versioning (COMPLETED)
1. **Type-Specific Visual Question Editors (`LmsAdminPage.tsx`)**:
   - **Type 1 (Multiple Choice Single)**: Dynamic option rows + radio button picker for correct answer.
   - **Type 2 (Multiple Choice Multiple)**: Dynamic option rows + checkbox pickers for correct answers.
   - **Type 3 (Sequence / Ordering)**: Dynamic item list + ▲ Up / ▼ Down buttons to re-order into target correct sequence.
   - **Type 4 (Term & Definition Matching)**: Two-column builder pairing Term & Definition inputs.
   - **Type 5 (Fill in Blanks)**: Interactive sentence template editor + visual Blank Configurator for `{0}`, `{1}`, etc., with dropdown choices and correct answer selector.
   - **Type 6 (Short Answer / AI Vector)**: Question prompt, minimum word count, required evaluation keywords, and AI Benchmark Model Answer.
   - **Type 7 (Observation Checklist / Form Assessment)**: Form field builder defining field labels, field keys, input types (`text`, `textarea`, `date`, `checkbox`), and required flags.
2. **Multi-KE Tagging**:
   - Integrated multi-select KE checkboxes across all 7 question types.
3. **Question Versioning & Assessment Protection**:
   - `lms-admin.service.ts` tracks if a question is assigned to `PUBLISHED` Learning Plans.
   - Questions on published plans show a `🔒 Locked (Published)` badge in the Question Bank table.
   - Editing a locked question automatically creates a new version/duplicate of the question in the database, updates draft plans, and leaves the original question untouched to preserve historical student assessment responses.

### Item 6: Learning Plan Versioning Controls & Draft/Published Lock (COMPLETED)
1. **Version Control UI & Backend (`LmsAdminPage.tsx` & `lms-admin.service.ts`)**:
   - Implemented `POST /lms-admin/plans/:id/clone-draft` with explicit versioning increments:
     - **Minor Version Increment** (e.g. `v1.0` -> `v1.1`): For typo fixes or adding supporting reading material.
     - **Major Version Increment** (e.g. `v1.0` -> `v2.0`): For structural curriculum or assessment changes.
   - Automatically clones all assigned Chapters, Blobs, and Questions into the new Draft version.
2. **Draft vs. Published Workflow & Read-Only Lock**:
   - Added interactive status pills (`✓ PUBLISHED` / `📝 DRAFT`) allowing admins to toggle publication status.
   - **Published Plans**: Locked as read-only in both frontend and backend to guarantee student assessment integrity.
   - Attempting to update a published plan returns a clear error message advising the admin to use `+ Minor Draft` or `+ Major Draft`.
3. **Smart Builder Filtering**:
   - Selecting Course Codes automatically filters available KEs, Chapters, and Questions for fast plan construction.



