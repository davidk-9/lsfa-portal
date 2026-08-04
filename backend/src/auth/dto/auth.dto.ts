import { IsEmail, IsNotEmpty, IsString, IsInt, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  deviceToken?: string;
}

export class VerifyMfaDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  mfaCode: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}

export class ImpersonateDto {
  @IsInt()
  trainerId: number;
}
