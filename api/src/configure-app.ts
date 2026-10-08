import { INestApplication, ValidationPipe } from '@nestjs/common';

export const configureApp = (app: INestApplication): void => {
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
};
