import { IsEmail, IsNotEmpty, IsString, IsInt } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifyMfaDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ImpersonateDto {
  @IsInt()
  trainerId: number;
}
