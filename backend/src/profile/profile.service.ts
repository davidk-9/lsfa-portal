import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private contactsService: ContactsService,
  ) {}

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        axcelerateContactId: true,
        contactId: true,
        createdAt: true,
        contact: {
          select: {
            id: true,
            contactId: true,
            givenName: true,
            surname: true,
            mobilePhone: true,
            emailAddress: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: number, dto: { name?: string; email?: string; axcelerateContactId?: string }) {
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id: userId } },
      });
      if (existing) throw new ConflictException('Email address is already in use by another user');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.axcelerateContactId !== undefined) data.axcelerateContactId = dto.axcelerateContactId || null;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
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

    // If axcelerateContactId was updated, trigger a sync to link the contact record
    if (dto.axcelerateContactId) {
      try {
        await this.contactsService.syncAxcelerateForUser(userId, parseInt(dto.axcelerateContactId, 10));
      } catch (e) {
        // Ignored if sync fails, user record is still updated
      }
    }

    return updatedUser;
  }

  async changePassword(userId: number, dto: { newPassword: string }) {
    if (!dto.newPassword) {
      throw new BadRequestException('New password is required');
    }

    if (dto.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters long');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }
}