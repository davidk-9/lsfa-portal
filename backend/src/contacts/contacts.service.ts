import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AxcelerateService } from '../axcelerate/axcelerate.service';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);
  private isBulkSyncing = false;
  private bulkSyncStatus = {
    total: 0,
    current: 0,
    imported: 0,
    errors: [] as string[],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly axcelerate: AxcelerateService,
  ) {}

  async getContactForUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { contact: true },
    });

    if (!user) throw new NotFoundException('User not found');

    if (user.contact) {
      return user.contact;
    }

    // Try to auto-link with Axcelerate contact if axcelerateContactId or email is present
    if (user.axcelerateContactId) {
      try {
        return await this.syncAxcelerateForUser(userId, parseInt(user.axcelerateContactId, 10));
      } catch (err: any) {
        this.logger.warn(`Failed to auto-sync Axcelerate contact ${user.axcelerateContactId}: ${err?.message}`);
      }
    }

    // Attempt lookup by email
    if (user.email) {
      try {
        const found = await this.axcelerate.lookupContactByEmail(user.email);
        if (found?.contactId) {
          return await this.syncAxcelerateForUser(userId, parseInt(found.contactId, 10));
        }
      } catch (err: any) {
        this.logger.warn(`No Axcelerate contact found for email ${user.email}: ${err?.message}`);
      }
    }

    // Create a local fallback Contact record
    const dummyContactId = 9000000 + userId;
    const newContact = await this.prisma.contact.create({
      data: {
        contactId: dummyContactId,
        emailAddress: user.email,
        givenName: user.name ? user.name.split(' ')[0] : 'User',
        surname: user.name && user.name.split(' ').length > 1 ? user.name.split(' ').slice(1).join(' ') : '',
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { contactId: newContact.id },
    });

    return newContact;
  }

  async updateContactForUser(userId: number, updateData: any) {
    const contact = await this.getContactForUser(userId);

    // Sanitize non-updatable structural fields
    delete updateData.id;
    delete updateData.contactId;
    delete updateData.userId;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    return this.prisma.contact.update({
      where: { id: contact.id },
      data: updateData,
    });
  }

  async syncAxcelerateForUser(userId: number, targetAxcelerateContactId?: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let axId = targetAxcelerateContactId;
    if (!axId && user.axcelerateContactId) {
      axId = parseInt(user.axcelerateContactId, 10);
    }

    if (!axId && user.email) {
      const lookup = await this.axcelerate.lookupContactByEmail(user.email);
      if (lookup?.contactId) axId = parseInt(lookup.contactId, 10);
    }

    if (!axId) {
      throw new BadRequestException('No Axcelerate Contact ID associated with this user or email');
    }

    const payload = await this.axcelerate.getContactDetail(axId);
    if (!payload || !payload.CONTACTID) {
      throw new NotFoundException(`Could not retrieve details from Axcelerate for Contact ID: ${axId}`);
    }

    const mapped = mapAxceleratePayloadToContactData(payload);

    // Upsert contact in local DB
    const contact = await this.prisma.contact.upsert({
      where: { contactId: mapped.contactId },
      create: mapped,
      update: mapped,
    });

    // Link user to this contact
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        contactId: contact.id,
        axcelerateContactId: String(mapped.contactId),
      },
    });

    return contact;
  }

  async syncSingleContactById(axId: number) {
    const payload = await this.axcelerate.getContactDetail(axId);
    if (!payload || !payload.CONTACTID) {
      throw new NotFoundException(`Could not retrieve details from Axcelerate for Contact ID: ${axId}`);
    }

    const mapped = mapAxceleratePayloadToContactData(payload);

    return this.prisma.contact.upsert({
      where: { contactId: mapped.contactId },
      create: mapped,
      update: mapped,
    });
  }

  async getBulkSyncStatus() {
    return {
      isSyncing: this.isBulkSyncing,
      ...this.bulkSyncStatus,
    };
  }

  async runBulkSyncJob() {
    if (this.isBulkSyncing) return;

    this.isBulkSyncing = true;
    this.bulkSyncStatus = { total: 0, current: 0, imported: 0, errors: [] };

    try {
      let offset = 0;
      const limit = 100;

      // Get first batch to determine total
      let batch = await this.axcelerate.getContactsBatch(offset, limit);
      if (batch.length === 0) return;

      this.bulkSyncStatus.total = batch[0]?.COUNT || 0;

      while (batch.length > 0) {
        // Run Prisma transactions for batch insertion
        for (const raw of batch) {
          try {
            const mapped = mapAxceleratePayloadToContactData(raw);

            // Upsert contact in local DB
            await this.prisma.contact.upsert({
              where: { contactId: mapped.contactId },
              create: mapped,
              update: mapped,
            });

            this.bulkSyncStatus.imported++;
          } catch (err: any) {
            this.logger.error(`Failed to map or insert contact from bulk sync: ${JSON.stringify(raw)}`);
            this.bulkSyncStatus.errors.push(`Failed to insert contact id: ${raw?.CONTACTID}: ${err.message}`);
          }
          this.bulkSyncStatus.current++;
        }

        offset += limit;

        if (offset >= this.bulkSyncStatus.total) {
            break;
        }

        // Delay slightly to respect rate limits if any
        await new Promise(resolve => setTimeout(resolve, 500));
        
        batch = await this.axcelerate.getContactsBatch(offset, limit);
      }
    } catch (err: any) {
      this.bulkSyncStatus.errors.push(`Fatal error during sync: ${err.message}`);
      this.logger.error(`Fatal error in runBulkSyncJob: ${err.message}`);
    } finally {
      this.isBulkSyncing = false;
    }
  }
}

function mapAxceleratePayloadToContactData(raw: any) {
  if (!raw || !raw.CONTACTID) {
    throw new BadRequestException('Invalid Axcelerate contact payload');
  }
  return {
    contactId: Number(raw.CONTACTID),
    givenName: raw.GIVENNAME ?? null,
    title: raw.TITLE ?? null,
    middleName: raw.MIDDLENAME ?? null,
    preferredName: raw.PREFERREDNAME ?? null,
    surname: raw.SURNAME ?? null,
    emailAddress: raw.EMAILADDRESS ?? null,
    emailAddressAlternative: raw.EMAILADDRESSALTERNATIVE ?? null,
    sex: raw.SEX ?? null,
    dob: raw.DOB ?? null,
    historicClientId: raw.HISTORICCLIENTID != null ? String(raw.HISTORICCLIENTID) : null,
    optionalId: raw.OPTIONALID != null ? String(raw.OPTIONALID) : null,
    usi: raw.USI ?? null,
    usiVerified: typeof raw.USI_VERIFIED === 'boolean' ? raw.USI_VERIFIED : null,
    usiExemption: typeof raw.USI_EXEMPTION === 'boolean' ? raw.USI_EXEMPTION : null,
    vsn: raw.VSN != null ? String(raw.VSN) : null,
    lui: raw.LUI != null ? String(raw.LUI) : null,
    workReadyParticipantNumber: raw.WORKREADYPARTICIPANTNUMBER != null ? String(raw.WORKREADYPARTICIPANTNUMBER) : null,
    saceStudentId: raw.SACESTUDENTID != null ? String(raw.SACESTUDENTID) : null,
    position: raw.POSITION ?? null,
    section: raw.SECTION ?? null,
    division: raw.DIVISION ?? null,
    organisation: raw.ORGANISATION ?? null,
    orgId: raw.ORGID != null ? Number(raw.ORGID) : null,
    orgIds: Array.isArray(raw.ORGIDS) ? raw.ORGIDS.map(String) : [],
    buildingName: raw.BUILDINGNAME ?? null,
    unitNo: raw.UNITNO != null ? String(raw.UNITNO) : null,
    streetNo: raw.STREETNO != null ? String(raw.STREETNO) : null,
    streetName: raw.STREETNAME ?? null,
    poBox: raw.POBOX != null ? String(raw.POBOX) : null,
    address1: raw.ADDRESS1 ?? null,
    address2: raw.ADDRESS2 ?? null,
    city: raw.CITY ?? null,
    state: raw.STATE ?? null,
    postcode: raw.POSTCODE != null ? String(raw.POSTCODE) : null,
    countryId: raw.COUNTRYID != null ? Number(raw.COUNTRYID) : null,
    country: raw.COUNTRY ?? null,
    sBuildingName: raw.SBUILDINGNAME ?? null,
    sUnitNo: raw.SUNITNO != null ? String(raw.SUNITNO) : null,
    sStreetNo: raw.SSTREETNO != null ? String(raw.SSTREETNO) : null,
    sStreetName: raw.SSTREETNAME ?? null,
    sPoBox: raw.SPOBOX != null ? String(raw.SPOBOX) : null,
    sAddress1: raw.SADDRESS1 ?? null,
    sAddress2: raw.SADDRESS2 ?? null,
    sCity: raw.SCITY ?? null,
    sState: raw.SSTATE ?? null,
    sPostcode: raw.SPOSTCODE != null ? String(raw.SPOSTCODE) : null,
    sCountryId: raw.SCOUNTRYID != null ? Number(raw.SCOUNTRYID) : null,
    sCountry: raw.SCOUNTRY ?? null,
    phone: raw.PHONE != null ? String(raw.PHONE) : null,
    mobilePhone: raw.MOBILEPHONE != null ? String(raw.MOBILEPHONE) : null,
    workPhone: raw.WORKPHONE != null ? String(raw.WORKPHONE) : null,
    fax: raw.FAX != null ? String(raw.FAX) : null,
    sourceCodeId: raw.SOURCECODEID != null ? Number(raw.SOURCECODEID) : null,
    source: raw.SOURCE ?? null,
    comment: raw.COMMENT ?? null,
    website: raw.WEBSITE ?? null,
    citizenStatusId: raw.CITIZENSTATUSID != null ? Number(raw.CITIZENSTATUSID) : null,
    citizenStatusName: raw.CITIZENSTATUSNAME ?? null,
    fkResidencyStatusId: raw.FKRESIDENCYSTATUSID != null ? Number(raw.FKRESIDENCYSTATUSID) : null,
    fkResidencyStatusName: raw.FKRESIDENCYSTATUSNAME ?? null,
    countryOfBirthId: raw.COUNTRYOFBIRTHID != null ? Number(raw.COUNTRYOFBIRTHID) : null,
    countryOfBirthName: raw.COUNTRYOFBIRTHNAME ?? null,
    cityOfBirth: raw.CITYOFBIRTH ?? null,
    countryOfCitizenId: raw.COUNTRYOFCITIZENID != null ? Number(raw.COUNTRYOFCITIZENID) : null,
    countryOfCitizenName: raw.COUNTRYOFCITIZENNAME ?? null,
    indigenousStatusId: raw.INDIGENOUSSTATUSID != null ? Number(raw.INDIGENOUSSTATUSID) : null,
    indigenousStatusName: raw.INDIGENOUSSTATUSNAME ?? null,
    mainLanguageId: raw.MAINLANGUAGEID != null ? Number(raw.MAINLANGUAGEID) : null,
    mainLanguageName: raw.MAINLANGUAGENAME ?? null,
    englishProficiencyId: raw.ENGLISHPROFICIENCYID != null ? Number(raw.ENGLISHPROFICIENCYID) : null,
    englishAssistanceFlag: typeof raw.ENGLISHASSISTANCEFLAG === 'boolean' ? raw.ENGLISHASSISTANCEFLAG : null,
    highestSchoolLevelId: raw.HIGHESTSCHOOLLEVELID != null ? Number(raw.HIGHESTSCHOOLLEVELID) : null,
    highestSchoolLevelYear: raw.HIGHESTSCHOOLLEVELYEAR != null ? String(raw.HIGHESTSCHOOLLEVELYEAR) : null,
    currentSchoolLevel: raw.CURRENTSCHOOLLEVEL != null ? Number(raw.CURRENTSCHOOLLEVEL) : null,
    atSchoolFlag: typeof raw.ATSCHOOLFLAG === 'boolean' ? raw.ATSCHOOLFLAG : null,
    atSchoolName: raw.ATSCHOOLNAME ?? null,
    priorEducationIds: Array.isArray(raw.PRIOREDUCATIONIDS) ? raw.PRIOREDUCATIONIDS.map(String) : [],
    priorEducationNames: Array.isArray(raw.PRIOREDUCATIONNAMES) ? raw.PRIOREDUCATIONNAMES.map(String) : [],
    priorEducationStatus: typeof raw.PRIOREDUCATIONSTATUS === 'boolean' ? raw.PRIOREDUCATIONSTATUS : null,
    disabilityFlag: typeof raw.DISABILITYFLAG === 'boolean' ? raw.DISABILITYFLAG : null,
    disabilityTypeIds: Array.isArray(raw.DISABILITYTYPEIDS) ? raw.DISABILITYTYPEIDS.map(String) : [],
    disabilityTypeNames: Array.isArray(raw.DISABILITYTYPENAMES) ? raw.DISABILITYTYPENAMES.map(String) : [],
    labourForceId: raw.LABOURFORCEID != null ? Number(raw.LABOURFORCEID) : null,
    labourForceName: raw.LABOURFORCENAME ?? null,
    anzscoCode: raw.ANZSCOCODE ?? null,
    anzsicCode: raw.ANZSICCODE ?? null,
    ielts: raw.IELTS ?? null,
    surveyContactStatusCode: raw.SURVEYCONTACTSTATUSCODE ?? null,
    emergencyContact: raw.EMERGENCYCONTACT ?? null,
    emergencyContactRelation: raw.EMERGENCYCONTACTRELATION ?? null,
    emergencyContactPhone: raw.EMERGENCYCONTACTPHONE != null ? String(raw.EMERGENCYCONTACTPHONE) : null,
    employerContactId: raw.EMPLOYERCONTACTID != null ? Number(raw.EMPLOYERCONTACTID) : null,
    payerContactId: raw.PAYERCONTACTID != null ? Number(raw.PAYERCONTACTID) : null,
    supervisorContactId: raw.SUPERVISORCONTACTID != null ? Number(raw.SUPERVISORCONTACTID) : null,
    coachContactId: raw.COACHCONTACTID != null ? Number(raw.COACHCONTACTID) : null,
    agentContactId: raw.AGENTCONTACTID != null ? Number(raw.AGENTCONTACTID) : null,
    contactRoleId: raw.CONTACTROLEID != null ? Number(raw.CONTACTROLEID) : null,
    yearOfArrivalAus: raw.YEAROFARRIVALAUS != null ? String(raw.YEAROFARRIVALAUS) : null,
    customFieldAdditionalSupport: raw.CUSTOMFIELD_B_ADDITIONALSUPPORT ?? null,
    customFieldAdditionalSupportRequired: raw.CUSTOMFIELD_S_ADDITIONALSUPPORTREQUIRED ?? null,
    customFieldParentGuardianContactNumber: raw.CUSTOMFIELD_S_PARENTGUARDIANCONTACTNUMBER != null ? String(raw.CUSTOMFIELD_S_PARENTGUARDIANCONTACTNUMBER) : null,
    customFieldEmployer: raw.CUSTOMFIELD_S_EMPLOYER ?? null,
    customFieldJobTitle: raw.CUSTOMFIELD_S_JOBTITLE ?? null,
    customFieldCJobTitle: raw.CUSTOMFIELD_C_JOBTITLE ?? null,
    customFieldCombinedDeclaration: raw.CUSTOMFIELD_B_COMBINEDDECLARATION ?? null,
    customFieldDeclarations: Array.isArray(raw.CUSTOMFIELD_C_DECLARATIONS) ? raw.CUSTOMFIELD_C_DECLARATIONS.map(String) : [],
    customFieldParentGuardianEmail: raw.CUSTOMFIELD_S_PARENTGUARDIANEMAIL ?? null,
    customFieldCanPerformCpr2Mins: raw.CUSTOMFIELD_B_CANPERFORMCPR2MINS ?? null,
    customFieldPrecourseWork: raw.CUSTOMFIELD_B_PRECOURSEWORK ?? null,
    customFieldMarketingPermission: raw.CUSTOMFIELD_B_MARKETINGPERMISSION ?? null,
    customFieldParentGuardianFullName: raw.CUSTOMFIELD_S_PARENTGUARDIANFULLNAM ?? null,
    customFieldUsiPermission: raw.CUSTOMFIELD_B_USIPERMISSION ?? null,
    customFieldPreviousJobTitles: Array.isArray(raw.CUSTOMFIELD_C_PREVIOUSJOBTITLES) ? raw.CUSTOMFIELD_C_PREVIOUSJOBTITLES.map(String) : [],
    customFieldPreviousJobTitlesOther: raw.CUSTOMFIELD_S_PREVIOUSJOBTITLESOTHER ?? null,
    customFieldPreviousCerts: Array.isArray(raw.CUSTOMFIELD_C_PREVIOUSCERTS) ? raw.CUSTOMFIELD_C_PREVIOUSCERTS.map(String) : [],
    customFieldParentGuardianRelationship: raw.CUSTOMFIELD_S_PARENTGUARDIANRELATIONSHIP ?? null,
    customFieldWellbeingRequirements: raw.CUSTOMFIELD_S_WELLBEINGREQUIREMENTS ?? null,
    lastUpdated: raw.LASTUPDATED ?? null,
    contactEntryDate: raw.CONTACTENTRYDATE ?? null,
    contactActive: typeof raw.CONTACTACTIVE === 'boolean' ? raw.CONTACTACTIVE : true,
    photo: raw.PHOTO ?? null,
  };
}