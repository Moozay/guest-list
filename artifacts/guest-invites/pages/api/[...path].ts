import type { NextApiRequest, NextApiResponse } from 'next';
import app from '../../../api-server/src/app';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return app(req, res);
}