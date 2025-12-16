import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as moment from 'moment-timezone';   // ✅ add this import

// ✅ Force Node and Moment to use Pakistan time (Asia/Karachi)
process.env.TZ = 'Asia/Karachi';
moment.tz.setDefault( 'Asia/Karachi' );

async function bootstrap ()
{
  const app = await NestFactory.create( AppModule );

  // ✅ Enable CORS (your existing setup)
  app.enableCors( {
    origin: [
      'https://surajcotton.jiotp.com',
      'http://110.39.23.106:3091',
      'http://localhost:3001',
      'http://localhost:3000',
      'https://fk1gbkmr-3000.uks1.devtunnels.ms',
      '*',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  } );

  // 🕓 Optional: Verify timezone on startup (just for confirmation logs)
  console.log( '🕓 Server Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone );
  console.log( '🕓 Current Time:', moment().format( 'YYYY-MM-DD HH:mm:ss Z' ) );

  await app.listen( process.env.PORT ?? 5015, '0.0.0.0' );
}
bootstrap();
