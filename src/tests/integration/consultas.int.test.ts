import request from 'supertest';
import { StatusConsulta } from '../../generated/prisma/enums';
import { app } from '../../app';
import { prisma } from '../../lib/prisma';
import {
  MINUTO_MS,
  criarConsultaNoBanco,
  criarMedico,
  criarPaciente,
  daquiAHoras,
  idInexistente,
} from '../helpers/db';

type Paciente = Awaited<ReturnType<typeof criarPaciente>>;
type Medico = Awaited<ReturnType<typeof criarMedico>>;

describe('Rotas /consultas', () => {
  let paciente: Paciente;
  let medico: Medico;

  beforeEach(async () => {
    paciente = await criarPaciente();
    medico = await criarMedico();
  });

  const agendar = (dataHora: Date, medicoId = medico.id, pacienteId = paciente.id) =>
    request(app).post('/consultas').send({ pacienteId, medicoId, dataHora: dataHora.toISOString() });

  describe('POST /consultas', () => {
    it('agenda a consulta e retorna 201 com paciente e médico', async () => {
      const dataHora = daquiAHoras(48);

      const res = await agendar(dataHora);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        status: StatusConsulta.AGENDADA,
        dataHora: dataHora.toISOString(),
        paciente: { id: paciente.id, nome: paciente.nome },
        medico: { id: medico.id, nome: medico.nome, especialidade: medico.especialidade },
      });
    });

    it('aceita data/hora com fuso -03:00', async () => {
      const ano = new Date().getFullYear() + 1;

      const res = await request(app)
        .post('/consultas')
        .send({ pacienteId: paciente.id, medicoId: medico.id, dataHora: `${ano}-03-10T14:30:00-03:00` });

      expect(res.status).toBe(201);
      expect(res.body.dataHora).toBe(`${ano}-03-10T17:30:00.000Z`);
    });

    it('retorna 400 quando a data não está em ISO 8601 com fuso', async () => {
      const res = await request(app)
        .post('/consultas')
        .send({ pacienteId: paciente.id, medicoId: medico.id, dataHora: '10/11/2030 14:30' });

      expect(res.status).toBe(400);
      expect(res.body.detalhes[0].campo).toBe('dataHora');
    });

    // Regra 2
    it('retorna 400 ao agendar no passado', async () => {
      const res = await agendar(daquiAHoras(-1));

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ erro: 'Não é possível agendar consulta no passado' });
    });

    it('retorna 404 quando o paciente não existe', async () => {
      const res = await agendar(daquiAHoras(48), medico.id, idInexistente());

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ erro: 'Paciente não encontrado(a)' });
    });

    it('retorna 404 quando o médico não existe', async () => {
      const res = await agendar(daquiAHoras(48), idInexistente());

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ erro: 'Médico não encontrado(a)' });
    });

    // Regra 1
    describe('conflito de horário (consultas de 30 min)', () => {
      const base = daquiAHoras(48);
      const minutos = (m: number) => new Date(base.getTime() + m * MINUTO_MS);

      beforeEach(async () => {
        await criarConsultaNoBanco({ pacienteId: paciente.id, medicoId: medico.id, dataHora: base });
      });

      it.each([0, 15, -15, 29, -29])('retorna 409 para uma consulta %i min de distância', async (m) => {
        const res = await agendar(minutos(m));

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ erro: 'Médico já possui consulta agendada nesse horário' });
      });

      it.each([30, -30, 60])('permite agendar a %i min de distância', async (m) => {
        const res = await agendar(minutos(m));

        expect(res.status).toBe(201);
      });

      it('permite o mesmo horário com outro médico', async () => {
        const outroMedico = await criarMedico();

        const res = await agendar(base, outroMedico.id);

        expect(res.status).toBe(201);
      });

      it('permite reutilizar o horário de uma consulta cancelada', async () => {
        await prisma.consulta.updateMany({ data: { status: StatusConsulta.CANCELADA } });

        const res = await agendar(base);

        expect(res.status).toBe(201);
      });
    });
  });

  describe('GET /consultas', () => {
    it('lista as consultas ordenadas por data e filtra por médico, paciente e status', async () => {
      const outroMedico = await criarMedico();
      const outroPaciente = await criarPaciente();
      const c1 = await criarConsultaNoBanco({ pacienteId: paciente.id, medicoId: medico.id, dataHora: daquiAHoras(72) });
      const c2 = await criarConsultaNoBanco({ pacienteId: paciente.id, medicoId: medico.id, dataHora: daquiAHoras(48) });
      const c3 = await criarConsultaNoBanco({
        pacienteId: outroPaciente.id,
        medicoId: outroMedico.id,
        dataHora: daquiAHoras(24 * 5),
        status: StatusConsulta.CANCELADA,
      });
      const ids = (res: request.Response) => res.body.map((c: { id: string }) => c.id);

      const todas = await request(app).get('/consultas');
      expect(todas.status).toBe(200);
      expect(ids(todas)).toEqual([c2.id, c1.id, c3.id]);

      const porMedico = await request(app).get('/consultas').query({ medicoId: outroMedico.id });
      expect(ids(porMedico)).toEqual([c3.id]);

      const porPaciente = await request(app).get('/consultas').query({ pacienteId: paciente.id });
      expect(ids(porPaciente)).toEqual([c2.id, c1.id]);

      const canceladas = await request(app).get('/consultas').query({ status: StatusConsulta.CANCELADA });
      expect(ids(canceladas)).toEqual([c3.id]);
    });

    it('retorna 400 para status inválido no filtro', async () => {
      const res = await request(app).get('/consultas').query({ status: 'REMARCADA' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /consultas/:id', () => {
    it('retorna a consulta com paciente e médico', async () => {
      const consulta = await criarConsultaNoBanco({ pacienteId: paciente.id, medicoId: medico.id, dataHora: daquiAHoras(48) });

      const res = await request(app).get(`/consultas/${consulta.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: consulta.id, paciente: { id: paciente.id }, medico: { id: medico.id } });
    });

    it('retorna 404 quando não existe', async () => {
      const res = await request(app).get(`/consultas/${idInexistente()}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ erro: 'Consulta não encontrado(a)' });
    });
  });

  describe('PATCH /consultas/:id/cancelar', () => {
    it('cancela uma consulta com mais de 24h de antecedência', async () => {
      const consulta = await criarConsultaNoBanco({ pacienteId: paciente.id, medicoId: medico.id, dataHora: daquiAHoras(48) });

      const res = await request(app).patch(`/consultas/${consulta.id}/cancelar`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(StatusConsulta.CANCELADA);
      await expect(prisma.consulta.findUnique({ where: { id: consulta.id } })).resolves.toMatchObject({
        status: StatusConsulta.CANCELADA,
      });
    });

    // Regra 3
    it('retorna 400 com menos de 24h de antecedência', async () => {
      const consulta = await criarConsultaNoBanco({ pacienteId: paciente.id, medicoId: medico.id, dataHora: daquiAHoras(23) });

      const res = await request(app).patch(`/consultas/${consulta.id}/cancelar`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ erro: 'Cancelamento só é permitido com 24h de antecedência' });
    });

    // Regra 4
    it('retorna 400 ao cancelar uma consulta já cancelada', async () => {
      const consulta = await criarConsultaNoBanco({
        pacienteId: paciente.id,
        medicoId: medico.id,
        dataHora: daquiAHoras(48),
        status: StatusConsulta.CANCELADA,
      });

      const res = await request(app).patch(`/consultas/${consulta.id}/cancelar`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ erro: 'Consulta com status CANCELADA não pode ser cancelada' });
    });

    it('retorna 404 quando não existe', async () => {
      const res = await request(app).patch(`/consultas/${idInexistente()}/cancelar`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /consultas/:id/concluir', () => {
    it('conclui uma consulta cujo horário já passou', async () => {
      const consulta = await criarConsultaNoBanco({ pacienteId: paciente.id, medicoId: medico.id, dataHora: daquiAHoras(-2) });

      const res = await request(app).patch(`/consultas/${consulta.id}/concluir`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(StatusConsulta.CONCLUIDA);
    });

    // Regra 5
    it('retorna 400 para uma consulta que ainda não aconteceu', async () => {
      const consulta = await criarConsultaNoBanco({ pacienteId: paciente.id, medicoId: medico.id, dataHora: daquiAHoras(2) });

      const res = await request(app).patch(`/consultas/${consulta.id}/concluir`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ erro: 'Não é possível concluir uma consulta que ainda não aconteceu' });
    });

    // Regra 4
    it('retorna 400 ao concluir uma consulta cancelada', async () => {
      const consulta = await criarConsultaNoBanco({
        pacienteId: paciente.id,
        medicoId: medico.id,
        dataHora: daquiAHoras(-2),
        status: StatusConsulta.CANCELADA,
      });

      const res = await request(app).patch(`/consultas/${consulta.id}/concluir`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ erro: 'Consulta com status CANCELADA não pode ser concluída' });
    });
  });

  it('retorna 404 para rota inexistente', async () => {
    const res = await request(app).get('/consultas/x/remarcar');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: 'Rota não encontrada' });
  });
});
