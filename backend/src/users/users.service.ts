import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
    return this.prisma.user.update({
      where: { id },
      data: dto,
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

  async archive(id: number) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async restore(id: number) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async deactivate(id: number) {
    return this.archive(id);
  }

  async lookupAxcelerateContact(email: string) {
    return this.axcelerate.lookupContactByEmail(email);
  }
}
