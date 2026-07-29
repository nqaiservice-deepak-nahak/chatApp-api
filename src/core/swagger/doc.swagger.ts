import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setUpSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Real-Time Group Chat API')
    .setDescription('REST + Socket.IO API documentation for the Real-Time Group Chat application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
