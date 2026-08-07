import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
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

  async login(email: string, password: string, deviceToken?: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // Check trusted device
    if (deviceToken) {
      const trusted = await this.prisma.trustedDevice.findUnique({
        where: { deviceKey: deviceToken },
      });

      if (trusted && trusted.userId === user.id && trusted.expiresAt > new Date()) {
        // Device is trusted — skip MFA and issue token directly
        const tokenResult = await this.issueToken(user.id, user.email, user.role);
        return { requiresMfa: false, ...tokenResult };
      }
    }

    // Require MFA
    await this.sendMfaCode(user);
    return { requiresMfa: true, email: user.email };
  }

  async verifyMfa(email: string, code: string, trustDevice?: boolean) {
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

    let newDeviceToken: string | undefined;

    // Create trusted device if requested
    if (trustDevice) {
      newDeviceToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await this.prisma.trustedDevice.create({
        data: {
          userId: user.id,
          deviceKey: newDeviceToken,
          expiresAt,
        },
      });
    }

    const tokenResult = await this.issueToken(user.id, user.email, user.role);
    return {
      ...tokenResult,
      deviceToken: newDeviceToken,
    };
  }

  async magicLogin(token: string) {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new UnauthorizedException('Invalid magic link');
    }

    const user = await this.prisma.user.findUnique({
      where: { magicToken: token.trim() },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid or inactive magic link');
    }

    // Check setting auto_login_require_mfa
    const settingRow = await this.prisma.setting.findUnique({
      where: { key: 'auto_login_require_mfa' },
    });
    const requireMfaSetting = settingRow?.value === 'true';

    // MFA verification is always necessary for roles other than STUDENT
    // Or if auto_login_require_mfa setting is enabled
    const requireMfa = user.role !== 'STUDENT' || requireMfaSetting;

    if (requireMfa) {
      await this.sendMfaCode(user);
      return { requiresMfa: true, email: user.email };
    } else {
      const tokenResult = await this.issueToken(user.id, user.email, user.role);
      return { requiresMfa: false, ...tokenResult };
    }
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Always return success message even if email doesn't exist for security
    if (!user || !user.isActive) {
      return { message: 'If your email exists in our system, you will receive a reset email.' };
    }

    // Generate reset token and MFA code
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour token
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const mfaExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiresAt: resetExpiresAt,
        mfaCode: code,
        mfaExpiresAt: mfaExpiresAt,
      },
    });

    const publicBaseUrl = this.config.get<string>('PUBLIC_BASE_URL') || 'http://localhost:5173';
    const resetLink = `${publicBaseUrl.replace(/\/+$/, '')}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
    const fromEmail = this.config.get<string>('RESEND_FROM_EMAIL') || 'noreply@eml.klefen.com.au';

    if (this.resend) {
      await this.resend.emails.send({
        from: fromEmail,
        to: user.email,
        subject: 'Reset your LSFA Central password',
        html: `
          <p>Hi ${user.name},</p>
          <p>You requested to reset your password for LSFA Central.</p>
          <p>Click the link below to open the password reset page:</p>
          <p><a href="${resetLink}" style="padding: 10px 18px; background-color: #E30613; color: white; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a></p>
          <p>Your verification code for the reset page is:</p>
          <h2 style="letter-spacing: 0.3em;">${code}</h2>
          <p>This code and link expire in 60 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        `,
      });
    } else {
      console.log(`[DEV] Password reset for ${user.email}: token=${resetToken}, code=${code}`);
      console.log(`[DEV] Reset link: ${resetLink}`);
    }

    return { message: 'If your email exists in our system, you will receive a reset email.' };
  }

  async resetPassword(token: string, mfaCode: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (
      !user.mfaCode ||
      !user.mfaExpiresAt ||
      user.mfaCode !== mfaCode ||
      user.mfaExpiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password, clear reset token & MFA code
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
        mfaCode: null,
        mfaExpiresAt: null,
      },
    });

    // Auto log in user
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
