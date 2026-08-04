import { Controller, Post, Body, Request, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, VerifyMfaDto, ImpersonateDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password, dto.deviceToken);
  }

  @Post('verify-mfa')
  verifyMfa(@Body() dto: VerifyMfaDto) {
    return this.authService.verifyMfa(dto.email, dto.code, dto.trustDevice);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.mfaCode, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_USER', 'ADMIN')
  @Post('impersonate')
  impersonate(@Request() req, @Body() dto: ImpersonateDto) {
    return this.authService.impersonate(req.user.id, req.user.role, dto.trainerId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_USER', 'ADMIN')
  @Post('stop-impersonating')
  stopImpersonating(@Request() req) {
    return this.authService.stopImpersonating(req.user.id);
  }
}
