export interface OnboardingValidationResult {
  isComplete: boolean;
  missingFields: { key: string; label: string; tab: 'personal' | 'avetmiss' | 'declarations' }[];
}

export function validateStudentOnboarding(contact: any): OnboardingValidationResult {
  const missing: { key: string; label: string; tab: 'personal' | 'avetmiss' | 'declarations' }[] = [];

  if (!contact) {
    return { isComplete: false, missingFields: [{ key: 'contact', label: 'Student Contact Record', tab: 'personal' }] };
  }

  // ── Personal & Contact ────────────────────────────────────────────────────────
  const hasName = Boolean(
    (contact.givenName && String(contact.givenName).trim()) ||
    (contact.surname && String(contact.surname).trim())
  );
  if (!hasName) {
    missing.push({ key: 'givenName', label: 'First Name or Last Name', tab: 'personal' });
  }

  if (!contact.dob || !String(contact.dob).trim()) {
    missing.push({ key: 'dob', label: 'Date of Birth', tab: 'personal' });
  }

  if (!contact.sex || !String(contact.sex).trim()) {
    missing.push({ key: 'sex', label: 'Gender / Sex', tab: 'personal' });
  }

  const rawUsi = String(contact.usi || '').trim();
  const usiVerified = Boolean(contact.usiVerified);
  if (!rawUsi || rawUsi.length !== 10 || !usiVerified) {
    missing.push({ key: 'usi', label: 'Verified 10-character USI', tab: 'personal' });
  }

  if (!contact.customFieldUsiPermission || !String(contact.customFieldUsiPermission).trim()) {
    missing.push({ key: 'customFieldUsiPermission', label: 'USI Access Permission Selection', tab: 'personal' });
  }

  if (!contact.emailAddress || !String(contact.emailAddress).trim()) {
    missing.push({ key: 'emailAddress', label: 'Email Address', tab: 'personal' });
  }

  const hasPhone = Boolean(
    (contact.mobilePhone && String(contact.mobilePhone).trim()) ||
    (contact.phone && String(contact.phone).trim()) ||
    (contact.workPhone && String(contact.workPhone).trim())
  );
  if (!hasPhone) {
    missing.push({ key: 'mobilePhone', label: 'Phone Number (Mobile or Home/Work)', tab: 'personal' });
  }

  const hasAddress = Boolean(
    (contact.city && String(contact.city).trim() && contact.state && String(contact.state).trim() && contact.postcode && String(contact.postcode).trim()) ||
    (contact.fullAddress && String(contact.fullAddress).trim())
  );
  if (!hasAddress) {
    missing.push({ key: 'fullAddress', label: 'Residential Address (Suburb, State & Postcode)', tab: 'personal' });
  }

  // ── AVETMISS ─────────────────────────────────────────────────────────────────
  if (contact.indigenousStatusId == null || String(contact.indigenousStatusId).trim() === '') {
    missing.push({ key: 'indigenousStatusId', label: 'Indigenous Status', tab: 'avetmiss' });
  }

  if (contact.countryOfBirthId == null || String(contact.countryOfBirthId).trim() === '') {
    missing.push({ key: 'countryOfBirthId', label: 'Country of Birth', tab: 'avetmiss' });
  }

  if (contact.mainLanguageId == null || String(contact.mainLanguageId).trim() === '') {
    missing.push({ key: 'mainLanguageId', label: 'Main Language Spoken at Home', tab: 'avetmiss' });
  }

  if (contact.englishProficiencyId == null || String(contact.englishProficiencyId).trim() === '') {
    missing.push({ key: 'englishProficiencyId', label: 'English Proficiency', tab: 'avetmiss' });
  } else if (String(contact.englishProficiencyId) !== '1' && contact.englishAssistanceFlag == null) {
    missing.push({ key: 'englishAssistanceFlag', label: 'English Assistance Requirement', tab: 'avetmiss' });
  }

  if (contact.atSchoolFlag == null) {
    missing.push({ key: 'atSchoolFlag', label: 'Currently at School', tab: 'avetmiss' });
  }

  if (contact.highestSchoolLevelId == null || String(contact.highestSchoolLevelId).trim() === '') {
    missing.push({ key: 'highestSchoolLevelId', label: 'Highest School Level Attained', tab: 'avetmiss' });
  }

  if (contact.priorEducationStatus == null) {
    missing.push({ key: 'priorEducationStatus', label: 'Prior Post-School Education Status', tab: 'avetmiss' });
  } else if (contact.priorEducationStatus === true) {
    if (!Array.isArray(contact.priorEducationIds) || contact.priorEducationIds.length === 0) {
      missing.push({ key: 'priorEducationIds', label: 'Prior Education Qualifications', tab: 'avetmiss' });
    }
  }

  if (contact.studyReasonId == null || String(contact.studyReasonId).trim() === '') {
    missing.push({ key: 'studyReasonId', label: 'Study Reason', tab: 'avetmiss' });
  }

  if (contact.labourForceId == null || String(contact.labourForceId).trim() === '') {
    missing.push({ key: 'labourForceId', label: 'Employment Status (Labour Force)', tab: 'avetmiss' });
  } else {
    const code = String(contact.labourForceId).padStart(2, '0');
    if (['01', '02', '03', '04', '05'].includes(code)) {
      const titles = contact.customFieldPreviousJobTitles || [];
      if (!Array.isArray(titles) || titles.length === 0) {
        missing.push({ key: 'customFieldPreviousJobTitles', label: 'Job Title / Occupation Selection', tab: 'avetmiss' });
      } else if (titles.some((t: string) => t === 'Other' || t.startsWith('Other'))) {
        if (!contact.customFieldPreviousJobTitlesOther || !String(contact.customFieldPreviousJobTitlesOther).trim()) {
          missing.push({ key: 'customFieldPreviousJobTitlesOther', label: 'Other Job Title Details', tab: 'avetmiss' });
        }
      }
    }
  }

  if (contact.disabilityFlag == null) {
    missing.push({ key: 'disabilityFlag', label: 'Disability Status', tab: 'avetmiss' });
  } else if (contact.disabilityFlag === true) {
    if (!Array.isArray(contact.disabilityTypeIds) || contact.disabilityTypeIds.length === 0) {
      missing.push({ key: 'disabilityTypeIds', label: 'Disability Types', tab: 'avetmiss' });
    }
  }

  // ── Support & Declarations ──────────────────────────────────────────────────
  if (!contact.customFieldAdditionalSupport || !String(contact.customFieldAdditionalSupport).trim()) {
    missing.push({ key: 'customFieldAdditionalSupport', label: 'Additional Support Selection', tab: 'declarations' });
  } else if (String(contact.customFieldAdditionalSupport).startsWith('Yes')) {
    if (!contact.customFieldAdditionalSupportRequired || !String(contact.customFieldAdditionalSupportRequired).trim()) {
      missing.push({ key: 'customFieldAdditionalSupportRequired', label: 'Additional Support Details', tab: 'declarations' });
    }
  }

  if (!contact.customFieldMarketingPermission || !String(contact.customFieldMarketingPermission).trim()) {
    missing.push({ key: 'customFieldMarketingPermission', label: 'Marketing Permission Selection', tab: 'declarations' });
  }

  const dec = String(contact.customFieldCombinedDeclaration || '').trim();
  if (!dec || dec === 'false') {
    missing.push({ key: 'customFieldCombinedDeclaration', label: 'Agreement to Enrolment Declarations', tab: 'declarations' });
  }

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
  };
}
