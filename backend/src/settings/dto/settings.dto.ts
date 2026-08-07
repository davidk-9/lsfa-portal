import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertSettingDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  value: string;
}

export class UpsertManySettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertSettingDto)
  settings: UpsertSettingDto[];
}

export class BulkGenerateMagicLinksDto {
  @IsOptional()
  @IsBoolean()
  syncToAxcelerate?: boolean;

  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}
