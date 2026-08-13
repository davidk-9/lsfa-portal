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
      const parsedAxId = parseInt(user.axcelerateContactId, 10);
      if (parsedAxId && parsedAxId > 0 && parsedAxId < 900000000) {
        try {
          return await this.syncAxcelerateForUser(userId, parsedAxId);
        } catch (err: any) {
          this.logger.warn(`Failed to auto-sync Axcelerate contact ${user.axcelerateContactId}: ${err?.message}`);
        }
      }
    }

    // Attempt lookup by email (skip example/test emails)
    if (user.email && !user.email.endsWith('@example.com') && !user.email.endsWith('@test.com')) {
      try {
        const found = await this.axcelerate.lookupContactByEmail(user.email);
        if (found?.contactId && Number(found.contactId) < 900000000) {
          return await this.syncAxcelerateForUser(userId, parseInt(found.contactId, 10));
        }
      } catch (err: any) {
        this.logger.warn(`No Axcelerate contact found for email ${user.email}: ${err?.message}`);
      }
    }

    // Create a local fallback Contact record
    const dummyContactId = 900000000 + userId;
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

    this.logger.log(`Updating contact id ${contact.id} for user ${userId}. Received fields: ${Object.keys(updateData).join(', ')}`);

    // Sanitize non-updatable structural fields & relations
    delete updateData.id;
    delete updateData.contactId;
    delete updateData.userId;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.user;

    // Convert string numeric IDs back to integers or null if empty
    const intFields = [
      'countryId', 'sCountryId', 'sourceCodeId', 'citizenStatusId', 'fkResidencyStatusId',
      'countryOfBirthId', 'countryOfCitizenId', 'indigenousStatusId', 'mainLanguageId',
      'englishProficiencyId', 'highestSchoolLevelId', 'currentSchoolLevel', 'labourForceId',
      'employerContactId', 'payerContactId', 'supervisorContactId', 'coachContactId',
      'agentContactId', 'contactRoleId', 'orgId'
    ];

    for (const field of intFields) {
      if (field in updateData) {
        if (updateData[field] === '' || updateData[field] === null || updateData[field] === undefined) {
          updateData[field] = null;
        } else if (typeof updateData[field] === 'string' && !isNaN(Number(updateData[field]))) {
          updateData[field] = parseInt(updateData[field], 10);
        }
      }
    }

    // Ensure studyReasonId stays as string (Prisma schema has String?)
    if ('studyReasonId' in updateData && updateData.studyReasonId != null) {
      updateData.studyReasonId = String(updateData.studyReasonId);
    }

    if ('bypassOnboarding' in updateData) {
      updateData.bypassOnboarding = updateData.bypassOnboarding === true || updateData.bypassOnboarding === 'true';
    }

    try {
      const updatedLocal = await this.prisma.contact.update({
        where: { id: contact.id },
        data: updateData,
      });

      const axId = Number(contact.contactId);
      this.logger.log(`Local update complete for contact id ${contact.id} (contactId ${contact.contactId} / parsed ${axId}). Pushing to Axcelerate...`);

      // Best-effort push to Axcelerate if contactId is a valid positive number
      // Dummy local IDs are explicitly created in getContactForUser as 900000000 + userId
      if (axId && axId > 0 && axId < 900000000) {
        try {
          const axParams = mapContactDataToAxcelerateParams(updatedLocal);
          this.logger.log(`Axcelerate params generated for contactId ${axId}: ${JSON.stringify(axParams)}`);
          const axRes = await this.axcelerate.updateContact(axId, axParams);
          this.logger.log(`Axcelerate update response for ${axId}: ${JSON.stringify(axRes)}`);
        } catch (axErr: any) {
          this.logger.error(`Failed to push contact update to Axcelerate for contactId ${axId}: ${axErr.message}`, axErr.stack);
        }
      } else {
        this.logger.warn(`Skipping Axcelerate push for contactId ${contact.contactId} (not a valid Axcelerate ID)`);
      }

      return updatedLocal;
    } catch (err: any) {
      this.logger.error(`Error updating contact ${contact.id}: ${err.message}`, err.stack);
      throw new BadRequestException(`Failed to update contact: ${err.message}`);
    }
  }

  async syncAxcelerateForUser(userId: number, targetAxcelerateContactId?: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let axId = targetAxcelerateContactId;
    if (!axId && user.axcelerateContactId) {
      axId = parseInt(user.axcelerateContactId, 10);
    }

    if (!axId && user.email && !user.email.endsWith('@example.com') && !user.email.endsWith('@test.com')) {
      const lookup = await this.axcelerate.lookupContactByEmail(user.email);
      if (lookup?.contactId) axId = parseInt(lookup.contactId, 10);
    }

    if (!axId || axId >= 900000000) {
      throw new BadRequestException('No valid Axcelerate Contact ID associated with this user or email');
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

  async getContactsPaginated(page: number = 1, limit: number = 20, search: string = '', status: string = 'active') {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status === 'active') {
      where.contactActive = true;
    } else if (status === 'inactive') {
      where.contactActive = false;
    }

    if (search.trim()) {
      const q = search.trim();
      const words = q.split(/\s+/).filter(Boolean);

      const orConditions: any[] = [
        { givenName: { contains: q, mode: 'insensitive' } },
        { surname: { contains: q, mode: 'insensitive' } },
        { emailAddress: { contains: q, mode: 'insensitive' } },
        { mobilePhone: { contains: q, mode: 'insensitive' } },
        { usi: { contains: q, mode: 'insensitive' } },
      ];

      // If search contains multiple words (e.g. "David Kleinschmidt")
      if (words.length >= 2) {
        const first = words[0];
        const rest = words.slice(1).join(' ');
        orConditions.push(
          {
            AND: [
              { givenName: { contains: first, mode: 'insensitive' } },
              { surname: { contains: rest, mode: 'insensitive' } },
            ],
          },
          {
            AND: [
              { givenName: { contains: rest, mode: 'insensitive' } },
              { surname: { contains: first, mode: 'insensitive' } },
            ],
          },
        );
      }

      // If search is numeric, search contactId too
      if (!isNaN(Number(q))) {
        orConditions.push({ contactId: parseInt(q, 10) });
      }

      where.OR = orConditions;
    }

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async searchContactsQuick(query: string, limit: number = 10) {
    if (!query || query.trim().length === 0) return [];

    const q = query.trim();
    const words = q.split(/\s+/).filter(Boolean);

    const orConditions: any[] = [
      { givenName: { contains: q, mode: 'insensitive' } },
      { surname: { contains: q, mode: 'insensitive' } },
      { emailAddress: { contains: q, mode: 'insensitive' } },
      { mobilePhone: { contains: q, mode: 'insensitive' } },
      { usi: { contains: q, mode: 'insensitive' } },
    ];

    if (words.length >= 2) {
      const first = words[0];
      const rest = words.slice(1).join(' ');
      orConditions.push(
        {
          AND: [
            { givenName: { contains: first, mode: 'insensitive' } },
            { surname: { contains: rest, mode: 'insensitive' } },
          ],
        },
        {
          AND: [
            { givenName: { contains: rest, mode: 'insensitive' } },
            { surname: { contains: first, mode: 'insensitive' } },
          ],
        },
      );
    }

    if (!isNaN(Number(q))) {
      orConditions.push({ contactId: parseInt(q, 10) });
    }

    // Use ILIKE / contains across key contact fields
    const contacts = await this.prisma.contact.findMany({
      where: {
        OR: orConditions,
      },
      take: limit,
      select: {
        id: true,
        contactId: true,
        givenName: true,
        surname: true,
        emailAddress: true,
        mobilePhone: true,
        usi: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return contacts;
  }

  async getContactById(id: number) {
    if (!id || isNaN(id)) {
      throw new BadRequestException('A valid numeric contact ID must be provided');
    }
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!contact) throw new NotFoundException(`Contact with ID ${id} not found`);
    return contact;
  }

  async getContactEnrolments(contactId: number) {
    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException(`Contact with ID ${contactId} not found`);

    const enrolments = await this.prisma.lmsEnrollment.findMany({
      where: { contactId },
      include: {
        learningPlan: {
          include: {
            courseCode: true,
          },
        },
        workshopProgress: true,
      },
      orderBy: { enrolledAt: 'desc' },
    });

    const allPlans = await this.prisma.learningPlan.findMany({
      include: {
        courseCode: true,
      },
      orderBy: { id: 'desc' },
    });

    return {
      enrolments,
      allPlans,
    };
  }

  async updateEnrolment(enrolmentId: string, updateData: any) {
    const enrolment = await this.prisma.lmsEnrollment.findUnique({ where: { id: enrolmentId } });
    if (!enrolment) throw new NotFoundException(`Enrolment with ID ${enrolmentId} not found`);

    const planId = 'learningPlanId' in updateData
      ? (updateData.learningPlanId ? Number(updateData.learningPlanId) : null)
      : enrolment.learningPlanId;

    return this.prisma.lmsEnrollment.update({
      where: { id: enrolmentId },
      data: {
        learningPlanId: planId,
        ...('learningMode' in updateData ? { learningMode: Number(updateData.learningMode) } : {}),
        ...('isCompetent' in updateData ? { isCompetent: Boolean(updateData.isCompetent) } : {}),
        ...('axStatus' in updateData ? { axStatus: updateData.axStatus } : {}),
        ...('isActive' in updateData ? { isActive: Boolean(updateData.isActive) } : {}),
      },
      include: {
        learningPlan: {
          include: {
            courseCode: true,
          },
        },
        workshopProgress: true,
      },
    });
  }

  async updateContactById(id: number, updateData: any) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException(`Contact with ID ${id} not found`);

    delete updateData.id;
    delete updateData.contactId;
    delete updateData.userId;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.user;

    const intFields = [
      'countryId', 'sCountryId', 'sourceCodeId', 'citizenStatusId', 'fkResidencyStatusId',
      'countryOfBirthId', 'countryOfCitizenId', 'indigenousStatusId', 'mainLanguageId',
      'englishProficiencyId', 'highestSchoolLevelId', 'currentSchoolLevel', 'labourForceId',
      'employerContactId', 'payerContactId', 'supervisorContactId', 'coachContactId',
      'agentContactId', 'contactRoleId', 'orgId'
    ];

    for (const field of intFields) {
      if (field in updateData) {
        if (updateData[field] === '' || updateData[field] === null || updateData[field] === undefined) {
          updateData[field] = null;
        } else if (typeof updateData[field] === 'string' && !isNaN(Number(updateData[field]))) {
          updateData[field] = parseInt(updateData[field], 10);
        }
      }
    }

    if ('studyReasonId' in updateData && updateData.studyReasonId != null) {
      updateData.studyReasonId = String(updateData.studyReasonId);
    }

    if ('bypassOnboarding' in updateData) {
      updateData.bypassOnboarding = updateData.bypassOnboarding === true || updateData.bypassOnboarding === 'true';
    }

    const updated = await this.prisma.contact.update({
      where: { id },
      data: updateData,
      include: { user: true },
    });

    // If contactActive status changed on Contact, update linked User.isActive accordingly
    if ('contactActive' in updateData && updated.user) {
      await this.prisma.user.update({
        where: { id: updated.user.id },
        data: { isActive: Boolean(updateData.contactActive) },
      });
      this.logger.log(`Synced user ID ${updated.user.id} isActive to ${Boolean(updateData.contactActive)} due to Contact ID ${id} update`);
    }

    // Best effort push to Axcelerate
    const axId = Number(contact.contactId);
    if (axId && axId > 0 && axId < 900000000) {
      try {
        const axParams = mapContactDataToAxcelerateParams(updated);
        await this.axcelerate.updateContact(axId, axParams);
      } catch (err: any) {
        this.logger.error(`Failed to push contact ${id} update to Axcelerate: ${err.message}`);
      }
    }

    return updated;
  }

  async syncAxcelerateForContact(id: number) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException(`Contact with ID ${id} not found`);

    const axId = Number(contact.contactId);
    if (!axId || axId >= 900000000) {
      throw new BadRequestException('Contact does not have a valid Axcelerate Contact ID');
    }

    const payload = await this.axcelerate.getContactDetail(axId);
    if (!payload || !payload.CONTACTID) {
      throw new NotFoundException(`Could not retrieve details from Axcelerate for Contact ID: ${axId}`);
    }

    const mapped = mapAxceleratePayloadToContactData(payload);

    return this.prisma.contact.update({
      where: { id },
      data: mapped,
      include: { user: true },
    });
  }

  async verifyUsiForContact(id: number, usi?: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException(`Contact with ID ${id} not found`);

    let currentUsi = contact.usi;
    if (usi !== undefined && usi.trim() !== '') {
      currentUsi = usi.trim().toUpperCase();
      await this.prisma.contact.update({
        where: { id },
        data: { usi: currentUsi, usiVerified: false },
      });
    }

    if (!currentUsi) {
      throw new BadRequestException('Contact does not have a USI provided');
    }

    const axId = Number(contact.contactId);
    if (!axId || axId >= 900000000) {
      throw new BadRequestException('Contact does not have a valid Axcelerate Contact ID');
    }

    // Push updated contact details & USI to Axcelerate first
    try {
      const updatedContact = await this.prisma.contact.findUnique({ where: { id } });
      const axParams = mapContactDataToAxcelerateParams(updatedContact);
      await this.axcelerate.updateContact(axId, axParams);
    } catch (err: any) {
      const errDetails = err?.response?.data?.DETAILS || err?.response?.data?.MSG || err?.response?.data?.message || err?.message || 'Failed to update contact on Axcelerate';
      const formattedErr = typeof errDetails === 'object' ? JSON.stringify(errDetails) : String(errDetails);
      this.logger.error(`Failed to push contact ${id} update to Axcelerate before USI verification: ${formattedErr}`);
      throw new BadRequestException(`Failed to sync contact update with Axcelerate: ${formattedErr}`);
    }

    let res: any;
    try {
      res = await this.axcelerate.verifyUSI(axId);
      this.logger.log(`Axcelerate USI verification response for contact ${axId}: ${JSON.stringify(res)}`);
    } catch (err: any) {
      this.logger.error(`Failed to execute USI verification for contact ${axId}: ${err?.message}`);
      throw new BadRequestException(err?.response?.data?.message || err?.message || 'Failed to call Axcelerate USI Verification service');
    }

    const isVerified = Boolean(res?.USI_VERIFIED);

    await this.prisma.contact.update({
      where: { id },
      data: { usiVerified: isVerified },
    });

    return {
      verified: isVerified,
      data: res?.DATA ?? null,
      msg: res?.MSG ?? (isVerified ? 'USI verified successfully' : 'USI verification failed'),
    };
  }

  async linkUserToContact(contactId: number, userId: number) {
    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException(`Contact ${contactId} not found`);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    // Check if user is already linked to another contact
    if (user.contactId && user.contactId !== contactId) {
      throw new BadRequestException(`User ${user.email} is already linked to another contact`);
    }

    // Link user to contact
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        contactId,
        axcelerateContactId: contact.contactId < 900000000 ? String(contact.contactId) : user.axcelerateContactId,
      },
    });

    return this.getContactById(contactId);
  }

  async unlinkUserFromContact(contactId: number) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: { user: true },
    });

    if (!contact) throw new NotFoundException(`Contact ${contactId} not found`);
    if (!contact.user) throw new BadRequestException(`Contact ${contactId} is not linked to any user`);

    await this.prisma.user.update({
      where: { id: contact.user.id },
      data: { contactId: null },
    });

    return this.getContactById(contactId);
  }

  async createUserForContact(contactId: number, customPassword?: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: { user: true },
    });

    if (!contact) throw new NotFoundException(`Contact ${contactId} not found`);
    if (contact.user) throw new BadRequestException(`Contact is already linked to user ${contact.user.email}`);

    if (!contact.emailAddress) {
      throw new BadRequestException('Contact must have an email address to create a user account');
    }

    // Check if user with this email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: contact.emailAddress },
    });

    if (existingUser) {
      // Auto link existing user
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          contactId: contact.id,
          axcelerateContactId: contact.contactId < 900000000 ? String(contact.contactId) : existingUser.axcelerateContactId,
        },
      });
      return this.getContactById(contactId);
    }

    const name = [contact.givenName, contact.surname].filter(Boolean).join(' ') || 'Student User';
    const rawPassword = customPassword || 'LSFA' + Math.floor(100000 + Math.random() * 900000);
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const newUser = await this.prisma.user.create({
      data: {
        email: contact.emailAddress,
        name,
        passwordHash,
        role: 'STUDENT',
        isActive: true,
        contactId: contact.id,
        axcelerateContactId: contact.contactId < 900000000 ? String(contact.contactId) : null,
      },
    });

    return {
      contact: await this.getContactById(contactId),
      createdUser: {
        id: newUser.id,
        email: newUser.email,
        temporaryPassword: rawPassword,
      },
    };
  }

  async syncUsersWithVerifiedUsiStream(verifyAxcelerate: boolean, onEvent: (event: any) => void) {
    this.logger.log(`Starting contact-to-user stream sync routine (verifyAxcelerate: ${verifyAxcelerate})...`);

    // Where condition: emailAddress exists and non-empty, and at least givenName or surname exists
    const whereClause: any = {
      emailAddress: { not: '' },
      OR: [
        { givenName: { not: '' } },
        { surname: { not: '' } },
      ],
    };

    // Count total matching contacts
    const totalVerifiedContacts = await this.prisma.contact.count({
      where: whereClause,
    });

    onEvent({
      type: 'start',
      totalVerifiedContacts,
    });

    let processedCount = 0;
    let linkedExistingCount = 0;
    let createdCount = 0;
    let skippedAlreadyLinkedCount = 0;
    let deactivatedDeletedCount = 0;
    let deactivatedInactiveCount = 0;
    const deactivatedDetails: Array<{ contactId: number; axcelerateContactId: number; email: string; reason: 'DELETED' | 'INACTIVE'; message: string }> = [];
    const conflicts: Array<{ contactId: number; email: string; userAlreadyLinkedToContactId: number; reason: string }> = [];

    const bcrypt = await import('bcrypt');
    const chunkSize = verifyAxcelerate ? 10 : 100;

    for (let skip = 0; skip < totalVerifiedContacts; skip += chunkSize) {
      // Fetch a chunk of contacts with select to keep memory minimal
      const chunk = await this.prisma.contact.findMany({
        where: whereClause,
        skip,
        take: chunkSize,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          contactId: true,
          givenName: true,
          surname: true,
          emailAddress: true,
          contactActive: true,
          user: {
            select: { id: true, isActive: true },
          },
        },
      });

      for (const contact of chunk) {
        processedCount++;
        if (!contact.emailAddress) continue;
        const email = contact.emailAddress.trim().toLowerCase();

        // Optional: Reconcile with Axcelerate API directly to check if contact is active or deleted
        if (verifyAxcelerate && contact.contactId && contact.contactId > 0 && contact.contactId < 900000000) {
          // Rate-limit throttle: 335ms delay enforces ~180 requests/minute max (3 req/sec)
          await new Promise(res => setTimeout(res, 335));

          let axPayload: any = null;
          let fetchSuccess = false;
          let attempts = 0;

          while (!fetchSuccess && attempts < 3) {
            attempts++;
            try {
              axPayload = await this.axcelerate.getContactDetail(contact.contactId);
              fetchSuccess = true;
            } catch (err: any) {
              const status = err?.status || err?.response?.status;
              const errDetails = err?.response?.data?.DETAILS || err?.message || '';
              const isNotAllowed = typeof errDetails === 'string' && errDetails.includes('You are not allowed to view contact details for User no: 0');
              const isNotFound = status === 404;
              const isRateLimited = status === 429;

              if (isRateLimited) {
                const retryAfterHeader = err?.response?.headers?.['retry-after'];
                const waitSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) + 1 : 10;
                this.logger.warn(`[Sync Reconcile] Rate limited (429) on Contact ID ${contact.contactId}. Waiting ${waitSeconds}s per Retry-After header (attempt ${attempts}/3)...`);
                await new Promise(res => setTimeout(res, waitSeconds * 1000));
                continue; // Retry loop
              }

              if (isNotAllowed || isNotFound) {
                // Deactivate contact and user due to DELETED in Axcelerate
                await this.prisma.contact.update({
                  where: { id: contact.id },
                  data: { contactActive: false },
                });
                if (contact.user) {
                  await this.prisma.user.update({
                    where: { id: contact.user.id },
                    data: { isActive: false },
                  });
                }
                deactivatedDeletedCount++;
                deactivatedDetails.push({
                  contactId: contact.id,
                  axcelerateContactId: contact.contactId,
                  email,
                  reason: 'DELETED',
                  message: `Axcelerate returned deleted status: ${errDetails || '404 Not Found'}`,
                });
                this.logger.log(`[Sync Reconcile] Deactivated Contact ID ${contact.id} (Axcelerate ID ${contact.contactId}): DELETED in Axcelerate (${errDetails})`);
                break; // Handled deletion, exit retry loop
              }

              // Transient error (500, network error): log warning and skip contact without deactivating
              this.logger.warn(`Axcelerate lookup error during sync for contact ID ${contact.contactId}: ${err.message}`);
              break; // Exit retry loop
            }
          }

          if (fetchSuccess) {
            if (!axPayload || !axPayload.CONTACTID || axPayload.CONTACTACTIVE === false) {
              // Deactivate local contact and linked user due to INACTIVE flag
              await this.prisma.contact.update({
                where: { id: contact.id },
                data: { contactActive: false },
              });
              if (contact.user) {
                await this.prisma.user.update({
                  where: { id: contact.user.id },
                  data: { isActive: false },
                });
              }
              deactivatedInactiveCount++;
              deactivatedDetails.push({
                contactId: contact.id,
                axcelerateContactId: contact.contactId,
                email,
                reason: 'INACTIVE',
                message: `Axcelerate contact ID ${contact.contactId} has CONTACTACTIVE = false`,
              });
              this.logger.log(`[Sync Reconcile] Deactivated Contact ID ${contact.id} (Axcelerate ID ${contact.contactId}): INACTIVE in Axcelerate`);
              continue;
            } else {
              // Update mapped details if active
              const mapped = mapAxceleratePayloadToContactData(axPayload);
              await this.prisma.contact.update({
                where: { id: contact.id },
                data: mapped,
              });
            }
          } else {
            // If fetch was skipped due to deletion or unrecoverable error, move to next contact
            continue;
          }
        }

        // Case: Contact is already linked to a user account
        if (contact.user) {
          // Ensure both contact and linked user are active
          if (!contact.contactActive || !contact.user.isActive) {
            await this.prisma.contact.update({
              where: { id: contact.id },
              data: { contactActive: true },
            });
            await this.prisma.user.update({
              where: { id: contact.user.id },
              data: { isActive: true },
            });
            this.logger.log(`[Sync Stream] Reactivated Contact ID ${contact.id} and linked User ID ${contact.user.id}`);
          }
          skippedAlreadyLinkedCount++;
          continue;
        }

        // Check if a user with this email address already exists
        const existingUser = await this.prisma.user.findUnique({
          where: { email },
          select: { id: true, contactId: true, axcelerateContactId: true },
        });

        if (existingUser) {
          // If that existing user is ALREADY linked to another contact, log conflict and skip
          if (existingUser.contactId && existingUser.contactId !== contact.id) {
            conflicts.push({
              contactId: contact.id,
              email,
              userAlreadyLinkedToContactId: existingUser.contactId,
              reason: `User ${email} (ID: ${existingUser.id}) is already linked to Contact ID ${existingUser.contactId}. Cannot link to Contact ID ${contact.id}.`,
            });
            continue;
          }

          // Link existing user to this contact
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: {
              contactId: contact.id,
              axcelerateContactId: contact.contactId < 900000000 ? String(contact.contactId) : existingUser.axcelerateContactId,
            },
          });
          linkedExistingCount++;
        } else {
          // Create new STUDENT role user account
          const name = [contact.givenName, contact.surname].filter(Boolean).join(' ') || 'Student User';
          const rawPassword = 'LSFA' + Math.floor(100000 + Math.random() * 900000);
          const passwordHash = await bcrypt.hash(rawPassword, 10);

          await this.prisma.user.create({
            data: {
              email,
              name,
              passwordHash,
              role: 'STUDENT',
              isActive: true,
              contactId: contact.id,
              axcelerateContactId: contact.contactId < 900000000 ? String(contact.contactId) : null,
            },
          });
          createdCount++;
        }
      } // <--- closes for (const contact of chunk)

      // Emit progress after each chunk
      onEvent({
        type: 'progress',
        totalVerifiedContacts,
        processedCount,
        linkedExistingCount,
        createdCount,
        skippedAlreadyLinkedCount,
        deactivatedDeletedCount,
        deactivatedInactiveCount,
        deactivatedCount: deactivatedDeletedCount + deactivatedInactiveCount,
        conflictCount: conflicts.length,
      });
    }

    this.logger.log(`Verified USI stream sync finished: ${processedCount} processed, ${linkedExistingCount} linked to existing users, ${createdCount} created, ${skippedAlreadyLinkedCount} already linked, ${deactivatedDeletedCount} deleted, ${deactivatedInactiveCount} inactive, ${conflicts.length} conflicts.`);

    onEvent({
      type: 'complete',
      summary: {
        totalVerifiedContacts,
        processedCount,
        linkedExistingCount,
        createdCount,
        skippedAlreadyLinkedCount,
        deactivatedDeletedCount,
        deactivatedInactiveCount,
        deactivatedCount: deactivatedDeletedCount + deactivatedInactiveCount,
        conflictCount: conflicts.length,
      },
      deactivatedDetails,
      conflicts,
    });
  }

  async syncUsersWithVerifiedUsi() {
    this.logger.log('Starting contact-to-user sync routine...');

    // Find all contacts with non-empty emailAddress and at least one name
    const contacts = await this.prisma.contact.findMany({
      where: {
        emailAddress: { not: '' },
        OR: [
          { givenName: { not: '' } },
          { surname: { not: '' } },
        ],
      },
      include: {
        user: true,
      },
    });

    let processedCount = 0;
    let linkedExistingCount = 0;
    let createdCount = 0;
    let skippedAlreadyLinkedCount = 0;
    const conflicts: Array<{ contactId: number; email: string; userAlreadyLinkedToContactId: number; reason: string }> = [];

    const bcrypt = await import('bcrypt');

    for (const contact of contacts) {
      processedCount++;
      if (!contact.emailAddress) continue;
      const email = contact.emailAddress.trim().toLowerCase();

      // Case: Contact is already linked to a user account
      if (contact.user) {
        skippedAlreadyLinkedCount++;
        continue;
      }

      // Check if a user with this email address already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        // If that existing user is ALREADY linked to another contact, log conflict and skip
        if (existingUser.contactId && existingUser.contactId !== contact.id) {
          conflicts.push({
            contactId: contact.id,
            email,
            userAlreadyLinkedToContactId: existingUser.contactId,
            reason: `User ${email} (ID: ${existingUser.id}) is already linked to Contact ID ${existingUser.contactId}. Cannot link to Contact ID ${contact.id}.`,
          });
          continue;
        }

        // Link existing user to this contact
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            contactId: contact.id,
            axcelerateContactId: contact.contactId < 900000000 ? String(contact.contactId) : existingUser.axcelerateContactId,
          },
        });
        linkedExistingCount++;
      } else {
        // Create new STUDENT role user account
        const name = [contact.givenName, contact.surname].filter(Boolean).join(' ') || 'Student User';
        const rawPassword = 'LSFA' + Math.floor(100000 + Math.random() * 900000);
        const passwordHash = await bcrypt.hash(rawPassword, 10);

        await this.prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: 'STUDENT',
            isActive: true,
            contactId: contact.id,
            axcelerateContactId: contact.contactId < 900000000 ? String(contact.contactId) : null,
          },
        });
        createdCount++;
      }
    }

    this.logger.log(`Verified USI sync finished: ${processedCount} processed, ${linkedExistingCount} linked to existing users, ${createdCount} created, ${skippedAlreadyLinkedCount} already linked, ${conflicts.length} conflicts.`);

    return {
      success: true,
      summary: {
        totalVerifiedContacts: contacts.length,
        processedCount,
        linkedExistingCount,
        createdCount,
        skippedAlreadyLinkedCount,
        conflictCount: conflicts.length,
      },
      conflicts,
    };
  }

  async handleMergedContacts(keptAxContactId: number, mergedAxContactIds: number[]) {
    this.logger.log(`Handling merged contacts in webhook: Keeping Axcelerate Contact ID ${keptAxContactId}, deactivating merged IDs: ${mergedAxContactIds.join(', ')}`);

    // 1. FIRST: Process all merged contacts: deactivate local contact records and their linked users
    for (const mergedAxId of mergedAxContactIds) {
      const mergedContact = await this.prisma.contact.findUnique({
        where: { contactId: mergedAxId },
        include: { user: true },
      });

      if (!mergedContact) {
        this.logger.log(`Merged contact ID ${mergedAxId} not found in local DB. Skipping.`);
        continue;
      }

      // Mark local merged contact as inactive
      await this.prisma.contact.update({
        where: { id: mergedContact.id },
        data: { contactActive: false },
      });

      // If the merged contact was linked to a user account, deactivate it and clear contact link
      if (mergedContact.user) {
        await this.prisma.user.update({
          where: { id: mergedContact.user.id },
          data: {
            isActive: false,
            contactId: null,
          },
        });
        this.logger.log(`Deactivated User ID ${mergedContact.user.id} previously linked to merged Contact ID ${mergedContact.id}`);
      }
    }

    // 2. SECOND: Sync & update/create the kept target contact from Axcelerate & link/reactivate its user
    await this.syncSingleContactById(keptAxContactId);
  }

  async syncSingleContactById(axId: number) {
    const payload = await this.axcelerate.getContactDetail(axId);
    if (!payload || !payload.CONTACTID) {
      throw new NotFoundException(`Could not retrieve details from Axcelerate for Contact ID: ${axId}`);
    }

    const mapped = mapAxceleratePayloadToContactData(payload);

    const contact = await this.prisma.contact.upsert({
      where: { contactId: mapped.contactId },
      create: mapped,
      update: mapped,
      include: { user: true },
    });

    // Auto-link user account if emailAddress exists and contact is not already linked
    if (contact.emailAddress && contact.emailAddress.trim().length > 0 && !contact.user) {
      const email = contact.emailAddress.trim().toLowerCase();

      // Check if user with this email already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        if (!existingUser.contactId || existingUser.contactId === contact.id) {
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: {
              contactId: contact.id,
              axcelerateContactId: contact.contactId < 900000000 ? String(contact.contactId) : existingUser.axcelerateContactId,
            },
          });
          this.logger.log(`Linked contact ID ${contact.id} (${email}) to existing user ID ${existingUser.id}`);
        } else {
          this.logger.warn(`User ${email} (ID: ${existingUser.id}) is already linked to Contact ID ${existingUser.contactId}. Skipped linking Contact ID ${contact.id}.`);
        }
      } else {
        // Create new STUDENT role user
        const name = [contact.givenName, contact.surname].filter(Boolean).join(' ') || 'Student User';
        const rawPassword = 'LSFA' + Math.floor(100000 + Math.random() * 900000);
        const bcrypt = await import('bcrypt');
        const passwordHash = await bcrypt.hash(rawPassword, 10);

        const newUser = await this.prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: 'STUDENT',
            isActive: true,
            contactId: contact.id,
            axcelerateContactId: contact.contactId < 900000000 ? String(contact.contactId) : null,
          },
        });
        this.logger.log(`Created new STUDENT user ID ${newUser.id} (${email}) for contact ID ${contact.id}`);
      }
    }

    return contact;
  }

  async handleWorkshopEnrolmentWebhook(type: string, enrolmentPayload: any) {
    if (!enrolmentPayload) return;

    const axContactId = enrolmentPayload?.student?.contactId ? Number(enrolmentPayload.student.contactId) : null;
    const instanceId = enrolmentPayload?.workshop?.id ? Number(enrolmentPayload.workshop.id) : null;
    const axStatus = enrolmentPayload?.status ? String(enrolmentPayload.status) : null;

    if (!axContactId || !instanceId) {
      this.logger.warn(`Missing contactId (${axContactId}) or instanceId (${instanceId}) in workshop enrolment webhook`);
      return;
    }

    this.logger.log(`Handling workshop enrolment webhook (${type}): axContactId=${axContactId}, instanceId=${instanceId}, status=${axStatus}`);

    // 1. Ensure local Contact record exists
    let contact = await this.prisma.contact.findUnique({
      where: { contactId: axContactId },
    });

    if (!contact) {
      this.logger.log(`Local contact with Axcelerate ID ${axContactId} not found. Syncing from Axcelerate...`);
      try {
        contact = await this.syncSingleContactById(axContactId);
      } catch (err: any) {
        this.logger.error(`Failed to sync contact ${axContactId} during workshop enrolment webhook: ${err.message}`);
        return;
      }
    }

    // 2. Ensure a WorkshopProgress record exists for instanceId so foreign key constraint is satisfied
    const wp = await this.prisma.workshopProgress.upsert({
      where: { instanceId },
      update: {},
      create: {
        instanceId,
        completedSteps: 0,
        totalSteps: 3,
        isComplete: false,
        lmsEnabled: false,
      },
    });

    const isLsfaLms = wp.lmsEnabled === true;
    const learningPlanId = isLsfaLms && wp.learningPlanId ? wp.learningPlanId : null;

    // 3. Handle deletion vs creation/update
    if (type === 'student.workshop_enrolment_deleted') {
      const deleted = await this.prisma.lmsEnrollment.deleteMany({
        where: {
          contactId: contact.id,
          instanceId,
        },
      });
      this.logger.log(`Deleted ${deleted.count} enrolment record(s) for contactId=${contact.id}, instanceId=${instanceId}`);
      return;
    }

    // Created, updated, or status_changed:
    const existing = await this.prisma.lmsEnrollment.findFirst({
      where: {
        contactId: contact.id,
        instanceId,
      },
    });

    if (existing) {
      await this.prisma.lmsEnrollment.update({
        where: { id: existing.id },
        data: {
          axStatus: axStatus ?? existing.axStatus,
          isActive: true,
          ...(learningPlanId ? { learningPlanId } : {}),
        },
      });
      this.logger.log(`Updated enrolment ${existing.id} with status=${axStatus}`);
    } else {
      const created = await this.prisma.lmsEnrollment.create({
        data: {
          contactId: contact.id,
          instanceId,
          learningPlanId,
          axStatus,
          isActive: true,
        },
      });
      this.logger.log(`Created new enrolment ${created.id} for contactId=${contact.id}, instanceId=${instanceId}, axStatus=${axStatus}`);
    }
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

function mapContactDataToAxcelerateParams(c: any): Record<string, any> {
  const params: Record<string, any> = {};

  if (c.givenName) params.givenName = c.givenName;
  if (c.surname) params.surname = c.surname;
  if (c.middleName) params.middleName = c.middleName;
  if (c.title) params.title = c.title;
  if (c.emailAddress) params.emailAddress = c.emailAddress;
  if (c.emailAddressAlternative) params.EmailAddressAlternative = c.emailAddressAlternative;
  if (c.sex) params.sex = c.sex;
  if (c.dob) params.dob = c.dob;

  if (c.phone) params.phone = c.phone;
  if (c.mobilePhone) params.mobilephone = c.mobilePhone;
  if (c.workPhone) params.workphone = c.workPhone;

  if (c.usi) params.USI = c.usi;
  if (c.usiVerified != null) params.USI_VERIFIED = c.usiVerified;
  if (c.usiExemption != null) params.USI_EXEMPTION = c.usiExemption;
  if (c.historicClientId) params.HistoricClientID = c.historicClientId;
  if (c.vsn) params.VSN = c.vsn;
  if (c.lui) params.LUI = c.lui;

  // AVETMISS 7.0 Residential Address
  if (c.unitNo) params.sunitNo = c.unitNo;
  if (c.buildingName) params.sbuildingName = c.buildingName;
  if (c.address1) params.saddress1 = c.address1;
  if (c.address2) params.saddress2 = c.address2;
  if (c.city) params.scity = c.city;
  if (c.state) params.sstate = c.state;
  if (c.postcode) params.spostcode = c.postcode;
  if (c.countryId) params.scountryID = c.countryId;
  if (c.country) params.scountry = c.country;

  // Postal Address
  if (c.unitNo) params.unitNo = c.unitNo;
  if (c.buildingName) params.buildingName = c.buildingName;
  if (c.address1) params.address1 = c.address1;
  if (c.address2) params.address2 = c.address2;
  if (c.city) params.city = c.city;
  if (c.state) params.state = c.state;
  if (c.postcode) params.postcode = c.postcode;
  if (c.countryId) params.countryID = c.countryId;
  if (c.country) params.country = c.country;

  // Background & AVETMISS
  if (c.countryOfBirthId) params.CountryofBirthID = c.countryOfBirthId;
  if (c.countryOfCitizenId) params.CountryofCitizenID = c.countryOfCitizenId;
  if (c.citizenStatusId) params.CitizenStatusID = c.citizenStatusId;
  if (c.indigenousStatusId) params.IndigenousStatusID = c.indigenousStatusId;
  if (c.mainLanguageId) params.MainLanguageID = c.mainLanguageId;
  if (c.englishProficiencyId) params.EnglishProficiencyID = c.englishProficiencyId;
  if (c.englishAssistanceFlag != null) params.EnglishAssistanceFlag = c.englishAssistanceFlag;

  if (c.highestSchoolLevelId) params.HighestSchoolLevelID = c.highestSchoolLevelId;
  if (c.highestSchoolLevelYear) params.HighestSchoolLevelYear = c.highestSchoolLevelYear;
  if (c.atSchoolFlag != null) params.AtSchoolFlag = c.atSchoolFlag;
  if (c.labourForceId) params.LabourForceID = c.labourForceId;
  if (c.customFieldCJobTitle) params.customField_c_jobtitle = c.customFieldCJobTitle;
  if (c.customFieldJobTitle) params.customField_s_jobtitle = c.customFieldJobTitle;

  if (c.priorEducationStatus != null) params.PriorEducationStatus = c.priorEducationStatus;
  if (Array.isArray(c.priorEducationIds) && c.priorEducationIds.length > 0) {
    params.PriorEducationIDs = c.priorEducationIds.join(',');
  }

  if (c.disabilityFlag != null) params.DisabilityFlag = c.disabilityFlag;
  if (Array.isArray(c.disabilityTypeIds) && c.disabilityTypeIds.length > 0) {
    params.DisabilityTypeIDs = c.disabilityTypeIds.join(',');
  }

  if (c.emergencyContact) params.EmergencyContact = c.emergencyContact;
  if (c.emergencyContactRelation) params.EmergencyContactRelation = c.emergencyContactRelation;
  if (c.emergencyContactPhone) params.EmergencyContactPhone = c.emergencyContactPhone;

  if (c.customFieldAdditionalSupport != null) params.customField_b_additionalsupport = c.customFieldAdditionalSupport;
  if (c.customFieldAdditionalSupportRequired != null) params.customField_s_additionalsupportrequired = c.customFieldAdditionalSupportRequired;
  if (c.customFieldCombinedDeclaration != null) params.customField_b_combineddeclaration = c.customFieldCombinedDeclaration;
  if (c.customFieldMarketingPermission != null) params.customField_b_marketingpermission = c.customFieldMarketingPermission;

  if (c.customFieldUsiPermission) params.customField_b_usipermission = c.customFieldUsiPermission;
  if (c.customFieldWellbeingRequirements) params.customField_s_wellbeingrequirements = c.customFieldWellbeingRequirements;
  if (Array.isArray(c.customFieldPreviousCerts) && c.customFieldPreviousCerts.length > 0) {
    params.customField_c_previouscerts = c.customFieldPreviousCerts.join(',');
  }
  if (Array.isArray(c.customFieldPreviousJobTitles) && c.customFieldPreviousJobTitles.length > 0) {
    params.customField_c_previousjobtitles = c.customFieldPreviousJobTitles.join(',');
  }
  if (c.customFieldPreviousJobTitlesOther) params.customField_s_previousjobtitlesother = c.customFieldPreviousJobTitlesOther;

  return params;
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