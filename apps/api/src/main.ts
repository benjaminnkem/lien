import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const corsOrigin =
    config.get<string>('corsOrigin') ?? 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Lien API')
    .setDescription(
      'LIEN encumbrance control plane — canonical obligations, atomic reservation, Cleanverse CVI/CCP gates.',
    )
    .setVersion('1.0.0')
    .addTag('app', 'Service info')
    .addTag('health', 'Health checks')
    .addTag('lien', 'Obligation registry, LienGuard, protocol adapters')
    .addTag('cleanverse', 'Cleanverse sandbox (A-Pass / A-Token)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    jsonDocumentUrl: 'docs/json',
    yamlDocumentUrl: 'docs/yaml',
    customSiteTitle: 'Lien API Docs',
  });

  const port = config.get<number>('port') ?? 3001;
  await app.listen(port);
  console.log(`Lien API listening on http://localhost:${port}/api`);
  console.log(`Swagger UI at http://localhost:${port}/api/docs`);
}

void bootstrap();
