# LSFA Central — Project Plan

## What Is This?

A custom, single-tenant RTO management platform for **Life Saving First Aid (LSFA)**. It will eventually replace **Axcelerate** (their current LMS/RTO platform) entirely. Built using a strangler fig approach — features are built in lsfa-central first, run alongside Axcelerate in parallel, and Axcelerate is switched off once the new system covers everything.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Frontend | React + TypeScript + Vite |
| Auth | JWT + role-based access |
| File Storage | Azure Blob Storage |
| External API | Axcelerate REST API |

**No multi-tenancy. No sales website. No staff portal. One backend + one frontend.**

---

## Source / Reference Projects

- **`c:\code\dk-leda`** — NestJS/React/Prisma SaaS platform. Good reference for: auth, RBAC, Prisma schema patterns, project structure.
- **`c:\code\dk-trainer-portal`** — WordPress plugin built specifically for LSFA. Good reference for: Axcelerate API client, competency checklist logic, Azure Blob Storage, attendance workflow, bulk scheduler. The most directly relevant codebase.

---

## Build Phases

### Phase 1 — Trainer Portal + Admin Calendar *(current focus)*
Move the trainer portal and admin calendar out of WordPress into lsfa-central. During this phase everything still talks to Axcelerate as the source of truth. Key driver: changes to this system currently risk taking down the LSFA booking website.

- Trainer calendar (monthly view, own workshops)
- Workshop detail (student list, attendance, checklists, file uploads)
- Admin calendar (all workshops, bulk generation)
- Axcelerate API integration

**Note:** The WordPress booking calendar sync will remain in WordPress for now but will be updated to use webhooks rather than manual syncs.

### Phase 2 — Enhancements
Improvements to the trainer/admin tools once in the new environment:
- Changes Mitch and Ash have previously requested
- Scheduling tool for Mitch
- Automated trainer evidence uploading (AI-assisted)

### Phase 3 — Custom Student Onboarding
Replace Axcelerate's onboarding with a student-friendly custom system:
- One-time magic link sent from booking confirmation (no LMS login in booking confirmation)
- USI system integration
- AVETMISS-compliant data collection
- Smart returning student detection (already an Axcelerate user?)
- On completion, presents/emails the online learning link to Axcelerate
- Magic link is smart: if student has onboarded before, gives option to verify existing details or proceed directly

### Phase 4 — Custom LMS
Adaptive AI-assisted learning management system to replace Axcelerate's LMS:
- "Learn it your way" — students answer questions about their preferred learning style and prior experience
- System custom-designs their learning journey (e.g. confident students go straight to diagnosis-mode knowledge assessment)
- Diagnosis mode: 1 pass, wrong answers identify knowledge gaps, only relevant materials are assigned
- Assessment mode: 1 attempt per question, option to review a short refresher before next attempt
- Goal: teach only what's needed, assess thoroughly, without it feeling like a grind

### Phase 5 — SMS (Student Management System)
Build our own student data layer (AVETMISS compliant) to replace Axcelerate's SMS:
- AVETMISS-compliant student records (very different to dk-leda students — no academic years, no classes concept)
- Class optimisation engine — automate condensing and filling courses for highest yield / lowest trainer cost
- Automated student notifications about alternative course times that suit the business
- Students can move themselves between slots without admin involvement
- Data sync with Axcelerate during transition, then cut over

### Phase 6 — CMS / ACERTO (Compliance Management System)
AI-assisted compliance automation:
- Validation documentation
- Industry consultation
- Continuous improvement workflows
- Managerial meeting minutes
- Student feedback collection and analysis
- Reduce staff time on compliance tasks as much as possible via automation

---

## Overarching Goal

> Company growth without excessive staff growth. The system handles more and more; people handle less and less.

---

## Current Status

### Sprint 1 — Week 1: Port Admin Calendar + Trainer Portal out of WordPress

**Roles:**
- **Super User** (David, Mitch) — full access, MFA login, create users in any role, impersonate any trainer
- **Admin** (e.g. Naomi) — see admin calendar + trainer portal, impersonate any trainer
- **Trainer** — see only their own trainer calendar

**Deliverables:**
- [ ] Scaffold NestJS backend + React frontend
- [ ] JWT auth with MFA (Super User at minimum)
- [ ] User management — Super User can create Admin and Trainer accounts
- [ ] Trainer impersonation — Super User and Admin can load trainer portal as any trainer
- [ ] Admin Calendar — all existing features ported from WordPress plugin
- [ ] Trainer Portal — all existing features ported from WordPress plugin
- [ ] Role-based routing (Trainer sees only their calendar; Admin/Super see everything)

**Caveats:**
- Booking calendar sync remains in WordPress for now (Naomi/Mitch still hit sync button manually)
- Tech stack must suit the AI evidence uploader contributor as well

**Bonus (time permitting):**
- Webhook-based booking calendar sync (reduce manual syncing)
- AI-powered evidence uploader integrated and tested
- Mitch/Naomi/Ash requested feature improvements

**Infrastructure options:**
- BinaryLane VPS (~$20/month), single Linux server, scale up as needed
- Option to separate DB onto its own server now or later
