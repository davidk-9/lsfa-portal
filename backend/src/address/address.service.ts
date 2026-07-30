import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressService {
  constructor(private prisma: PrismaService) {}

  async searchAddresses(query: string) {
    const minSearchLength = 3;
    if (query.trim().length < minSearchLength) {
      return [];
    }

    // Replace spaces with ILIKE friendly wildcards for robust sub-string trigram matching
    const searchTerms = query.trim().split(/\s+/);
    const likeQuery = `%${searchTerms.join('%')}%`;

    // We use a raw query here because we want to guarantee the use of the ILIKE operator
    // which explicitly utilizes the pg_trgm indices we set up on addressLabel
    const results = await this.prisma.$queryRaw`
      SELECT 
        "addressDetailPid", 
        "addressLabel", 
        "streetName", 
        "streetType", 
        "localityName", 
        "state", 
        "postcode", 
        "longitude", 
        "latitude"
      FROM "GNAFAddress"
      WHERE "addressLabel" ILIKE ${likeQuery}
      LIMIT 15;
    `;

    return results;
  }
}
