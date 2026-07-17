import { IsArray, IsInt, IsString, ValidateNested, IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class RosterEntryDto {
  @IsNumber()
  contact_id: number;

  @IsString()
  name: string;
}

export class ClassifyPageDto {
  @IsInt()
  instanceId: number;

  @IsInt()
  pageNumber: number;

  @IsString()
  @IsNotEmpty()
  pageImage: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RosterEntryDto)
  roster: RosterEntryDto[];
}
