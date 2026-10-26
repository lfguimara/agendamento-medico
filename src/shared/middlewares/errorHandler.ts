import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../errors/AppError';

// Middleware de erro do Express (4 parâmetros). No Express 5, erros lançados
// em handlers async chegam aqui automaticamente, sem precisar de try/catch.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ erro: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      erro: 'Dados inválidos',
      detalhes: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: violação de campo único (ex.: CPF ou CRM já cadastrado)
    if (err.code === 'P2002') {
      res.status(409).json({ erro: 'Registro já existe com esses dados únicos' });
      return;
    }
    // P2003: chave estrangeira (ex.: excluir paciente que tem consultas)
    if (err.code === 'P2003') {
      res.status(409).json({ erro: 'Registro possui vínculos e não pode ser alterado/excluído' });
      return;
    }
    // P2025: registro não encontrado em update/delete
    if (err.code === 'P2025') {
      res.status(404).json({ erro: 'Registro não encontrado' });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
};
