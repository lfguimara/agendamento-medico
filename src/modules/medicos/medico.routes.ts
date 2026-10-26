import { Router } from 'express';
import { medicoController } from './medico.controller';

export const medicoRoutes = Router();

medicoRoutes.get('/', medicoController.listar);
medicoRoutes.get('/:id', medicoController.buscarPorId);
medicoRoutes.post('/', medicoController.criar);
medicoRoutes.put('/:id', medicoController.atualizar);
medicoRoutes.delete('/:id', medicoController.remover);
