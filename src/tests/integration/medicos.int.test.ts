import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../lib/prisma';
import {
  criarConsultaNoBanco,
  criarMedico,
  criarPaciente,
  dadosMedico,
  daquiAHoras,
  idInexistente,
} from '../helpers/db';

describe('Rotas /medicos', () => {
  describe('POST /medicos', () => {
    it('cadastra o médico e retorna 201', async () => {
      const dados = dadosMedico({ nome: 'Dr. João Souza' });

      const res = await request(app).post('/medicos').send(dados);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ ...dados, id: expect.any(String) });
    });

    it('guarda o CRM em maiúsculas e sem espaços nas pontas', async () => {
      const res = await request(app)
        .post('/medicos')
        .send(dadosMedico({ crm: '  crm-sp 999999  ' }));

      expect(res.status).toBe(201);
      expect(res.body.crm).toBe('CRM-SP 999999');
    });

    it('retorna 400 com os campos inválidos', async () => {
      const res = await request(app).post('/medicos').send({ nome: 'Jo', crm: '1', especialidade: '' });

      expect(res.status).toBe(400);
      const campos = res.body.detalhes.map((d: { campo: string }) => d.campo);
      expect(campos).toEqual(expect.arrayContaining(['nome', 'crm', 'especialidade']));
    });

    it('retorna 409 quando o CRM já está cadastrado', async () => {
      const existente = await criarMedico();

      const res = await request(app).post('/medicos').send(dadosMedico({ crm: existente.crm }));

      expect(res.status).toBe(409);
    });
  });

  describe('GET /medicos', () => {
    beforeEach(async () => {
      await criarMedico(dadosMedico({ nome: 'Dr. Bruno', especialidade: 'Cardiologia' }));
      await criarMedico(dadosMedico({ nome: 'Dr. André', especialidade: 'Pediatria' }));
      await criarMedico(dadosMedico({ nome: 'Dr. Caio', especialidade: 'Cardiologia Pediátrica' }));
    });

    it('lista todos os médicos ordenados por nome', async () => {
      const res = await request(app).get('/medicos');

      expect(res.status).toBe(200);
      expect(res.body.map((m: { nome: string }) => m.nome)).toEqual(['Dr. André', 'Dr. Bruno', 'Dr. Caio']);
    });

    it('filtra por especialidade sem diferenciar maiúsculas e por trecho do nome', async () => {
      const res = await request(app).get('/medicos').query({ especialidade: 'CARDIO' });

      expect(res.status).toBe(200);
      expect(res.body.map((m: { nome: string }) => m.nome)).toEqual(['Dr. Bruno', 'Dr. Caio']);
    });

    it('retorna lista vazia quando nenhuma especialidade bate', async () => {
      const res = await request(app).get('/medicos').query({ especialidade: 'Ortopedia' });

      expect(res.body).toEqual([]);
    });
  });

  describe('GET /medicos/:id', () => {
    it('retorna o médico', async () => {
      const medico = await criarMedico();

      const res = await request(app).get(`/medicos/${medico.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: medico.id, crm: medico.crm });
    });

    it('retorna 404 quando não existe', async () => {
      const res = await request(app).get(`/medicos/${idInexistente()}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ erro: 'Médico não encontrado(a)' });
    });
  });

  describe('PUT /medicos/:id', () => {
    it('atualiza só os campos enviados', async () => {
      const medico = await criarMedico();

      const res = await request(app).put(`/medicos/${medico.id}`).send({ especialidade: 'Neurologia' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ especialidade: 'Neurologia', nome: medico.nome, crm: medico.crm });
    });

    it('retorna 404 quando não existe', async () => {
      const res = await request(app).put(`/medicos/${idInexistente()}`).send({ nome: 'Dr. Novo' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /medicos/:id', () => {
    it('remove o médico e retorna 204', async () => {
      const medico = await criarMedico();

      const res = await request(app).delete(`/medicos/${medico.id}`);

      expect(res.status).toBe(204);
      await expect(prisma.medico.count()).resolves.toBe(0);
    });

    it('retorna 404 quando não existe', async () => {
      const res = await request(app).delete(`/medicos/${idInexistente()}`);

      expect(res.status).toBe(404);
    });

    // Regra 7
    it('retorna 409 quando o médico tem consultas', async () => {
      const paciente = await criarPaciente();
      const medico = await criarMedico();
      await criarConsultaNoBanco({ pacienteId: paciente.id, medicoId: medico.id, dataHora: daquiAHoras(48) });

      const res = await request(app).delete(`/medicos/${medico.id}`);

      expect(res.status).toBe(409);
      await expect(prisma.medico.count()).resolves.toBe(1);
    });
  });
});
