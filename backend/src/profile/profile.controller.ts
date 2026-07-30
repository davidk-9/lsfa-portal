import { Controller, Get, Patch, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  getProfile(@Request() req) {
    return this.profileService.getProfile(req.user.id);
  }

  @Patch('me')
  updateProfile(@Request() req, @Body() dto: { name?: string; email?: string; axcelerateContactId?: string }) {
    return this.profileService.updateProfile(req.user.id, dto);
  }

  @Post('change-password')
  changePassword(@Request() req, @Body() dto: { newPassword: string }) {
    return this.profileService.changePassword(req.user.id, dto);
  }
}