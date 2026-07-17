import { IsNumber, IsString, IsOptional, IsIn, IsArray, IsObject, Allow } from 'class-validator';

export class MarkAttendanceDto {
  @IsNumber()
  instanceId: number;

  @IsNumber()
  contactId: number;

  @IsNumber()
  complexId: number;

  @IsIn([0, 1])
  attended: 0 | 1;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SaveChecklistDto {
  @IsNumber()
  instanceId: number;

  @IsNumber()
  contactId: number;

  @IsString()
  courseCode: string;

  @Allow()
  data: any;
}

export class SaveProgressDto {
  @IsNumber()
  instanceId: number;

  @IsString()
  trainerContactId: string;

  @Allow()
  status: any;
}

export class WizardSaveDto {
  @IsNumber()
  instanceId: number;

  @IsArray()
  @IsNumber({}, { each: true })
  contactIds: number[];

  @IsString()
  ptId: string;

  @IsString()
  taskResult: string;

  @IsObject()
  elementsResults: Record<string, string>;

  @IsOptional()
  @IsString()
  trainerComment?: string;

  @IsOptional()
  @IsString()
  courseCode?: string;
}
