import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('SUPER_USER', 'ADMIN')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.usersService.findAllPaginated(pageNum, limitNum, search, role);
  }

  @Get('trainers')
  @Roles('SUPER_USER', 'ADMIN')
  findTrainers() {
    return this.usersService.findTrainers();
  }

  @Get(':id')
  @Roles('SUPER_USER', 'ADMIN')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Post()
  @Roles('SUPER_USER')
  create(@Body() dto: CreateUserDto, @Request() req) {
    return this.usersService.create(dto, req.user.id);
  }

  @Patch(':id')
  @Roles('SUPER_USER')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/archive')
  @Roles('SUPER_USER')
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.archive(id);
  }

  @Patch(':id/restore')
  @Roles('SUPER_USER')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.restore(id);
  }

  @Patch(':id/deactivate')
  @Roles('SUPER_USER')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.archive(id);
  }

  @Post('lookup-axcelerate-contact')
  @Roles('SUPER_USER')
  lookupAxcelerateContact(@Body('email') email: string) {
    return this.usersService.lookupAxcelerateContact(email);
  }
}
