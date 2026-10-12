import Exam from '../../models/Exam';
import { createCrudRepository } from '../../shared/db/crud.repository';

export const examRepository = createCrudRepository(Exam);
