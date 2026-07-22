import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(); // ajustar origen específico en producción
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta campos no declarados en los DTOs
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const puerto = process.env.PORT || 3000;
  await app.listen(puerto);
  console.log(`API corriendo en http://localhost:${puerto}/api`);
}

bootstrap();
