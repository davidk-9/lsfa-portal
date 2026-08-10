# LMS Integration Plan: Porting LifesaverLMS into LSFA Central

## 🎯 Executive Overview
This document outlines the step-by-step plan to integrate our custom LMS into `lsfa-central` by porting all core domain logic, algorithms, schemas, and UI components from `LifesaverLMS` into the existing **NestJS + Prisma + React 19** stack.

### Key Rules & Constraints
1. **Zero Regression**: Preserve all existing `lsfa-central` features, Prisma models (`CourseCode`, `WorkshopProgress`, `StudentChecklist`, `WorkshopSnapshot`, `Contact`), and API endpoints.
2. **Self-Contained**: Port or recreate every piece of code needed from `LifesaverLMS` into `lsfa-central` so that the `LifesaverLMS` workspace folder can be safely removed.
3. **Course Versioning**: Use `CourseCode` as the root unit definition, introduce `LearningPlan` (versioned assessment plans), and lock student enrollments to specific versions for ASQA compliance.

---

## 📅 Phases & Task Breakdown

### Phase 1: Database Schema Expansion (Prisma)
- [ ] **Task 1.1**: Update `CourseCode` in `backend/prisma/schema.prisma` to relate to `LearningPlan`.
- [ ] **Task 1.2**: Update `WorkshopProgress` in `schema.prisma` to add optional `lmsEnabled` (Boolean) and `learningPlanId` (Int?).
- [ ] **Task 1.3**: Add `LearningPlan` model (versioned assessment plan: code, version, status, isDefault, effectiveFrom).
- [ ] **Task 1.4**: Add `LmsQuestion` model (supporting all 7 question types, `questionData` JSONB, `correctAnswer` JSONB).
- [ ] **Task 1.5**: Add `LmsLearningBlob` model (video/resource content for remediation).
- [ ] **Task 1.6**: Add `LearningPlanQuestion` join model (`learningPlanId`, `questionId`, `sortOrder`, `points`).
- [ ] **Task 1.7**: Add `LmsEnrollment` model (`contactId`, `instanceId`, `learningPlanId`, `learningMode`, `progressData` JSONB, `currentScore`, `possibleScore`, `isCompetent`).
- [ ] **Task 1.8**: Run Prisma migration/generation and verify existing backend builds with zero errors.

---

### Phase 2: Backend Core - DTOs, Diagnostic Engine & Services
- [ ] **Task 2.1**: Create `backend/src/lms/enums` for `QuestionType` (1-7) and `LearningMode` (1-4).
- [ ] **Task 2.2**: Create `backend/src/lms/dto` for assessment submission, response models, grading results, and plan management.
- [ ] **Task 2.3**: Implement `LmsDiagnosticService` (`backend/src/lms/lms-diagnostic.service.ts`):
  - Single Choice grading (exact match)
  - Multiple Choice grading (order-independent set match)
  - Order Items grading (sequence match)
  - Match Definitions grading (pair match)
  - Fill in Blanks grading (string normalization: spaces/hyphens removed, case-insensitive, partial credit scoring)
  - Free Text grading (baseline validation, placeholder for AI)
  - Forms grading (field validation)
  - Learning gap extraction (mapping failed questions to `LmsLearningBlob`)
  - ASQA evidence attempt logging in `progressData.assessmentAttempts`
- [ ] **Task 2.4**: Implement `LmsService` (`backend/src/lms/lms.service.ts`) for enrollment fetching, mode updates, assessment submission, and seed/dev helpers.
- [ ] **Task 2.5**: Create `LmsController` (`backend/src/lms/lms.controller.ts`) with endpoints:
  - `GET /api/lms/enrollment/:id`
  - `PATCH /api/lms/enrollment/:id/mode`
  - `POST /api/lms/enrollment/submit-assessment`
  - `POST /api/lms/seed` (development seeder)
- [ ] **Task 2.6**: Register `LmsModule` in `backend/src/app.module.ts` and test backend build.

---

### Phase 3: Frontend Component & Page Integration
- [ ] **Task 3.1**: Create TypeScript types/models in `frontend/src/lms/types/lms.ts` matching backend DTOs and enums.
- [ ] **Task 3.2**: Port 7 interactive question components into `frontend/src/lms/components/assessment/`:
  - `MultipleChoiceSingle.tsx`
  - `MultipleChoiceMultiple.tsx`
  - `OrderItems.tsx`
  - `MatchDefinitions.tsx`
  - `FillInBlanks.tsx`
  - `FreeText.tsx`
  - `Forms.tsx`
- [ ] **Task 3.3**: Port assessment orchestration components (`QuestionRenderer.tsx`, `ProgressDots.tsx`, `AssessmentContainer.tsx`, `HelpModal.tsx`).
- [ ] **Task 3.4**: Port LMS pages into `frontend/src/lms/pages/`:
  - `LmsHome.tsx`
  - `LmsMagicLinkHandler.tsx`
  - `LmsWelcome.tsx`
  - `LmsModeSelector.tsx`
  - `LmsLearnDashboard.tsx`
  - `LmsResults.tsx`
- [ ] **Task 3.5**: Add LMS routes to `frontend/src/App.tsx` (e.g. `/lms/start/:enrollmentId`, `/lms/welcome`, `/lms/select-mode`, `/lms/learn`, `/lms/results`).
- [ ] **Task 3.6**: Add LMS service functions to frontend API layer (`frontend/src/lms/services/lmsApi.ts`).

---

### Phase 4: Video Player & Gap Review Enhancement
- [ ] **Task 4.1**: Build an embedded Video Player component (supporting Vimeo embed / Azure Blob URL) for review cards on the `LmsResults` page.
- [ ] **Task 4.2**: Add ability to mark learning gaps/blobs as "viewed" in `LmsEnrollment.progressData`.

---

### Phase 5: End-to-End Verification & Cleanup
- [ ] **Task 5.1**: Test sample seed data creation via backend endpoint.
- [ ] **Task 5.2**: Test full student flow end-to-end (Magic Link -> Welcome -> Mode Selection -> Taking Assessment -> Diagnostic Grading -> Results & Gaps).
- [ ] **Task 5.3**: Verify all existing `lsfa-central` features (`/workshop-detail`, `/bulk-scheduler`, user auth, etc.) compile and run cleanly without regression.
- [ ] **Task 5.4**: Confirm `LifesaverLMS` folder can be removed from workspace once all verification passes.

---

## 📌 Status Tracker
- **Current Phase**: Phase 1 (Not Started)
- **Last Completed Task**: None
