// Fonction Vercel : toutes les routes /api/* arrivent ici (voir vercel.json).
import { handleApi } from '../lib/api.js';

export default function handler(req, res) {
  return handleApi(req, res);
}
