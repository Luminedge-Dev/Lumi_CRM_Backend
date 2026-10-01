import { Request, Response } from 'express';

const LUMINEDGE_API_URL = 'https://luminedge-server.vercel.app/api/v1/admin/get-schedules';

export const getAvailableSchedules = async (req: Request, res: Response) => {
  try {
    const response = await fetch(LUMINEDGE_API_URL);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: 'Failed to fetch schedules from Luminedge API'
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching schedules from Luminedge:', error);
    res.status(503).json({
      success: false,
      message: 'Luminedge API is currently unavailable'
    });
  }
};
