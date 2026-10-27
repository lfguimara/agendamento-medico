import { NotFoundError } from '../../shared/errors/AppError';
import { criarPrismaMock, type PrismaMock } from '../../tests/helpers/prismaMock';
import { MedicoService } from './medico.service';

const ID = '53a71bf4-3458-4f4a-ae66-9c50b7c8f21d';

const medico = {
  id: ID,
  nome: 'Dr. João Souza',
  crm: 'CRM-SP 123456',
  especialidade: 'Cardiologia',
};

describe('MedicoService', () => {
  let mock: PrismaMock;
  let service: MedicoService;

  beforeEach(() => {
    const prisma = criarPrismaMock();
    mock = prisma.mock;
    service = new MedicoService(prisma.db);
  });

  describe('listar', () => {
    it('lista todos os médicos ordenados por nome quando não há filtro', async () => {
      mock.medico.findMany.mockResolvedValue([medico]);

      await expect(service.listar()).resolves.toEqual([medico]);
      expect(mock.medico.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { nome: 'asc' },
      });
    });

    it('filtra por especialidade sem diferenciar maiúsculas', async () => {
      mock.medico.findMany.mockResolvedValue([medico]);

      await service.listar({ especialidade: 'cardio' });

      expect(mock.medico.findMany).toHaveBeenCalledWith({
        where: { especialidade: { contains: 'cardio', mode: 'insensitive' } },
        orderBy: { nome: 'asc' },
      });
    });

    it('ignora o filtro quando a especialidade é vazia', async () => {
      mock.medico.findMany.mockResolvedValue([]);

      await service.listar({ especialidade: '' });

      expect(mock.medico.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
    });
  });

  describe('buscarPorId', () => {
    it('retorna o médico quando existe', async () => {
      mock.medico.findUnique.mockResolvedValue(medico);

      await expect(service.buscarPorId(ID)).resolves.toEqual(medico);
      expect(mock.medico.findUnique).toHaveBeenCalledWith({ where: { id: ID } });
    });

    it('lança NotFoundError (404) quando não existe', async () => {
      mock.medico.findUnique.mockResolvedValue(null);

      await expect(service.buscarPorId(ID)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Médico não encontrado(a)',
      });
    });
  });

  describe('criar', () => {
    it('cria o médico com os dados recebidos', async () => {
      const { id: _id, ...dados } = medico;
      mock.medico.create.mockResolvedValue(medico);

      await expect(service.criar(dados)).resolves.toEqual(medico);
      expect(mock.medico.create).toHaveBeenCalledWith({ data: dados });
    });
  });

  describe('atualizar', () => {
    it('atualiza o médico quando existe', async () => {
      const atualizado = { ...medico, especialidade: 'Pediatria' };
      mock.medico.findUnique.mockResolvedValue(medico);
      mock.medico.update.mockResolvedValue(atualizado);

      await expect(service.atualizar(ID, { especialidade: 'Pediatria' })).resolves.toEqual(atualizado);
      expect(mock.medico.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { especialidade: 'Pediatria' },
      });
    });

    it('não chama o update quando o médico não existe', async () => {
      mock.medico.findUnique.mockResolvedValue(null);

      await expect(service.atualizar(ID, { nome: 'Outro' })).rejects.toBeInstanceOf(NotFoundError);
      expect(mock.medico.update).not.toHaveBeenCalled();
    });
  });

  describe('remover', () => {
    it('remove o médico quando existe', async () => {
      mock.medico.findUnique.mockResolvedValue(medico);
      mock.medico.delete.mockResolvedValue(medico);

      await expect(service.remover(ID)).resolves.toBeUndefined();
      expect(mock.medico.delete).toHaveBeenCalledWith({ where: { id: ID } });
    });

    it('não chama o delete quando o médico não existe', async () => {
      mock.medico.findUnique.mockResolvedValue(null);

      await expect(service.remover(ID)).rejects.toBeInstanceOf(NotFoundError);
      expect(mock.medico.delete).not.toHaveBeenCalled();
    });
  });
});
