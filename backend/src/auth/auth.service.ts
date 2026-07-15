import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private resend: Resend | null;

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {
    const key = this.config.get<string>('RESEND_API_KEY');
    this.resend = key ? new Resend(key) : null;
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // All roles require MFA
    await this.sendMfaCode(user);
    return { requiresMfa: true, email: user.email };
  }

  async verifyMfa(email: string, code: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (
      !user.mfaCode ||
      !user.mfaExpiresAt ||
      user.mfaCode !== code ||
      user.mfaExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired MFA code');
    }

    // Clear MFA code
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaCode: null, mfaExpiresAt: null },
    });

    return this.issueToken(user.id, user.email, user.role);
  }

  async impersonate(requestingUserId: number, requestingUserRole: string, trainerId: number) {
    if (requestingUserRole !== 'SUPER_USER' && requestingUserRole !== 'ADMIN') {
      throw new ForbiddenException('Only Super Users and Admins can impersonate trainers');
    }

    const trainer = await this.usersService.findById(trainerId);
    if (!trainer) throw new NotFoundException('Trainer not found');
    if (trainer.role !== 'TRAINER') throw new BadRequestException('Can only impersonate trainers');

    const requestingUser = await this.usersService.findById(requestingUserId);

    // Token carries: real user identity + who they're impersonating + trainer's Axcelerate contact ID
    const payload = {
      sub: requestingUserId,
      email: requestingUser.email,
      role: requestingUserRole,
      axcelerateContactId: requestingUser.axcelerateContactId ?? null,
      impersonating: trainerId,
      impersonatingName: trainer.name,
      impersonatingAxcelerateContactId: trainer.axcelerateContactId ?? null,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      impersonatingId: trainerId,
      impersonatingName: trainer.name,
      impersonatingAxcelerateContactId: trainer.axcelerateContactId ?? null,
    };
  }

  async stopImpersonating(userId: number) {
    const user = await this.usersService.findById(userId);
    return this.issueToken(user.id, user.email, user.role as string);
  }

  private async sendMfaCode(user: { id: number; email: string; name: string }) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMinutes = this.config.get<number>('MFA_EXPIRY_MINUTES') ?? 10;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaCode: code, mfaExpiresAt: expiresAt },
    });

    const fromEmail = this.config.get<string>('RESEND_FROM_EMAIL');

    // Only attempt to send if Resend is configured
    if (this.resend) {
      await this.resend.emails.send({
        from: fromEmail ?? 'noreply@lsfa.com.au',
        to: user.email,
        subject: 'Your LSFA Central login code',
        html: `
          <p>Hi ${user.name},</p>
          <p>Your login verification code is:</p>
          <h2 style="letter-spacing: 0.3em;">${code}</h2>
          <p>This code expires in ${expiryMinutes} minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        `,
      });
    } else {
      // Dev mode: log the code to console
      console.log(`[DEV] MFA code for ${user.email}: ${code}`);
    }
  }

  private async issueToken(userId: number, email: string, role: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { axcelerateContactId: true } });
    const payload = { sub: userId, email, role, axcelerateContactId: user?.axcelerateContactId ?? null };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: userId, email, role, axcelerateContactId: user?.axcelerateContactId ?? null },
    };
  }
}
