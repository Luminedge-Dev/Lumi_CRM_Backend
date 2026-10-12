import { Document, Model } from 'mongoose';

/** The list/findById/create/update/delete shape shared by every simple id-keyed collection. */
export const createCrudRepository = <T extends Document>(model: Model<T>) => ({
  list: (query: Record<string, any>, sort: Record<string, 1 | -1>) => model.find(query).sort(sort),

  findById: (id: string) => model.findById(id),

  create: async (data: Record<string, unknown>) => {
    const doc = new model(data);
    await doc.save();
    return doc;
  },

  update: (id: string, data: Record<string, unknown>) => model.findByIdAndUpdate(id, data, { new: true }),

  delete: (id: string) => model.findByIdAndDelete(id),
});
