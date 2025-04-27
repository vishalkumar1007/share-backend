import express from "express";

const TextMultiverseRoute = express.Router();

import { universalTextSave, getUniversalTextData } from '../controllers/multiverseTextController.js';
import {multiverseCustomPortRateLimit} from '../middleware/portRateLimitMiddleware.js';

TextMultiverseRoute.post('/universalTextSave',multiverseCustomPortRateLimit,universalTextSave)
TextMultiverseRoute.get('/universalTextData',multiverseCustomPortRateLimit,getUniversalTextData)

export default TextMultiverseRoute;