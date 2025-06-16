// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // Define path to certs, assuming they are in a 'certs' folder at the project root
  const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, '..', '..', 'certs', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '..', '..', 'certs', 'cert.pem')),
  };

  const app = await NestFactory.create(AppModule, { httpsOptions });

  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableCors(); // Enable CORS for HTTP requests

  await app.listen(3001); // The port can be different from the original server.js
  console.log('WebRTC signaling server running at https://localhost:3001 (WSS)');
}
bootstrap();