import express from 'express';
import { getUserIpAddressData } from '../controllers/getUserIpAddressData.js';

const ipRouter = express.Router();

ipRouter.get('/', getUserIpAddressData);

export default ipRouter;
