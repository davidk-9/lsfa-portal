import { IsNumber, IsString, IsOptional, IsIn } from 'class-validator';

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

  data: any;
}

export class SaveProgressDto {
  @IsNumber()
  instanceId: number;

  @IsNumber()
  trainerContactId: number;

  status: any;
}
