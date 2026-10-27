import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../lib/prisma';
import {
  criarConsultaNoBanco,
  criarMedico,
  criarPaciente,
  dadosPaciente,
  daquiAHoras,
  idInexistente,
} from '../helpers/db';

describe('Rotas /pacientes', () => {
  describe('POST /pacientes', () => {
    it('cadastra o paciente e retorna 201', async () => {
      const dados = dadosPaciente({ nome: 'Maria Silva' });

      const res = await request(app).post('/pacientes').send(dados);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ ...dados, id: expect.any(String) });
      await expect(prisma.paciente.count()).resolves.toBe(1);
    });

    it('guarda o CPF só com os dígitos quando enviado com máscara', async () => {
      const res = await request(app)
        .post('/pacientes')
        .send(dadosPaciente({ cpf: '123.456.789-00' }));

      expect(res.status).toBe(201);
      expect(res.body.cpf).toBe('12345678900');
    });

    it('retorna 400 com os campos inválidos', async () => {
      const res = await request(app)
        .post('/pacientes')
        .send({ nome: 'Ma', cpf: '123', email: 'nao-e-email', telefone: '119' });

      expect(res.status).toBe(400);
      expect(res.body.erro).toBe('Dados inválidos');
      const campos = res.body.detalhes.map((d: { campo: string }) => d.campo);
      expect(campos).toEqual(expect.arrayContaining(['nome', 'cpf', 'email', 'telefone']));
    });

    it.each(['cpf', 'email'] as const)('retorna 409 quando o %s já está cadastrado', async (campo) => {
      const existente = await criarPaciente();

      const res = await request(app)
        .post('/pacientes')
        .send(dadosPaciente({ [campo]: existente[campo] }));

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ erro: 'Registro já existe com esses dados únicos' });
    });
  });

  describe('GET /pacientes', () => {
    it('lista os pacientes ordenados por nome', async () => {
      await criarPaciente(dadosPaciente({ nome: 'Carlos' }));
      await criarPaciente(dadosPaciente({ nome: 'Ana' }));
      await criarPaciente(dadosPaciente({ nome: 'Bruno' }));

      const res = await request(app).get('/pacientes');

      expect(res.status).toBe(200);
      expect(res.body.map((p: { nome: string }) => p.nome)).toEqual(['Ana', 'Bruno', 'Carlos']);
    });

    it('retorna lista vazia quando não há pacientes', async () => {
      const res = await request(app).get('/pacientes');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /pacientes/:id', () => {
    it('retorna o paciente', async () => {
      const paciente = await criarPaciente();

      const res = await request(app).get(`/pacientes/${paciente.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: paciente.id, nome: paciente.nome });
    });

    it('retorna 404 quando não existe', async () => {
      const res = await request(app).get(`/pacientes/${idInexistente()}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ erro: 'Paciente não encontrado(a)' });
    });

    it('retorna 400 quando o ID não é um UUID', async () => {
      const res = await request(app).get('/pacientes/123');

      expect(res.status).toBe(400);
      expect(res.body.detalhes).toEqual([{ campo: 'id', mensagem: 'ID inválido' }]);
    });
  });

  describe('PUT /pacientes/:id', () => {
    it('atualiza só os campos enviados', async () => {
      const paciente = await criarPaciente();

      const res = await request(app).put(`/pacientes/${paciente.id}`).send({ telefone: '11888887777' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ telefone: '11888887777', nome: paciente.nome, cpf: paciente.cpf });
    });

    it('retorna 404 quando não existe', async () => {
      const res = await request(app).put(`/pacientes/${idInexistente()}`).send({ nome: 'Novo Nome' });

      expect(res.status).toBe(404);
    });

    it('retorna 409 ao trocar o e-mail para um já usado por outro paciente', async () => {
      const a = await criarPaciente();
      const b = await criarPaciente();

      const res = await request(app).put(`/pacientes/${b.id}`).send({ email: a.email });

      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /pacientes/:id', () => {
    it('remove o paciente e retorna 204', async () => {
      const paciente = await criarPaciente();

      const res = await request(app).delete(`/pacientes/${paciente.id}`);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      await expect(prisma.paciente.findUnique({ where: { id: paciente.id } })).resolves.toBeNull();
    });

    it('retorna 404 quando não existe', async () => {
      const res = await request(app).delete(`/pacientes/${idInexistente()}`);

      expect(res.status).toBe(404);
    });

    // Regra 7
    it('retorna 409 quando o paciente tem consultas', async () => {
      const paciente = await criarPaciente();
      const medico = await criarMedico();
      await criarConsultaNoBanco({ pacienteId: paciente.id, medicoId: medico.id, dataHora: daquiAHoras(48) });

      const res = await request(app).delete(`/pacientes/${paciente.id}`);

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ erro: 'Registro possui vínculos e não pode ser alterado/excluído' });
      await expect(prisma.paciente.count()).resolves.toBe(1);
    });
  });
});
