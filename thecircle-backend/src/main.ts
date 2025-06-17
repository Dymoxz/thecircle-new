// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import { ApiModule } from './api.module';
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

  // API server on HTTP (or HTTPS if you want)
  const apiApp = await NestFactory.create(ApiModule);
  const globalPrefix = 'api';
  apiApp.setGlobalPrefix(globalPrefix);
  apiApp.enableCors();
  await apiApp.listen(3002);
  console.log(`API server running at http://localhost:3002/${globalPrefix}`);
}
bootstrap();