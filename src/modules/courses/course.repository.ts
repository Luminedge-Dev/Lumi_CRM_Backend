import Course from '../../models/Course';

export const courseRepository = {
  list: (query: Record<string, any>, sort: Record<string, 1 | -1>) => Course.find(query).sort(sort),

  findById: (id: string) => Course.findById(id),

  create: async (data: Record<string, unknown>) => {
    const course = new Course(data);
    await course.save();
    return course;
  },

  update: (id: string, data: Record<string, unknown>) => Course.findByIdAndUpdate(id, data, { new: true }),

  delete: (id: string) => Course.findByIdAndDelete(id),
};
