import { IsISO8601, IsNotEmpty, IsString, Matches } from 'class-validator';

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
