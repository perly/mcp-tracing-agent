import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsISO8601, IsNotEmpty, IsString, Matches, ValidateNested } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  traceId: string;

  @IsString()
  @IsNotEmpty()
  service: string;

  @IsString()
  @Matches(/^[A-Z]+$/)
  level: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsISO8601()
  timestamp: string;
}

export class ReplaceEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEventDto)
  events: CreateEventDto[];
}
