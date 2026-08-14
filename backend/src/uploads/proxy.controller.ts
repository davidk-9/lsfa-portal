import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AzureStorageService } from '../azure-storage/azure-storage.service';

// Public, unauthenticated file proxy.
//
// The URL stored in Axcelerate (and surfaced to the UI) is a stable proxy URL of
// the form {PUBLIC_BASE_URL}/proxy/{proxyKey}. It never changes. On each request
// we look up the blob by its proxy key and 302-redirect to a freshly minted,
// short-lived SAS link, so the durable proxy URL never rots as SAS tokens expire.
@Controller()
export class ProxyController {
  constructor(
    private prisma: PrismaService,
    private azure: AzureStorageService,
  ) {}

  @Get(['proxy/:proxyKey', 'api/proxy/:proxyKey'])
  async resolve(@Param('proxyKey') proxyKey: string, @Res() res: Response) {
    const row = await this.prisma.workshopUpload.findUnique({ where: { proxyKey } });

    if (!row || row.status === 'deleted' || !row.blobPath) {
      throw new NotFoundException('File not found');
    }

    const url = await this.azure.generateReadUrl(row.blobPath);
    res.redirect(302, url);
  }
}
