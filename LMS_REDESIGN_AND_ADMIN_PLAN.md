# LMS Redesign & Admin Management Implementation Plan

## 🎯 Executive Overview
This document outlines the architectural plan to evolve our candidate LMS in `lsfa-central` into a student-first, EALD-friendly (English as an Additional Language or Dialect), Knowledge-Evidence-driven learning portal with full Admin Management capabilities.

---

## 🏛️ Core Domain Architecture & Relational Mapping

### 1. The Knowledge Evidence (KE) Hierarchy
To align 100% with ASQA and VET requirements (training.gov.au standards):
- **`LmsKnowledgeEvidence`**: Represents specific Knowledge Evidence items (e.g. `KE01 - DRSABCD Action Plan`).
- **`CourseCode` ↔ `LmsKnowledgeEvidence`**: Many-to-Many relationship (a KE item can apply to multiple courses like `HLTAID009` and `HLTAID011`).
- **Knowledge Evidence as the Associative Bridge**:
  - **`LmsLearningBlob` (Block)** ➔ Linked to **`LmsKnowledgeEvidence`**
  - **`LmsQuestion`** ➔ Linked to **`LmsKnowledgeEvidence`**
  - *Result*: The system dynamically knows which Content Blocks explain which Questions without hardcoding manual video links!

### 2. Collapsible Chapter / Block Structure (2-Layer Tree View)
- **`LmsChapter`**: Top-level group/unit chapter (e.g., *Chapter 1: Initial Assessment & CPR*).
- **`LmsLearningBlob` (Block)**: Individual learning module belonging to a Chapter.
  - Contains **HTML / Rich Text & Graphics** + **Video URL** (Azure Blob or Vimeo).
  - Ordered sequentially to mirror the official Learner Guide PDF.

---

## 🛠️ Key Architectural & UI Enhancements

### 1. Student Learning Journey & Tree View
- **Default View**: A collapsible 2-layer tree (Chapter ➔ Blocks).
- **Block Progress States & Visual Indicators**:
  - ⚪ **Unread / Not Viewed**: Grey / Default
  - 🟡/🔵 **Viewed / Marked Complete**: Blue / Yellow
  - 🟢 **Assessed & Competent**: Green
- **Offline Learner Guide Generator**:
  - Aggregates all text/graphic content blocks in order for a course into a clean, downloadable PDF Learner Guide.

### 2. Fast-Track Testing & Adaptive Remediation
- **Fast-Track Test Button**: Accessible anytime from the learning dashboard.
- **Fast-Track Execution Rules**:
  - One pass through all questions for the enrolled `LearningPlan` version.
  - No inline hints/help modals during the attempt.
  - Progress dots reflect current position and status.
- **Post-Fast-Track Adaptive View**:
  - **Passed Questions**: Mark mapped Knowledge Evidence & Blocks as 🟢 **Competent**.
  - **Failed Questions**: Revert mapped Blocks to 🔴 **Needs Review** and automatically collapse/hide passed blocks so the student only sees the exact topics needing attention.

### 3. Question Component Refinements
- **Fill-in-the-Blanks Refinement**:
  - **Inline Dropdowns**: Embedded directly inside sentence text (e.g., *"Perform [Dropdown 1: 30] compressions at a depth of [Dropdown 2: 5-6 cm]"*).
  - **Distractors**: Each blank option configured with 2-3 distractor choices.
  - **Visual Outline**: Dropdown borders highlight Green or Red on submission.
- **Order Items Refinement**:
  - **Random Shuffle**: Items automatically jumbled in random order when presented.
- **Free Text & Forms AI / Semantic Grading Strategy**:
  - Store a benchmark model answer for each free text question.
  - Support semantic vector similarity or Azure OpenAI integration for automated grading with customizable matching tolerance thresholds.

---

## 🖥️ Admin Interface: Learning Management System

Dedicated Standalone Page: **`/lms-admin`** (Added to main sidebar navigation under Admin section)
- **Access Control**: Restricted exclusively to **`SUPER_USER`** and **`ADMIN`** roles (hidden/blocked for `TRAINER` and `STUDENT`).

1. **Knowledge Evidence (KE) Manager**:
   - Create/edit KEs and assign to `CourseCode`s.
2. **Chapter & Content Block Manager**:
   - Organize Chapters & Blocks (rich text editor, Azure/Vimeo video embed, order index, KE mapping).
3. **Question Bank Manager**:
   - Create/edit questions for all 7 types (including inline Fill-in-Blanks dropdown builder with distractors, benchmark answers for AI grading, and KE mapping).
4. **Learning Plan Version Builder**:
   - Create versioned plans (`v1.0`, `v1.1`) by selecting KEs and Questions for a Course Code.

---

## 📅 Phased Implementation Plan

### Phase A: Schema & Relational Expansion (Prisma)
- [x] Add `LmsKnowledgeEvidence` model and many-to-many join with `CourseCode`.
- [x] Add `LmsChapter` model (`courseCodeId`, `title`, `sortOrder`).
- [x] Update `LmsLearningBlob` to belong to `LmsChapter` and link to `LmsKnowledgeEvidence`.
- [x] Update `LmsQuestion` to link to `LmsKnowledgeEvidence` and store benchmark answers for AI grading.
- [x] Run Prisma migration & client generation.

### Phase B: Question Component Upgrades
- [x] Upgrade `FillInBlanks.tsx` to render inline dropdowns with distractors within sentence text, with green/red outline feedback.
- [x] Upgrade `OrderItems.tsx` to randomly shuffle items on initial load.

### Phase C: Dedicated Admin Management UI (`/lms-admin`)
- [x] Add `/lms-admin` route to `App.tsx` guarded for `['SUPER_USER', 'ADMIN']` roles.
- [x] Add "LMS Admin" navigation item to main sidebar for Admins/SuperUsers.
- [x] Create KE Manager tab (CRUD KEs & link to Course Codes).
- [x] Create Chapter & Block Manager tab (Tree view, rich text content, video URLs, order index).
- [x] Create Question Bank Manager tab (7 question builder forms with KE mapping & distractors).
- [x] Create Learning Plan Builder tab (Assemble versioned plans).

### Phase D: Student Dashboard & Tree View Learning Portal
- [x] Build collapsible Chapter/Block tree view with visual progress badges (Unread, Viewed, Competent).
- [x] Build Fast-Track Test mode with adaptive block filtering (hiding passed blocks, highlighting failed blocks).
- [x] Add unified PDF Learner Guide generator for offline study.

### Phase E: AI / Semantic Vector Grading Integration
- [x] Integrate embedding / AI semantic match service for Free Text & Form answers against benchmark model responses.

---

## 📌 Status Tracker
- **Current Status**: All Phases Completed 🎉 (Schema, Question Upgrades, Dedicated LMS Admin UI `/lms-admin`, Collapsible Tree Learning Portal, Fast-Track, Learner Guide PDF, and AI Semantic Match Grading).
