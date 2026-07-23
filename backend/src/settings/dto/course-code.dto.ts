import { IsString, IsNotEmpty, IsInt, Min, IsOptional } from 'class-validator';

export class CreateCourseCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  name: string;

  @IsString()
  shortName: string;

  @IsInt()
  @Min(0)
  cost: number;
}

export class UpdateCourseCodeDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  shortName?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  cost?: number;
}