import { Router } from 'express';
import { pacienteController } from './paciente.controller';

export const pacienteRoutes = Router();

pacienteRoutes.get('/', pacienteController.listar);
pacienteRoutes.get('/:id', pacienteController.buscarPorId);
pacienteRoutes.post('/', pacienteController.criar);
pacienteRoutes.put('/:id', pacienteController.atualizar);
pacienteRoutes.delete('/:id', pacienteController.remover);
