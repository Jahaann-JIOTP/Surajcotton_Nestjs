import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Add this line to fix your CORS issue
  app.enableCors({
    origin: ['https://surajcotton.jiotp.com','http://110.39.23.106:3091','http://localhost:3000', '*'], // or wherever your frontend runs
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type, Authorization",
    credentials: true, // only if using cookies/auth
  });


 
  await app.listen(process.env.PORT ?? 5015, '0.0.0.0');

}
bootstrap();