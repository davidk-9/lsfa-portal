import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AxcelerateService } from '../axcelerate/axcelerate.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private axcelerate: AxcelerateService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        axcelerateContactId: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findAllPaginated(page: number = 1, limit: number = 20, search: string = '', role?: string, status: string = 'active') {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (role && role.trim()) {
      where.role = role.trim();
    }

    if (search && search.trim()) {
      const q = search.trim();
      const words = q.split(/\s+/).filter(Boolean);

      const orConditions: any[] = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];

      if (words.length >= 2) {
        orConditions.push({
          AND: [
            { name: { contains: words[0], mode: 'insensitive' } },
            { name: { contains: words.slice(1).join(' '), mode: 'insensitive' } },
          ],
        });
      }

      if (!isNaN(Number(q))) {
        orConditions.push({ id: parseInt(q, 10) });
      }

      where.OR = orConditions;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          axcelerateContactId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findTrainers() {
    return this.prisma.user.findMany({
      where: { role: 'TRAINER', isActive: true },
      select: { id: true, name: true, email: true, axcelerateContactId: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        axcelerateContactId: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(dto: CreateUserDto, createdById: number) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: dto.role,
        axcelerateContactId: dto.axcelerateContactId,
        createdById,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        axcelerateContactId: true,
        createdAt: true,
      },
    });
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findById(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        axcelerateContactId: true,
        contactId: true,
        createdAt: true,
      },
    });

    if ('isActive' in dto && updated.contactId) {
      await this.prisma.contact.update({
        where: { id: updated.contactId },
        data: { contactActive: Boolean(dto.isActive) },
      });
    }

    return updated;
  }

  async archive(id: number) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    if (user.contactId) {
      await this.prisma.contact.update({
        where: { id: user.contactId },
        data: { contactActive: false },
      });
    }
    return user;
  }

  async restore(id: number) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
    if (user.contactId) {
      await this.prisma.contact.update({
        where: { id: user.contactId },
        data: { contactActive: true },
      });
    }
    return user;
  }

  async deactivate(id: number) {
    return this.archive(id);
  }

  async lookupAxcelerateContact(email: string) {
    if (!email || email.endsWith('@example.com') || email.endsWith('@test.com')) {
      return null;
    }
    return this.axcelerate.lookupContactByEmail(email);
  }

  async generateMagicLink(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { contact: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const token = crypto.randomBytes(32).toString('hex');

    await this.prisma.user.update({
      where: { id },
      data: { magicToken: token },
    });

    const settingRow = await this.prisma.setting.findUnique({
      where: { key: 'public_base_url' },
    });
    let baseUrl = settingRow?.value || 'https://lsfa.klefen.com.au';
    baseUrl = baseUrl.trim().replace(/\/+$/, '');

    const fullMagicLink = `${baseUrl}/autolog?key=${token}`;

    let axcelerateSynced = false;
    let axContactId: number | null = null;

    let rawContactId = user.axcelerateContactId;
    if (!rawContactId && user.contact?.contactId) {
      rawContactId = String(user.contact.contactId);
    }

    if (rawContactId) {
      axContactId = parseInt(rawContactId, 10);
    }

    if (axContactId && !isNaN(axContactId) && axContactId > 0 && axContactId < 900000000) {
      try {
        await this.axcelerate.updateContact(axContactId, {
          customField_u_lsfalink: fullMagicLink,
        });
        axcelerateSynced = true;

        if (user.contact) {
          await this.prisma.contact.update({
            where: { id: user.contact.id },
            data: { customFieldULsfaLink: fullMagicLink },
          });
        }
      } catch (err: any) {
        console.error(`Failed to sync magic link for contact ${axContactId}:`, err?.message);
      }
    }

    return {
      userId: user.id,
      email: user.email,
      magicToken: token,
      fullMagicLink,
      axcelerateSynced,
      axcelerateContactId: axContactId,
    };
  }
}
