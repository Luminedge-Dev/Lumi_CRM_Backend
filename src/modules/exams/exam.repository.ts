import Exam from '../../models/Exam';

export const examRepository = {
  list: (query: Record<string, any>, sort: Record<string, 1 | -1>) => Exam.find(query).sort(sort),

  findById: (id: string) => Exam.findById(id),

  create: async (data: Record<string, unknown>) => {
    const exam = new Exam(data);
    await exam.save();
    return exam;
  },

  update: (id: string, data: Record<string, unknown>) => Exam.findByIdAndUpdate(id, data, { new: true }),

  delete: (id: string) => Exam.findByIdAndDelete(id),
};
