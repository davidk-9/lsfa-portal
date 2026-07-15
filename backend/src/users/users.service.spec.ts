import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let axcelerate: any;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    axcelerate = {
      lookupContactByEmail: jest.fn(),
    };
    service = new UsersService(prisma, axcelerate);
  });

  it('archives a user by setting isActive to false', async () => {
    prisma.user.update.mockResolvedValue({ id: 1, isActive: false });

    await expect(service.archive(1)).resolves.toEqual({ id: 1, isActive: false });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: false },
    });
  });

  it('restores a user by setting isActive to true', async () => {
    prisma.user.update.mockResolvedValue({ id: 1, isActive: true });

    await expect(service.restore(1)).resolves.toEqual({ id: 1, isActive: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: true },
    });
  });

  it('looks up an Axcelerate contact ID from an email address', async () => {
    axcelerate.lookupContactByEmail.mockResolvedValue({ contactId: '12345', contactName: 'Jane Doe' });

    await expect(service.lookupAxcelerateContact('jane@example.com')).resolves.toEqual({
      contactId: '12345',
      contactName: 'Jane Doe',
    });
    expect(axcelerate.lookupContactByEmail).toHaveBeenCalledWith('jane@example.com');
  });
});
