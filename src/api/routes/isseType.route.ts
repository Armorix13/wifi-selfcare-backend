import { Router } from 'express';
import {
    createIssueType,
    getAllIssueTypes,
    getIssueTypeById,
    updateIssueType,
    deleteIssueType
} from '../controllers/issueType.controller';

const issueTypeRouter = Router();

issueTypeRouter.post('/', createIssueType);
issueTypeRouter.get('/', getAllIssueTypes);
issueTypeRouter.get('/:id', getIssueTypeById);
issueTypeRouter.put('/:id', updateIssueType);
issueTypeRouter.delete('/:id', deleteIssueType);

export default issueTypeRouter; 