# Refined LMS Content Architecture & Assessment Plan

## Execution Backlog

### Item 1: Chapters & Content Blocks Sub-Tabs & Block Sequencer
- **Decouple UI (`frontend/src/pages/LmsAdminPage.tsx`)**: Remove the forced Course Code filter requirement on the Chapters & Content Blocks tab.
- **Sub-Tabs**:
  - **Sub-Tab A: Content Blocks (Blobs)** — Independent list and editor for atomic content blocks (HTML, Vimeo, Azure PDFs) mapped to multiple Knowledge Evidences (KEs).
  - **Sub-Tab B: Chapters** — Container list and editor for grouping and sequencing Content Blocks into logical reading modules.
- **Block Sequencer**: Multi-select block picker with ▲ Up / ▼ Down buttons in the Chapter modal to define reading order.

### Item 2: Question Banks (Assessment Containers)
- **Schema & Backend (`schema.prisma` & `lms-admin.service.ts`)**: Add `LmsQuestionBank` model to group published questions into named assessment banks (e.g. *"CPR Assessment Bank"*).
- **UI Integration**: Add a Question Banks sub-tab in the Question Bank view. Allow attaching whole Question Banks or individual questions when assembling a Learning Plan Version.

### Item 3: 100% KE Coverage Validation Gate for Publishing Plans
- **Backend Validation Gate (`lms-admin.service.ts`)**: Prevent publishing a Learning Plan (`status = PUBLISHED`) unless 100% of required KEs for its Course Code have at least 1 content block and at least 1 assessment question.
- **UI Feedback**: Display a clear warning banner in `LmsAdminPage.tsx` listing any missing/unmapped KEs if publishing fails validation.

### Item 4: Content Block Versioning & Lock
- **Block Lock (`lms-admin.service.ts`)**: Mark blocks attached to `PUBLISHED` Learning Plans as locked (`🔒 Locked`).
- **Auto-Duplicate**: Editing a locked block automatically duplicates it to a new version for draft plans, keeping published plans and active student reading progress untouched.

### Item 5: Student Workshop Transfers & Cross-Course KE Credit Recognition
- **Same-Unit Transfer**: Preserve active `LmsEnrollment` and `learningPlanId` when students move between workshops under the same course code, updating only `instanceId`.
- **Cross-Course Credit Recognition**: When transferring across different course codes (e.g. `HLTAID009` $\rightarrow$ `HLTAID011`), evaluate shared KEs and auto-credit previously completed blocks and correctly answered questions.

### Item 6: Immutable Assessment Audit Log
- **Database Audit Table (`LmsAssessmentLog`)**: Permanently log every question submission (question ID, text snapshot, submitted answer JSON, points earned, timestamps, and origin enrolments) for ASQA/RTO compliance.