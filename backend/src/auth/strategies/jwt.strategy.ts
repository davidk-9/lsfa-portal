import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: {
    sub: number;
    email: string;
    role: string;
    axcelerateContactId?: string | null;
    impersonating?: number;
    impersonatingName?: string;
    impersonatingAxcelerateContactId?: string | null;
  }) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      axcelerateContactId: payload.axcelerateContactId ?? null,
      impersonating: payload.impersonating ?? null,
      impersonatingName: payload.impersonatingName ?? null,
      impersonatingAxcelerateContactId: payload.impersonatingAxcelerateContactId ?? null,
    };
  }
}
