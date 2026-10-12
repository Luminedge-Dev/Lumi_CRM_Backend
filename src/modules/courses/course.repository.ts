import Course from '../../models/Course';
import { createCrudRepository } from '../../shared/db/crud.repository';

export const courseRepository = createCrudRepository(Course);
