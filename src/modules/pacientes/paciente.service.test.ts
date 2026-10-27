import { NotFoundError } from '../../shared/errors/AppError';
import { criarPrismaMock, type PrismaMock } from '../../tests/helpers/prismaMock';
import { PacienteService } from './paciente.service';

const ID = '7d5eca69-ae6d-4a4c-85a0-ad3f36736306';

const paciente = {
  id: ID,
  nome: 'Maria Silva',
  cpf: '12345678900',
  email: 'maria@email.com',
  telefone: '11999990000',
};

describe('PacienteService', () => {
  let mock: PrismaMock;
  let service: PacienteService;

  beforeEach(() => {
    const prisma = criarPrismaMock();
    mock = prisma.mock;
    service = new PacienteService(prisma.db);
  });

  describe('listar', () => {
    it('lista os pacientes ordenados por nome', async () => {
      mock.paciente.findMany.mockResolvedValue([paciente]);

      const resultado = await service.listar();

      expect(resultado).toEqual([paciente]);
      expect(mock.paciente.findMany).toHaveBeenCalledWith({ orderBy: { nome: 'asc' } });
    });
  });

  describe('buscarPorId', () => {
    it('retorna o paciente quando existe', async () => {
      mock.paciente.findUnique.mockResolvedValue(paciente);

      await expect(service.buscarPorId(ID)).resolves.toEqual(paciente);
      expect(mock.paciente.findUnique).toHaveBeenCalledWith({ where: { id: ID } });
    });

    it('lança NotFoundError (404) quando não existe', async () => {
      mock.paciente.findUnique.mockResolvedValue(null);

      const promessa = service.buscarPorId(ID);

      await expect(promessa).rejects.toBeInstanceOf(NotFoundError);
      await expect(promessa).rejects.toMatchObject({
        statusCode: 404,
        message: 'Paciente não encontrado(a)',
      });
    });
  });

  describe('criar', () => {
    it('cria o paciente com os dados recebidos', async () => {
      const { id: _id, ...dados } = paciente;
      mock.paciente.create.mockResolvedValue(paciente);

      await expect(service.criar(dados)).resolves.toEqual(paciente);
      expect(mock.paciente.create).toHaveBeenCalledWith({ data: dados });
    });
  });

  describe('atualizar', () => {
    it('atualiza o paciente quando existe', async () => {
      const atualizado = { ...paciente, telefone: '11888880000' };
      mock.paciente.findUnique.mockResolvedValue(paciente);
      mock.paciente.update.mockResolvedValue(atualizado);

      await expect(service.atualizar(ID, { telefone: '11888880000' })).resolves.toEqual(atualizado);
      expect(mock.paciente.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { telefone: '11888880000' },
      });
    });

    it('não chama o update quando o paciente não existe', async () => {
      mock.paciente.findUnique.mockResolvedValue(null);

      await expect(service.atualizar(ID, { nome: 'Outro Nome' })).rejects.toBeInstanceOf(NotFoundError);
      expect(mock.paciente.update).not.toHaveBeenCalled();
    });
  });

  describe('remover', () => {
    it('remove o paciente quando existe', async () => {
      mock.paciente.findUnique.mockResolvedValue(paciente);
      mock.paciente.delete.mockResolvedValue(paciente);

      await expect(service.remover(ID)).resolves.toBeUndefined();
      expect(mock.paciente.delete).toHaveBeenCalledWith({ where: { id: ID } });
    });

    it('não chama o delete quando o paciente não existe', async () => {
      mock.paciente.findUnique.mockResolvedValue(null);

      await expect(service.remover(ID)).rejects.toBeInstanceOf(NotFoundError);
      expect(mock.paciente.delete).not.toHaveBeenCalled();
    });
  });
});
