import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/error-handler.filter'; // Adjust path as needed

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Add this line to fix your CORS issue
  app.enableCors({
    origin: '*', // or wherever your frontend runs
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type, Authorization",
    credentials: true, // only if using cookies/auth
  });

  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? 5015);
}
bootstrap();